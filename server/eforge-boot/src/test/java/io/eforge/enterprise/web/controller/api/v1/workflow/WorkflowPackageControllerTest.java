package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.workflow.api.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={WorkflowPackageController.class,PermissionService.class,ApiExceptionHandler.class,
    ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,WorkflowValidationControllerTest.Configuration.class})
class WorkflowPackageControllerTest {
    static final String ID="00000000-0000-0000-0000-000000000001";
    static final String PATH="/api/v1/workflow/packages";
    static final String BODY="{\"name\":\"审批草稿\",\"businessType\":\"leave\",\"source\":"+WorkflowValidationControllerTest.BODY+"}";
    @Autowired MockMvc mvc;
    @MockitoBean WorkflowPackages packages;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    WorkflowPackages.Draft draft;
    @BeforeEach void prepare() {
        actor(Set.of("*:*:*"));
        draft=new WorkflowPackages.Draft(ID,"审批草稿","leave",9007199254740993L,"digest",null,
            new WorkflowValidation.Request("<draft/>",List.of(new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"))),Instant.parse("2026-10-09T00:00:00Z"));
        when(packages.get(ID)).thenReturn(draft); when(packages.create(any(),anyString())).thenReturn(draft);
        when(packages.update(eq(ID),anyLong(),any(),anyString())).thenReturn(draft); when(packages.validate(eq(ID),anyLong(),anyString())).thenReturn(draft);
    }
    void actor(Set<String> grants) {
        var user=new SysUser(2L);user.setUserName("editor");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));
    }
    @Test void createUsesAuthenticatedActorAndReturnsCanonicalLocationAndExactRevision() throws Exception {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isCreated()).andExpect(header().string("Location",PATH+"/"+ID))
            .andExpect(jsonPath("$.revision").value("9007199254740993")).andExpect(jsonPath("$.data").doesNotExist());
        verify(packages).create(argThat(edit -> edit.name().equals("审批草稿") && edit.source().scenarios().get(0).decisions().get(0).approved()),eq("2"));
    }
    @Test void updateAndValidationCarryExactRevisionAndIndependentPermissions() throws Exception {
        actor(Set.of("workflow:definition:edit"));
        mvc.perform(put(PATH+"/"+ID).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"9007199254740993\",\"content\":"+BODY+"}"))
            .andExpect(status().isOk());
        verify(packages).update(eq(ID),eq(9007199254740993L),any(),eq("2"));
        mvc.perform(post(PATH+"/"+ID+"/validation").contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}"))
            .andExpect(status().isForbidden());
        actor(Set.of("workflow:definition:validate"));
        mvc.perform(post(PATH+"/"+ID+"/validation").contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.source").doesNotExist());
        verify(packages).validate(ID,1,"2");
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
    }
    @Test void unauthorizedOperationsNeverReachStore() throws Exception {
        actor(Set.of()); clearInvocations(packages);
        mvc.perform(get(PATH)).andExpect(status().isForbidden());
        mvc.perform(get(PATH+"/"+ID)).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/"+ID).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\",\"content\":"+BODY+"}")).andExpect(status().isForbidden());
        mvc.perform(post(PATH+"/"+ID+"/validation").contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}")).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        verifyNoInteractions(packages);
    }
    @Test void oversizedRevisionAndUnregisteredBusinessNeverReachStore() throws Exception {
        mvc.perform(post(PATH+"/"+ID+"/validation").contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"9999999999999999999\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("\"leave\"","\"dynamic-component\""))).andExpect(status().isBadRequest());
        verifyNoInteractions(packages);
    }
    @Test void listIsPagedAndStorageConflictIsSafe() throws Exception {
        when(packages.list(2,10)).thenReturn(new WorkflowPackages.Page(List.of(new WorkflowPackages.Summary(ID,"审批","leave",1,null,Instant.EPOCH)),11));
        mvc.perform(get(PATH).param("page","2")).andExpect(status().isOk()).andExpect(jsonPath("$.page").value(2))
            .andExpect(jsonPath("$.total").value(11)).andExpect(jsonPath("$.items[0].revision").value("1"));
        when(packages.get(ID)).thenThrow(new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。"));
        mvc.perform(get(PATH+"/"+ID)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("WORKFLOW_STORAGE_UNAVAILABLE"));
    }
}
