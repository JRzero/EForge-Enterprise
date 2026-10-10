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
@ContextConfiguration(classes={WorkflowReleaseController.class,PermissionService.class,ApiExceptionHandler.class,
    ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,WorkflowValidationControllerTest.Configuration.class})
class WorkflowReleaseControllerTest {
    static final String ID="00000000-0000-0000-0000-000000000001";
    static final String ROOT="/api/v1/workflow",PUBLISH=ROOT+"/packages/"+ID+"/releases",ACTIVE=ROOT+"/activations/leave";
    @Autowired MockMvc mvc;
    @MockitoBean WorkflowReleases releases;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    WorkflowReleases.Release release;
    @BeforeEach void prepare(){
        actor(Set.of("*:*:*"));
        release=new WorkflowReleases.Release(ID,ID,9007199254740993L,"已发布流程","leave","digest","definition",Instant.EPOCH);
        when(releases.publish(eq(ID),anyLong(),anyString())).thenReturn(release);
        when(releases.get(ID)).thenReturn(release);
        when(releases.activation("leave")).thenReturn(new WorkflowReleases.Activation("leave",null,0));
        when(releases.activate(eq("leave"),eq(ID),anyLong(),anyString())).thenReturn(new WorkflowReleases.Activation("leave",ID,9007199254740993L));
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("publisher");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void publicationAndActivationUseDifferentPermissionsAndAuthenticatedActor() throws Exception {
        actor(Set.of("workflow:definition:publish"));
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"9007199254740993\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.packageRevision").value("9007199254740993"));
        verify(releases).publish(ID,9007199254740993L,"2");
        mvc.perform(put(ACTIVE).contentType(MediaType.APPLICATION_JSON).content(activation("0"))).andExpect(status().isForbidden());
        actor(Set.of("workflow:definition:activate"));
        mvc.perform(put(ACTIVE).contentType(MediaType.APPLICATION_JSON).content(activation("0")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value("9007199254740993"));
        verify(releases).activate("leave",ID,0,"2");
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}")).andExpect(status().isForbidden());
    }
    @Test void listPermissionAllowsSafePagingButNotPublication() throws Exception {
        actor(Set.of("workflow:definition:list"));
        when(releases.list(ID,2,10)).thenReturn(new WorkflowReleases.Page(List.of(release),11));
        mvc.perform(get(PUBLISH).param("page","2")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(11))
            .andExpect(jsonPath("$.items[0].source").doesNotExist()).andExpect(jsonPath("$.items[0].packageRevision").value("9007199254740993"));
        mvc.perform(get(ROOT+"/releases/"+ID)).andExpect(status().isOk());
        mvc.perform(get(ACTIVE)).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value("0"));
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}")).andExpect(status().isForbidden());
    }
    @Test void invalidInputsAndNoRoleNeverReachEngineAdapter() throws Exception {
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"9999999999999999999\"}")).andExpect(status().isBadRequest());
        mvc.perform(get(PUBLISH).param("pageSize","101")).andExpect(status().isBadRequest());
        mvc.perform(put(ROOT+"/activations/unknown").contentType(MediaType.APPLICATION_JSON).content(activation("0"))).andExpect(status().isBadRequest());
        actor(Set.of());mvc.perform(get(PUBLISH)).andExpect(status().isForbidden());
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}")).andExpect(status().isForbidden());
        mvc.perform(put(ACTIVE).contentType(MediaType.APPLICATION_JSON).content(activation("0"))).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(ACTIVE)).andExpect(status().isUnauthorized());
        verifyNoInteractions(releases);
    }
    @Test void conflictAndStorageFaultKeepProblemContract() throws Exception {
        when(releases.publish(ID,1,"2")).thenThrow(new ApiFailure(409,"WORKFLOW_PROOF_REQUIRED","请先校验当前流程包版本。"));
        mvc.perform(post(PUBLISH).contentType(MediaType.APPLICATION_JSON).content("{\"expectedRevision\":\"1\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WORKFLOW_PROOF_REQUIRED"));
        when(releases.get(ID)).thenThrow(new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。"));
        mvc.perform(get(ROOT+"/releases/"+ID)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("WORKFLOW_STORAGE_UNAVAILABLE"));
    }
    private static String activation(String revision){return "{\"releaseId\":\""+ID+"\",\"expectedRevision\":\""+revision+"\"}";}
}
