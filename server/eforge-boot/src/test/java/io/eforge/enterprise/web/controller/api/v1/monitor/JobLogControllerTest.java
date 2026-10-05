package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import java.time.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import io.eforge.enterprise.quartz.mapper.SysJobLogMapper;
import io.eforge.enterprise.quartz.domain.SysJobLog;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={JobLogController.class,JobLogService.class,CronPreviewController.class,PermissionService.class,
        ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,JobLogControllerTest.Configuration.class})
class JobLogControllerTest
{
    static final String PATH="/api/v1/monitor/job-logs",CRON="/api/v1/monitor/jobs/cron-preview";
    @Autowired MockMvc mvc;
    @MockitoBean SysJobLogMapper mapper;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare() {
        actor(Set.of("*:*:*"));var row=new SysJobLog();row.setJobLogId(9007199254740993L);row.setJobName("任务中文");row.setJobGroup("SYSTEM");
        row.setInvokeTarget("ryTask.ryParams('中文')");row.setStatus("1");row.setExceptionInfo("<script>failure text</script>");
        row.setCreateTime(Date.from(Instant.parse("2026-10-05T00:00:00Z")));
        when(mapper.selectJobLogList(any())).thenReturn(List.of(row));when(mapper.selectJobLogById(row.getJobLogId())).thenReturn(row);
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void typedProjectionAndPrivilegedDetailKeepLegacyFieldsBehindBoundary() throws Exception {
        actor(Set.of("monitor:job:list"));mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("9007199254740993"))
            .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-05T00:00:00Z")).andExpect(jsonPath("$.items[0].exceptionInfo").doesNotExist())
            .andExpect(jsonPath("$.rows").doesNotExist()).andExpect(jsonPath("$.pageSize").value(10));
        mvc.perform(get(PATH+"/9007199254740993")).andExpect(status().isForbidden());
        actor(Set.of("monitor:job:query"));mvc.perform(get(PATH+"/9007199254740993")).andExpect(status().isOk()).andExpect(jsonPath("$.exceptionInfo").value("<script>failure text</script>"));
        assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @ParameterizedTest @ValueSource(strings={"page=0","pageSize=101","status=2","direction=drop","from=2026-10-06&to=2026-10-05","from=invalid"})
    void rejectsInvalidQueryWithoutSql(String query) throws Exception {
        mvc.perform(get(PATH+"?"+query)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));verifyNoInteractions(mapper);
    }
    @Test void mutationsNeedOriginalRemoveGrantAndClearPreservesIdentifiers() throws Exception {
        actor(Set.of("monitor:job:remove"));mvc.perform(delete(PATH).contentType("application/json").content("{\"ids\":[\"9007199254740993\",\"9007199254740993\"]}")).andExpect(status().isNoContent());
        verify(mapper).deleteJobLogByIds(org.mockito.AdditionalMatchers.aryEq(new Long[]{9007199254740993L}));
        mvc.perform(post(PATH+"/clear")).andExpect(status().isNoContent());verify(mapper).deleteAllJobLogs();verify(mapper,never()).cleanJobLog();
        mvc.perform(delete(PATH).contentType("application/json").content("{\"ids\":[\"9223372036854775808\"]}")).andExpect(status().isBadRequest());
    }
    @Test void noRoleAndAnonymousAreDeniedEveryOperation() throws Exception {
        for(boolean anonymous:List.of(false,true)) {
            if(anonymous)when(tokens.getLoginUser(any())).thenReturn(null);else actor(Set.of());int expected=anonymous?401:403;
            for(var request:List.of(get(PATH),get(PATH+"/1"),post(PATH+"/export"),post(PATH+"/clear"),delete(PATH).contentType("application/json").content("{\"ids\":[\"1\"]}"),get(CRON).param("expression","0 * * * * ?")))
                mvc.perform(request).andExpect(status().is(expected));
        }
        verifyNoInteractions(mapper);
    }
    @Test void sqlFaultDoesNotLeavePagingStateAndMissingDetailHasTyped404() throws Exception {
        when(mapper.selectJobLogList(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private sql"));
        mvc.perform(get(PATH)).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private sql"))));
        assertNull(com.github.pagehelper.PageHelper.getLocalPage());mvc.perform(get(PATH+"/1")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("JOB_LOG_NOT_FOUND"));
    }
    @Test void cronPreviewUsesAnyEditorOrDetailGrantAndQuartzValidation() throws Exception {
        for(String grant:List.of("monitor:job:add","monitor:job:edit","monitor:job:query")) {actor(Set.of(grant));mvc.perform(get(CRON).param("expression","0 * * * * ?")).andExpect(status().isOk()).andExpect(jsonPath("$.times.length()").value(5));}
        mvc.perform(get(CRON).param("expression","invalid")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("JOB_CRON_INVALID"));
        mvc.perform(get(CRON).param("expression","")).andExpect(status().isBadRequest());actor(Set.of("monitor:job:list"));mvc.perform(get(CRON).param("expression","0 * * * * ?")).andExpect(status().isForbidden());
    }
    @Test void actualQuartzSupportsSpecialDatesTimezoneAndExhaustedYear() {
        var clock=Clock.fixed(Instant.parse("2026-10-05T00:00:00Z"),ZoneId.of("Asia/Shanghai"));var controller=new CronPreviewController(clock);
        var preview=controller.preview(new CronPreviewController.CronPreviewQuery("0 0 9 ? * MON#2"));assertEquals("Asia/Shanghai",preview.zone());assertEquals(Instant.parse("2026-10-12T01:00:00Z"),preview.times().get(0));
        assertEquals(5,controller.preview(new CronPreviewController.CronPreviewQuery("0 0 0 L * ?")).times().size());
        assertTrue(controller.preview(new CronPreviewController.CronPreviewQuery("0 0 0 1 1 ? 2020")).times().isEmpty());
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}
