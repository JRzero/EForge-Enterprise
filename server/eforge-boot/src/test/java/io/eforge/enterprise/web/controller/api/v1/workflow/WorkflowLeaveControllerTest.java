package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.*;
import java.time.*;
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
@ContextConfiguration(classes={WorkflowLeaveController.class,PermissionService.class,ApiExceptionHandler.class,
    ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,WorkflowValidationControllerTest.Configuration.class})
class WorkflowLeaveControllerTest {
    static final String ID="00000000-0000-0000-0000-000000000001",ROOT="/api/v1/workflow/leaves";
    static final String SUBMIT="{\"submissionId\":\""+ID+"\",\"startDate\":\"2026-11-01\",\"endDate\":\"2026-11-02\",\"reason\":\"家庭事务\",\"actor\":\"1\"}";
    static final String COMMAND="{\"commandId\":\""+ID+"\",\"expectedRevision\":\"9007199254740993\",\"taskId\":\"task1\",\"comment\":\"意见\"}";
    @Autowired MockMvc mvc;
    @MockitoBean WorkflowLeaves leaves;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    WorkflowLeaves.Leave row;
    @BeforeEach void prepare(){actor(Set.of("*:*:*"));row=new WorkflowLeaves.Leave(ID,ID,"2",ID,"instance",LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"家庭事务","PENDING",9007199254740993L,Instant.EPOCH);}
    void actor(Set<String> permissions){var user=new SysUser();user.setUserId(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,permissions));}
    @Test void submissionUsesAuthenticatedActorAndPreservesExactRevision()throws Exception{
        actor(Set.of("workflow:request:submit"));when(leaves.submit(any(),eq("2"))).thenReturn(row);
        mvc.perform(post(ROOT).contentType(MediaType.APPLICATION_JSON).content(SUBMIT)).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value("9007199254740993"));
        verify(leaves).submit(new WorkflowLeaves.Submit(ID,LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"家庭事务"),"2");
        mvc.perform(post(ROOT+"/"+ID+"/claim").contentType(MediaType.APPLICATION_JSON).content(COMMAND)).andExpect(status().isForbidden());
    }
    @Test void handlingCannotImpersonateInitiatorAndUsesSeparateWithdrawalPermission()throws Exception{
        actor(Set.of("workflow:task:handle"));when(leaves.claim(anyString(),any(),eq("2"))).thenReturn(row);when(leaves.decide(anyString(),any(),eq(false),eq("2"))).thenReturn(row);
        mvc.perform(post(ROOT+"/"+ID+"/claim").contentType(MediaType.APPLICATION_JSON).content(COMMAND)).andExpect(status().isOk());
        verify(leaves).claim(ID,new WorkflowLeaves.Command(ID,9007199254740993L,"task1","意见"),"2");
        mvc.perform(post(ROOT+"/"+ID+"/decision").contentType(MediaType.APPLICATION_JSON).content("{\"command\":"+COMMAND+",\"approved\":false}")).andExpect(status().isOk());
        mvc.perform(post(ROOT+"/"+ID+"/withdrawal").contentType(MediaType.APPLICATION_JSON).content(COMMAND.replace("\"task1\"","null"))).andExpect(status().isForbidden());
        actor(Set.of("workflow:request:withdraw"));when(leaves.withdraw(anyString(),any(),eq("2"))).thenReturn(row);
        mvc.perform(post(ROOT+"/"+ID+"/withdrawal").contentType(MediaType.APPLICATION_JSON).content(COMMAND.replace("\"task1\"","null"))).andExpect(status().isOk());
    }
    @Test void queriesAreActorScopedAndTaskListDoesNotGrantInitiatorList()throws Exception{
        actor(Set.of("workflow:task:list"));when(leaves.pending("2",2,10)).thenReturn(new WorkflowLeaves.Page<>(List.of(new WorkflowLeaves.Pending(row,new WorkflowLeaves.Task("task1","review","审批",null,true),true)),11));
        mvc.perform(get(ROOT+"/pending").param("page","2")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(11)).andExpect(jsonPath("$.items[0].canHandle").value(true));
        mvc.perform(get(ROOT+"/mine")).andExpect(status().isForbidden());
        when(leaves.get(ID,"2")).thenThrow(new ApiFailure(404,"WORKFLOW_LEAVE_NOT_FOUND","不可访问"));
        mvc.perform(get(ROOT+"/"+ID)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("WORKFLOW_LEAVE_NOT_FOUND"));
    }
    @Test void invalidAndUnauthenticatedRequestsNeverReachAdapter()throws Exception{
        mvc.perform(post(ROOT).contentType(MediaType.APPLICATION_JSON).content(SUBMIT.replace("2026-11-01","bad-date"))).andExpect(status().isBadRequest());
        mvc.perform(post(ROOT+"/"+ID+"/claim").contentType(MediaType.APPLICATION_JSON).content(COMMAND.replace("9007199254740993","9999999999999999999"))).andExpect(status().isBadRequest());
        actor(Set.of());mvc.perform(post(ROOT).contentType(MediaType.APPLICATION_JSON).content(SUBMIT)).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(ROOT+"/mine")).andExpect(status().isUnauthorized());verifyNoInteractions(leaves);
    }
}
