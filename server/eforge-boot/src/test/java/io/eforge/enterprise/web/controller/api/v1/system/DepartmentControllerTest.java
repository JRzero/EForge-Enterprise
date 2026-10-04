package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.service.ISysDeptService;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes = {DepartmentController.class, PermissionService.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, DepartmentControllerTest.Configuration.class})
class DepartmentControllerTest
{
    private static final String PATH = "/api/v1/system/departments";
    private static final String BODY = "{\"parentId\":\"100\",\"name\":\"Team\",\"sort\":1,\"status\":\"0\"}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysDeptService departments;
    @MockitoBean io.eforge.enterprise.system.mapper.DepartmentMutationMapper mutations;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void authenticate()
    {
        SysUser user = new SysUser(); user.setUserId(1L); user.setUserName("admin");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(1L, 103L, user, Set.of("*:*:*")));
        when(departments.checkDeptNameUnique(any())).thenReturn(true);
        when(mutations.lockRoot()).thenReturn(100L);
        when(departments.selectDeptList(any())).thenAnswer(invocation -> {
            SysDept filter = invocation.getArgument(0);
            if (filter.getDeptId() == null) return List.of(row(100, 0, "0"), row(101, 100, "0,100"), row(102, 101, "0,100,101"));
            if (filter.getDeptId() == 100) return List.of(row(100, 0, "0"));
            if (filter.getDeptId() == 101) return List.of(row(101, 100, "0,100"));
            if (filter.getDeptId() == 102) return List.of(row(102, 101, "0,100,101"));
            return List.of();
        });
    }
    private static SysDept row(long id, long parent, String ancestors)
    {
        SysDept row = new SysDept(); row.setDeptId(id); row.setParentId(parent); row.setAncestors(ancestors);
        row.setDeptName("Team"); row.setOrderNum(1); row.setStatus("0"); return row;
    }
    @Test void listUsesConcreteFieldsAndExcludesTheWholeDescendantSubtree() throws Exception
    {
        mvc.perform(get(PATH).param("excludeId", "101")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value("100"))
                .andExpect(jsonPath("$[0].ancestors").doesNotExist()).andExpect(jsonPath("$[0].params").doesNotExist());
        verify(departments).checkDeptDataScope(101L);
    }
    @ParameterizedTest @ValueSource(strings = {"{}", "null", "{\"parentId\":\"0\",\"name\":\"Team\",\"sort\":-1,\"status\":\"0\"}",
            "{\"parentId\":\"100\",\"name\":\"Team\",\"sort\":0,\"status\":\"0\",\"email\":\"invalid\"}"})
    void invalidBodyDoesNotWrite(String body) throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        verify(departments, never()).insertDept(any());
    }
    @Test void createRequiresScopedActiveParentAndReturnsLocation() throws Exception
    {
        when(departments.insertDept(any())).thenAnswer(invocation -> { ((SysDept) invocation.getArgument(0)).setDeptId(200L); return 1; });
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated())
                .andExpect(header().string("Location", PATH + "/200")).andExpect(jsonPath("$.id").value("200"));
        verify(departments).checkDeptDataScope(100L);
        verify(departments).insertDept(argThat(row -> "admin".equals(row.getCreateBy()) && "".equals(row.getPhone())));
    }
    @Test void outOfScopeParentIsForbiddenBeforeWrite() throws Exception
    {
        doThrow(new ServiceException("Internal data scope diagnostic")).when(departments).checkDeptDataScope(100L);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        verify(departments, never()).insertDept(any());
    }
    @Test void selfAndDescendantParentsAreConflicts() throws Exception
    {
        mvc.perform(put(PATH + "/101").contentType(MediaType.APPLICATION_JSON).content(BODY.replace("100", "101")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_CYCLE"));
        mvc.perform(put(PATH + "/101").contentType(MediaType.APPLICATION_JSON).content(BODY.replace("100", "102")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_CYCLE"));
        verify(departments, never()).updateDept(any());
    }
    @Test void unchangedParentDoesNotRequireNewAccessToThatParent() throws Exception
    {
        doThrow(new ServiceException("Outside scope")).when(departments).checkDeptDataScope(100L);
        when(departments.updateDept(any())).thenReturn(1);
        mvc.perform(put(PATH + "/101").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isOk());
        verify(departments, never()).checkDeptDataScope(100L);
    }
    @Test void disableWithActiveChildrenAndProtectedDeletesAreConflicts() throws Exception
    {
        when(departments.selectNormalChildrenDeptById(101L)).thenReturn(1);
        mvc.perform(put(PATH + "/101").contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"status\":\"0\"", "\"status\":\"1\"")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_ACTIVE_CHILDREN"));
        when(departments.hasChildByDeptId(101L)).thenReturn(true);
        mvc.perform(delete(PATH + "/101")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_HAS_CHILDREN"));
        when(departments.checkDeptExistUser(102L)).thenReturn(true);
        mvc.perform(delete(PATH + "/102")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_HAS_USERS"));
        verify(departments, never()).deleteDeptById(anyLong());
    }
    @Test void sortChecksEveryRowBeforeCallingTransactionalService() throws Exception
    {
        doThrow(new ServiceException("Outside scope")).when(departments).checkDeptDataScope(102L);
        mvc.perform(put(PATH + "/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"101\",\"sort\":5},{\"id\":\"102\",\"sort\":6}]}"))
                .andExpect(status().isForbidden());
        verify(departments, never()).updateDeptSort(any(), any());
    }
    @Test void sortRejectsDuplicateIdsAndReturnsNoContentForValidBatch() throws Exception
    {
        mvc.perform(put(PATH + "/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"101\",\"sort\":5},{\"id\":\"101\",\"sort\":6}]}"))
                .andExpect(status().isBadRequest());
        verify(departments, never()).updateDeptSort(any(), any());
        mvc.perform(put(PATH + "/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"101\",\"sort\":5}]}"))
                .andExpect(status().isNoContent());
    }
    @Test void unauthorizedSessionCannotCallAnyDepartmentOperation() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L, 105L, new SysUser(), Set.of()));
        mvc.perform(get(PATH)).andExpect(status().isForbidden());
        mvc.perform(get(PATH + "/101")).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/101").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(delete(PATH + "/101")).andExpect(status().isForbidden());
        mvc.perform(put(PATH + "/sort").contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"id\":\"101\",\"sort\":5}]}"))
                .andExpect(status().isForbidden());
        verify(departments, never()).selectDeptList(any());
        verifyNoInteractions(mutations);
    }
    @Test void rootDeletionAndMissingMutationRootAreProtected() throws Exception
    {
        mvc.perform(delete(PATH + "/100")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_ROOT_PROTECTED"));
        when(mutations.lockRoot()).thenReturn(null);
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DEPARTMENT_ROOT_MISSING"));
        verify(departments, never()).insertDept(any());
    }
    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
