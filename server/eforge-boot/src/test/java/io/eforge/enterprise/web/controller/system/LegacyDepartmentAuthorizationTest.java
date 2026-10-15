package io.eforge.enterprise.web.controller.system;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.web.controller.api.v1.system.DepartmentController;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real canonical/legacy HTTP and method-security boundaries; native probes cover actual SQL/data scope. */
@WebMvcTest
@ContextConfiguration(classes = {SysDeptController.class, DepartmentController.class, PermissionService.class,
        ApiExceptionHandler.class, GlobalExceptionHandler.class, ApiRoutingExceptionResolver.class,
        SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class, AuthenticationEntryPointImpl.class,
        JwtAuthenticationTokenFilter.class, LegacyDepartmentAuthorizationTest.Configuration.class})
class LegacyDepartmentAuthorizationTest
{
    private static final String LEGACY = "/system/dept";
    private static final String CANONICAL = "/api/v1/system/departments";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean ISysDeptService departments;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    private final Map<Long, SysDept> rows = new LinkedHashMap<>();

    @BeforeEach void setup()
    {
        rows.clear();
        rows.put(100L, row(100, 0, "0"));
        rows.put(101L, row(101, 100, "0,100"));
        rows.put(102L, row(102, 100, "0,100"));
        rows.put(103L, row(103, 101, "0,100,101"));
        rows.put(104L, row(104, 101, "0,100,101"));
        rows.put(108L, row(108, 102, "0,100,102"));
        actor(Set.of("system:dept:add", "system:dept:edit", "system:dept:remove"));
        when(mutex.lockRoot()).thenReturn(100L);
        when(departments.checkDeptNameUnique(any())).thenReturn(true);
        when(departments.selectDeptList(any())).thenAnswer(call -> {
            SysDept filter = call.getArgument(0);
            return rows.values().stream().filter(row -> filter.getDeptId() == null || filter.getDeptId().equals(row.getDeptId())).toList();
        });
        when(departments.selectDeptById(anyLong())).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(departments.insertDept(any())).thenReturn(1);
        when(departments.updateDept(any())).thenReturn(1);
        when(departments.deleteDeptById(anyLong())).thenReturn(1);
    }

    @Test void bothRoutesRejectChangingTheParentToAnOutsideDepartment() throws Exception
    {
        outside(102);
        mvc.perform(put(CANONICAL + "/103").contentType(MediaType.APPLICATION_JSON).content(canonical(102)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(103, 102)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("没有权限访问部门数据！"));
        noWrites();
    }

    @Test void bothRoutesRejectMovingAnAncestorBelowItsOwnDescendant() throws Exception
    {
        mvc.perform(put(CANONICAL + "/101").contentType(MediaType.APPLICATION_JSON).content(canonical(103)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPARTMENT_CYCLE"));
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(101, 103)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("修改部门'Team'失败，上级部门不能是子部门"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(longs = {0, 999999})
    void inventedParentCannotCarryAncestorsThatEnableOutsideDepartments(long parent) throws Exception
    {
        var input = input(103, parent); input.put("ancestors", "0,100,102");
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.msg").value("部门不存在"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"null", "0", "-1"})
    void absentOrInvalidTargetCannotBypassTheScopedLookup(String id) throws Exception
    {
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON)
                .content(body(103, 101).replace("\"deptId\":103", "\"deptId\":" + id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"unchanged", "null", "omitted"})
    void unchangedParentOutsideCurrentScopeRemainsEditable(String kind) throws Exception
    {
        outside(101);
        var input = input(103, 101);
        if (kind.equals("null")) input.put("parentId", null);
        if (kind.equals("omitted")) input.remove("parentId");
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments, never()).checkDeptDataScope(101L);
        verify(departments).updateDept(argThat(dept -> Long.valueOf(101).equals(dept.getParentId())));
    }

    @Test void updateProjectsOnlyEditableFieldsAndTheAuthenticatedActor() throws Exception
    {
        var input = input(103, 101); hostileDerivedFields(input);
        input.put("leader", ""); input.put("phone", null); input.put("email", "team@example.test");
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments).updateDept(argThat(dept -> {
            assertDerivedFieldsAbsent(dept);
            assertEquals(103L, dept.getDeptId()); assertEquals(101L, dept.getParentId());
            assertEquals("editor", dept.getUpdateBy()); assertNull(dept.getCreateBy());
            assertEquals("", dept.getLeader()); assertNull(dept.getPhone()); assertEquals("team@example.test", dept.getEmail());
            return true;
        }));
    }

    @Test void rootParentZeroMayRemainWithoutAcceptingInjectedAncestors() throws Exception
    {
        var input = input(100, 0); input.put("ancestors", "0,100,102");
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments).updateDept(argThat(dept -> dept.getAncestors() == null && Long.valueOf(0).equals(dept.getParentId())));
    }

    @Test void aDeletedTargetCannotBeUpdatedEvenWhenAnUnscopedLookupFindsIt() throws Exception
    {
        SysDept deleted = rows.remove(103L);
        when(departments.selectDeptById(103L)).thenReturn(deleted);
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(103, 101)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404));
        noWrites();
    }

    @Test void createRequiresScopedExistingParentAtBothHttpBoundaries() throws Exception
    {
        outside(102);
        mvc.perform(post(CANONICAL).contentType(MediaType.APPLICATION_JSON).content(canonical(102)))
                .andExpect(status().isForbidden());
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(777, 102)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("没有权限访问部门数据！"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(longs = {0, 999999})
    void createRejectsMissingParentBeforeInvokingTheLegacyService(long parent) throws Exception
    {
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(777, parent)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404));
        noWrites();
    }

    @Test void createIgnoresTheRequestedIdentityDerivedFieldsAndForgedActors() throws Exception
    {
        var input = input(103, 101); hostileDerivedFields(input);
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments).checkDeptNameUnique(argThat(dept -> dept.getDeptId() == null));
        verify(departments).insertDept(argThat(dept -> {
            assertDerivedFieldsAbsent(dept); assertNull(dept.getDeptId());
            assertEquals("editor", dept.getCreateBy()); assertNull(dept.getUpdateBy()); return true;
        }));
    }

    @Test void createKeepsTheOriginalDisabledParentMessage() throws Exception
    {
        rows.get(101L).setStatus("1");
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(777, 101)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("部门停用，不允许新增"));
        noWrites();
    }

    @Test void sortPreflightsTheEntireSelectionBeforeAnyWriteAtBothBoundaries() throws Exception
    {
        outside(108);
        mvc.perform(put(CANONICAL + "/sort").contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"id\":\"103\",\"sort\":8},{\"id\":\"108\",\"sort\":9}]}"))
                .andExpect(status().isForbidden());
        mvc.perform(put(LEGACY + "/updateSort").contentType(MediaType.APPLICATION_JSON)
                .content("{\"deptIds\":\"103,108\",\"orderNums\":\"8,9\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("没有权限访问部门数据！"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"deptIds\":\"103,104\",\"orderNums\":\"8\"}",
            "{\"deptIds\":\"103,103\",\"orderNums\":\"8,9\"}", "{\"deptIds\":\"103,0\",\"orderNums\":\"8,9\"}",
            "{\"deptIds\":\"103,104\",\"orderNums\":\"8,bad\"}"})
    void invalidSortNeverStartsTheLegacyWriteLoop(String input) throws Exception
    {
        mvc.perform(put(LEGACY + "/updateSort").contentType(MediaType.APPLICATION_JSON).content(input))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value("保存排序异常，请联系管理员"));
        noWrites();
    }

    @Test void validSortPreservesTheLegacyPayloadAndSuccessEnvelope() throws Exception
    {
        mvc.perform(put(LEGACY + "/updateSort").contentType(MediaType.APPLICATION_JSON)
                .content("{\"deptIds\":\"103,104\",\"orderNums\":\"8,9\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments).checkDeptDataScope(103L); verify(departments).checkDeptDataScope(104L);
        verify(departments).updateDeptSort(new String[] {"103", "104"}, new String[] {"8", "9"});
    }

    @Test void sortPreservesTheExactLongIdentifierAboveJavascriptPrecision() throws Exception
    {
        long id = 9007199254740993L; rows.put(id, row(id, 101, "0,100,101"));
        mvc.perform(put(LEGACY + "/updateSort").contentType(MediaType.APPLICATION_JSON)
                .content("{\"deptIds\":\"9007199254740993\",\"orderNums\":\"9\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(departments).checkDeptDataScope(id);
        verify(departments).updateDeptSort(new String[] {"9007199254740993"}, new String[] {"9"});
    }

    @Test void deleteChecksScopeBeforeProbingTheTargetsUsersOrChildren() throws Exception
    {
        outside(108); when(departments.hasChildByDeptId(108L)).thenReturn(true);
        mvc.perform(delete(LEGACY + "/108")).andExpect(status().isOk())
                .andExpect(jsonPath("$.msg").value("没有权限访问部门数据！"));
        verify(departments, never()).hasChildByDeptId(108L);
        verify(departments, never()).checkDeptExistUser(108L); noWrites();
    }

    @Test void rootAndMissingDepartmentsCannotBeDeleted() throws Exception
    {
        mvc.perform(delete(LEGACY + "/100")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(601))
                .andExpect(jsonPath("$.msg").value("根部门不允许删除"));
        mvc.perform(delete(LEGACY + "/999999")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404));
        noWrites();
    }

    @Test void originalSelfActiveChildAndDeleteMessagesRemainIntact() throws Exception
    {
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(103, 103)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("修改部门'Team'失败，上级部门不能是自己"));
        when(departments.selectNormalChildrenDeptById(103L)).thenReturn(1);
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(103, 101).replace("\"status\":\"0\"", "\"status\":\"1\"")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("该部门包含未停用的子部门！"));
        when(departments.hasChildByDeptId(103L)).thenReturn(true);
        mvc.perform(delete(LEGACY + "/103")).andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("存在下级部门,不允许删除"));
        when(departments.checkDeptExistUser(104L)).thenReturn(true);
        mvc.perform(delete(LEGACY + "/104")).andExpect(status().isOk()).andExpect(jsonPath("$.msg").value("部门存在用户,不允许删除"));
        noWrites();
    }

    @Test void methodPermissionsStillRejectAllFourWritesBeforeTheMutex() throws Exception
    {
        actor(Set.of());
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(777, 101))).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        mvc.perform(put(LEGACY).contentType(MediaType.APPLICATION_JSON).content(body(103, 101))).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        mvc.perform(delete(LEGACY + "/103")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        mvc.perform(put(LEGACY + "/updateSort").contentType(MediaType.APPLICATION_JSON).content("{\"deptIds\":\"103\",\"orderNums\":\"8\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        verifyNoInteractions(mutex, departments);
    }

    private void actor(Set<String> permissions)
    {
        SysUser user = new SysUser(9L); user.setUserName("editor");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(9L, 101L, user, permissions));
    }
    private void outside(long id)
    { doThrow(new ServiceException("没有权限访问部门数据！")).when(departments).checkDeptDataScope(id); }
    private void noWrites()
    {
        verify(departments, never()).insertDept(any()); verify(departments, never()).updateDept(any());
        verify(departments, never()).updateDeptSort(any(), any()); verify(departments, never()).deleteDeptById(anyLong());
    }
    private static void assertDerivedFieldsAbsent(SysDept dept)
    {
        assertNull(dept.getAncestors()); assertNull(dept.getParentName()); assertNull(dept.getDelFlag());
        assertNull(dept.getCreateTime()); assertNull(dept.getUpdateTime()); assertTrue(dept.getChildren().isEmpty());
        assertTrue(dept.getParams().isEmpty());
    }
    private static void hostileDerivedFields(Map<String, Object> input)
    {
        input.put("ancestors", "0,100,102"); input.put("parentName", "forged"); input.put("delFlag", "2");
        input.put("createBy", "other-admin"); input.put("updateBy", "other-admin");
        input.put("createTime", "2020-01-01 00:00:00"); input.put("updateTime", "2020-01-01 00:00:00");
        input.put("children", List.of(Map.of("deptId", 102))); input.put("params", Map.of("dataScope", "forged"));
    }
    private String body(long id, long parent) throws Exception { return json.writeValueAsString(input(id, parent)); }
    private static Map<String, Object> input(long id, long parent)
    {
        Map<String, Object> input = new LinkedHashMap<>(); input.put("deptId", id); input.put("parentId", parent);
        input.put("deptName", "Team"); input.put("orderNum", 1); input.put("status", "0"); return input;
    }
    private static String canonical(long parent)
    { return "{\"parentId\":\"" + parent + "\",\"name\":\"Team\",\"sort\":1,\"status\":\"0\"}"; }
    private static SysDept row(long id, long parent, String ancestors)
    {
        SysDept row = new SysDept(); row.setDeptId(id); row.setParentId(parent); row.setAncestors(ancestors);
        row.setDeptName("Team"); row.setOrderNum(1); row.setStatus("0"); return row;
    }
    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
