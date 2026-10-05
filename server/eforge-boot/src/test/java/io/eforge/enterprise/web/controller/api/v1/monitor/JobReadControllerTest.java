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
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.domain.SysJob;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={JobReadController.class,JobReadService.class,PermissionService.class,
    ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
    AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,JobReadControllerTest.Configuration.class})
class JobReadControllerTest {
    static final String PATH="/api/v1/monitor/jobs";
    @Autowired MockMvc mvc;
    @MockitoBean SysJobMapper mapper;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare() {
        actor(Set.of("*:*:*"));var row=new SysJob();row.setJobId(9007199254740993L);row.setJobName("任务中文");row.setJobGroup("SYSTEM");
        row.setInvokeTarget("ryTask.ryParams('中文')");row.setCronExpression("0 0 0 1 1 ? 2099");row.setConcurrent("1");row.setStatus("1");
        row.setCreateTime(Date.from(Instant.parse("2026-10-05T00:00:00Z")));row.setRemark("<script>inert text</script>");
        when(mapper.selectJobList(any())).thenReturn(List.of(row));when(mapper.selectJobById(row.getJobId())).thenReturn(row);
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void listProjectionRetainsLongIdsAndExcludesLegacyFields() throws Exception {
        actor(Set.of("monitor:job:list"));mvc.perform(get(PATH)).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].id").value("9007199254740993")).andExpect(jsonPath("$.items[0].concurrent").value(false))
            .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-05T00:00:00Z")).andExpect(jsonPath("$.items[0].nextExecutionAt").exists())
            .andExpect(jsonPath("$.items[0].params").doesNotExist()).andExpect(jsonPath("$.items[0].createBy").doesNotExist())
            .andExpect(jsonPath("$.rows").doesNotExist()).andExpect(jsonPath("$.pageSize").value(10));
        mvc.perform(get(PATH+"/9007199254740993")).andExpect(status().isForbidden());
        actor(Set.of("monitor:job:query"));mvc.perform(get(PATH+"/9007199254740993")).andExpect(status().isOk()).andExpect(jsonPath("$.remark").value("<script>inert text</script>"));
    }
    @ParameterizedTest @ValueSource(strings={"page=0","pageSize=101","status=2","sort=drop","direction=drop"})
    void invalidQueryNeverReachesSql(String query) throws Exception {
        mvc.perform(get(PATH+"?"+query)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));verifyNoInteractions(mapper);
    }
    @ParameterizedTest @ValueSource(strings={"0","invalid","9223372036854775808"})
    void invalidIdentifierNeverReachesSql(String id) throws Exception {
        mvc.perform(get(PATH+"/"+id)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));verifyNoInteractions(mapper);
    }
    @Test void anonymousAndNoRoleCannotReadDetailOrExport() throws Exception {
        for(boolean anonymous:List.of(false,true)) {
            if(anonymous)when(tokens.getLoginUser(any())).thenReturn(null);else actor(Set.of());int expected=anonymous?401:403;
            for(var request:List.of(get(PATH),get(PATH+"/1"),post(PATH+"/export")))mvc.perform(request).andExpect(status().is(expected));
        }
        verifyNoInteractions(mapper);
    }
    @Test void filtersRemainParametersAndFixedOrderingStateIsCleared() throws Exception {
        mvc.perform(get(PATH).param("name","任务").param("group","SYSTEM").param("invokeTarget","ryTask").param("status","1").param("sort","name").param("direction","desc"))
            .andExpect(status().isOk());var captured=org.mockito.ArgumentCaptor.forClass(SysJob.class);verify(mapper).selectJobList(captured.capture());
        assertEquals("任务",captured.getValue().getJobName());assertEquals("SYSTEM",captured.getValue().getJobGroup());assertEquals("ryTask",captured.getValue().getInvokeTarget());assertEquals("1",captured.getValue().getStatus());
        assertNull(com.github.pagehelper.PageHelper.getLocalPage());
        assertEquals("job_name desc, job_id asc",JobReadService.order(new JobContracts.JobQuery(null,null,null,null,null,null,JobContracts.Sort.name,LogContracts.Direction.desc)));
    }
    @Test void exportNeedsOriginalGrantAndReturnsXlsx() throws Exception {
        actor(Set.of("monitor:job:export"));mvc.perform(post(PATH+"/export").param("pageSize","1")).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        verify(mapper).selectJobList(any());assertNull(com.github.pagehelper.PageHelper.getLocalPage());
        actor(Set.of("monitor:job:list"));mvc.perform(post(PATH+"/export")).andExpect(status().isForbidden());
    }
    @Test void sqlFaultCleansPagingAndMissingDetailHasTyped404() throws Exception {
        when(mapper.selectJobList(any())).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private sql"));
        mvc.perform(get(PATH)).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private sql"))));
        assertNull(com.github.pagehelper.PageHelper.getLocalPage());mvc.perform(get(PATH+"/1")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("JOB_NOT_FOUND"));
    }
    @TestConfiguration static class Configuration {
        @Bean PermitAllUrlProperties permitAll(){var value=new PermitAllUrlProperties();value.setUrls(List.of());return value;}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
    }
}