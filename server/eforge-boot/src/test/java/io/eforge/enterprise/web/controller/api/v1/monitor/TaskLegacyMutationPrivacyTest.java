package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.quartz.controller.SysJobController;
import io.eforge.enterprise.quartz.service.ISysJobService;
import io.eforge.enterprise.quartz.task.RyTask;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={SysJobController.class,RyTask.class,PermissionService.class,GlobalExceptionHandler.class,
    SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,
    JwtAuthenticationTokenFilter.class,TaskLegacyMutationPrivacyTest.Configuration.class})
class TaskLegacyMutationPrivacyTest {
    @Autowired MockMvc mvc;
    @MockitoBean ISysJobService jobs;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    static final String BODY="{\"jobId\":811,\"jobName\":\"owned\",\"jobGroup\":\"SYSTEM\",\"invokeTarget\":\"ryTask.ryNoParams()\",\"cronExpression\":\"0 0 0 1 1 ? 2099\",\"misfirePolicy\":\"3\",\"concurrent\":\"1\",\"status\":\"1\"}";
    @BeforeEach void setup(){actor(Set.of("*:*:*"));}
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("owned_actor");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void allFiveMutationErrorsRetainCompatibilityEnvelopeWithoutSqlOrSchedulerSecrets() throws Exception {
        var sql=new org.springframework.dao.DataAccessResourceFailureException("private JDBC SQL credential");
        when(jobs.insertJob(any())).thenThrow(sql);when(jobs.updateJob(any())).thenThrow(sql);
        when(jobs.changeStatus(any())).thenThrow(new org.quartz.SchedulerException("private Quartz scheduler path"));
        when(jobs.run(any())).thenThrow(new org.springframework.transaction.TransactionSystemException("private commit driver"));
        doThrow(sql).when(jobs).deleteJobByIds(any());
        for(var request:List.of(post("/monitor/job"),put("/monitor/job"),put("/monitor/job/changeStatus"),put("/monitor/job/run"),delete("/monitor/job/811")))
            mvc.perform(request.contentType("application/json").content(BODY)).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.msg").value("定时任务操作暂时不可用，请稍后重试。"));
    }
    @Test void statusControllerPassesOnlyRequestToGuardedServiceAndUsesAuthenticatedActor() throws Exception {
        when(jobs.changeStatus(any())).thenReturn(1);
        mvc.perform(put("/monitor/job/changeStatus").contentType("application/json").content(BODY)).andExpect(jsonPath("$.code").value(200));
        var captured=org.mockito.ArgumentCaptor.forClass(io.eforge.enterprise.quartz.domain.SysJob.class);verify(jobs).changeStatus(captured.capture());
        assertEquals("owned_actor",captured.getValue().getUpdateBy());verify(jobs,never()).selectJobById(any());
    }
    @Test void noRoleCannotReachAnyMutation() throws Exception {
        actor(Set.of());
        for(var request:List.of(post("/monitor/job"),put("/monitor/job"),put("/monitor/job/changeStatus"),put("/monitor/job/run"),delete("/monitor/job/811")))
            mvc.perform(request.contentType("application/json").content(BODY)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        verifyNoInteractions(jobs);
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
