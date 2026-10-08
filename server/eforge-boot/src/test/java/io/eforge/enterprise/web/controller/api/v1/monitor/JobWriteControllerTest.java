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
import io.eforge.enterprise.quartz.service.ISysJobService;
import io.eforge.enterprise.quartz.task.RyTask;
import io.eforge.enterprise.quartz.domain.SysJob;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={JobWriteController.class,JobWriteService.class,RyTask.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,JobWriteControllerTest.Configuration.class})
class JobWriteControllerTest {
    static final String PATH="/api/v1/monitor/jobs";
    static final String BODY="{\"name\":\"owned\",\"group\":\"SYSTEM\",\"invokeTarget\":\"ryTask.ryNoParams()\",\"cronExpression\":\"0 0 0 1 1 ? 2099\",\"misfirePolicy\":\"3\",\"concurrent\":false,\"status\":\"1\",\"remark\":\"\"}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysJobService jobs;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void setup() throws Exception {
        actor(Set.of("*:*:*"));when(jobs.insertJob(any())).thenAnswer(call->{SysJob row=call.getArgument(0);row.setJobId(9007199254740993L);return 1;});
        when(jobs.updateJob(any())).thenReturn(1);when(jobs.changeStatus(any())).thenReturn(1);when(jobs.run(any())).thenReturn(true);
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("owned_actor");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void concreteCreateUsesExactStringIdLocationAndAuthenticatedActorWithoutQueryGrant() throws Exception {
        actor(Set.of("monitor:job:add"));mvc.perform(post(PATH).contentType("application/json").content(BODY)).andExpect(status().isCreated())
            .andExpect(header().string("Location",PATH+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993"))
            .andExpect(jsonPath("$.code").doesNotExist()).andExpect(jsonPath("$.params").doesNotExist());
        var captured=org.mockito.ArgumentCaptor.forClass(SysJob.class);verify(jobs).insertJob(captured.capture());
        assertEquals("owned_actor",captured.getValue().getCreateBy());assertEquals("1",captured.getValue().getConcurrent());assertEquals("",captured.getValue().getRemark());
        verify(jobs,never()).selectJobById(any());
    }
    @Test void updateStatusRunAndDeleteRetainOriginalGrantsAndHttpSemantics() throws Exception {
        actor(Set.of("monitor:job:edit"));mvc.perform(put(PATH+"/9007199254740993").contentType("application/json").content(BODY)).andExpect(status().isNoContent());
        actor(Set.of("monitor:job:changeStatus"));mvc.perform(put(PATH+"/811/status").contentType("application/json").content("{\"status\":\"0\"}")).andExpect(status().isNoContent());
        mvc.perform(post(PATH+"/811/run")).andExpect(status().isAccepted());
        actor(Set.of("monitor:job:remove"));mvc.perform(delete(PATH).contentType("application/json").content("{\"ids\":[\"811\",\"811\",\"9007199254740993\"]}")).andExpect(status().isNoContent());
        verify(jobs).deleteJobByIds(argThat(ids->Arrays.equals(ids,new Long[]{811L,9007199254740993L})));
        var captured=org.mockito.ArgumentCaptor.forClass(SysJob.class);verify(jobs).updateJob(captured.capture());assertEquals(9007199254740993L,captured.getValue().getJobId());assertEquals("owned_actor",captured.getValue().getUpdateBy());
    }
    @Test void listQueryOrNoRoleGrantCannotMutateBeforeServiceAccess() throws Exception {
        for(Set<String> grants:List.of(Set.<String>of(),Set.of("monitor:job:list","monitor:job:query"))) {
            actor(grants);
            for(var request:List.of(post(PATH).contentType("application/json").content(BODY),put(PATH+"/811").contentType("application/json").content(BODY),
                put(PATH+"/811/status").contentType("application/json").content("{\"status\":\"1\"}"),post(PATH+"/811/run"),delete(PATH).contentType("application/json").content("{\"ids\":[\"811\"]}")))
                mvc.perform(request).andExpect(status().isForbidden());
        }
        verifyNoInteractions(jobs);
    }
    @Test void invalidShapeCronTargetOrIdentifiersAreSafeAndNeverReachMutation() throws Exception {
        for(String body:List.of(BODY.replace("\"owned\"","\" \""),BODY.replace("\"3\"","\"9\""),BODY.replace("ryTask.ryNoParams()","ryTask.getClass()"),
            BODY.replace("ryTask.ryNoParams()","java.lang.Runtime.getRuntime()"),BODY.replace("ryTask.ryNoParams()","ryTask.missingMethod()"),BODY.replace("0 0 0 1 1 ? 2099","invalid")))
            mvc.perform(post(PATH).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        for(String id:List.of("0","-1","9223372036854775808","811x"))mvc.perform(post(PATH+"/"+id+"/run")).andExpect(status().isBadRequest());
        mvc.perform(delete(PATH).contentType("application/json").content("{\"ids\":[\"811\",\"overflow\"]}")).andExpect(status().isBadRequest());
        verifyNoInteractions(jobs);
    }
    @Test void allowedLiteralArgumentsRemainInertAndPackageClassMethodValidationDoesNotInvoke() throws Exception {
        String target="ryTask.ryMultipleParams('中文,(http://data)/${inert}',true,9007199254740993L,1.25D,-2)";
        mvc.perform(post(PATH).contentType("application/json").content(BODY.replace("ryTask.ryNoParams()",target))).andExpect(status().isCreated());
        var captured=org.mockito.ArgumentCaptor.forClass(SysJob.class);verify(jobs).insertJob(captured.capture());assertEquals(target,captured.getValue().getInvokeTarget());
    }
    @Test void missingExpiredAndSqlSchedulerFailuresHaveSafeTypedProblems() throws Exception {
        when(jobs.updateJob(any())).thenReturn(0);mvc.perform(put(PATH+"/811").contentType("application/json").content(BODY)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("JOB_NOT_FOUND"));
        when(jobs.run(any())).thenReturn(false);mvc.perform(post(PATH+"/811/run")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("JOB_NOT_RUNNABLE"));
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("private SQL driver")).when(jobs).insertJob(any());
        mvc.perform(post(PATH).contentType("application/json").content(BODY)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("JOB_SCHEDULE_UNAVAILABLE"))
            .andExpect(jsonPath("$.detail").value("Task scheduling is temporarily unavailable."));
        when(jobs.changeStatus(any())).thenThrow(new org.quartz.SchedulerException("private scheduler"));
        mvc.perform(put(PATH+"/811/status").contentType("application/json").content("{\"status\":\"0\"}")).andExpect(status().isServiceUnavailable());
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
