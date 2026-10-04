package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.*;
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
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.domain.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={OperationLogController.class,LoginLogController.class,LogService.class,PermissionService.class,
        ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,LogControllerTest.Configuration.class})
class LogControllerTest
{
    static final String OPS="/api/v1/monitor/operation-logs",LOGIN="/api/v1/monitor/login-logs";
    @Autowired MockMvc mvc;
    @MockitoBean SysOperLogMapper operations;
    @MockitoBean SysLogininforMapper logins;
    @MockitoBean SysPasswordService passwords;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    SysOperLog operation;SysLogininfor login;
    @BeforeEach void prepare()
    {
        actor(Set.of("*:*:*"));operation=new SysOperLog();operation.setOperId(9007199254740993L);operation.setTitle("用户管理");
        operation.setOperName("管理员");operation.setBusinessType(2);operation.setStatus(0);operation.setCostTime(123L);
        operation.setOperTime(Date.from(Instant.parse("2026-10-05T00:00:00Z")));operation.setOperParam("{\"中文\":\"请求\"}");
        operation.setJsonResult("<script>untrusted log text</script>");operation.setErrorMsg("故障详情");
        when(operations.selectOperLogList(any())).thenReturn(List.of(operation));when(operations.selectOperLogById(operation.getOperId())).thenReturn(operation);
        login=new SysLogininfor();login.setInfoId(9007199254740995L);login.setUserName("reader");login.setStatus("1");
        login.setMsg("密码错误");login.setLoginTime(Date.from(Instant.parse("2026-10-05T00:00:00Z")));when(logins.selectLogininforList(any())).thenReturn(List.of(login));
    }
    void actor(Set<String> grants)
    {var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void typedSummariesDoNotExposeRawOperationPayloadsAndDefaultPagingIsBounded() throws Exception
    {
        mvc.perform(get(OPS)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("9007199254740993"))
                .andExpect(jsonPath("$.items[0].operatedAt").value("2026-10-05T00:00:00Z"))
                .andExpect(jsonPath("$.items[0].requestParameters").doesNotExist()).andExpect(jsonPath("$.items[0].operParam").doesNotExist())
                .andExpect(jsonPath("$.rows").doesNotExist()).andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.pageSize").value(10));
        mvc.perform(get(LOGIN)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("9007199254740995"))
                .andExpect(jsonPath("$.items[0].message").value("密码错误")).andExpect(jsonPath("$.items[0].params").doesNotExist());
        assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @Test void detailRequiresSeparateQueryGrantAndReturnsUntrustedPayloadAsData() throws Exception
    {
        actor(Set.of("monitor:operlog:list"));mvc.perform(get(OPS+"/9007199254740993")).andExpect(status().isForbidden());
        actor(Set.of("monitor:operlog:query"));mvc.perform(get(OPS+"/9007199254740993")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entry.id").value("9007199254740993")).andExpect(jsonPath("$.requestParameters").value(operation.getOperParam()))
                .andExpect(jsonPath("$.responseBody").value(operation.getJsonResult())).andExpect(jsonPath("$.errorMessage").value("故障详情"));
        mvc.perform(get(OPS+"/999")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("OPERATION_LOG_NOT_FOUND"));
    }
    @Test void filtersAndInclusiveCalendarDatesReachCompatibilityMappers() throws Exception
    {
        mvc.perform(get(OPS).param("ip","127.").param("title","模块").param("operator","张").param("businessType","2").param("status","1").param("from","2026-10-01").param("to","2026-10-05"))
                .andExpect(status().isOk());
        verify(operations).selectOperLogList(argThat(row->"127.".equals(row.getOperIp())&&"模块".equals(row.getTitle())&&"张".equals(row.getOperName())&&row.getBusinessType()==2&&row.getStatus()==1&&"2026-10-01 00:00:00".equals(row.getParams().get("beginTime"))&&"2026-10-05 23:59:59".equals(row.getParams().get("endTime"))));
        mvc.perform(get(LOGIN).param("username","张").param("status","1").param("from","2026-10-01").param("to","2026-10-05")).andExpect(status().isOk());
        verify(logins).selectLogininforList(argThat(row->"张".equals(row.getUserName())&&"1".equals(row.getStatus())&&"2026-10-05 23:59:59".equals(row.getParams().get("endTime"))));
    }
    @ParameterizedTest @ValueSource(strings={"operator","time","duration"})
    void operationSortOnlyUsesFixedSqlColumnsAndAlwaysClearsThreadState(String sort) throws Exception
    {
        var column=Map.of("operator","oper_name","time","oper_time","duration","cost_time").get(sort);
        when(operations.selectOperLogList(any())).thenAnswer(call->{assertEquals(column+" asc, oper_id desc",com.github.pagehelper.PageHelper.getLocalPage().getOrderBy());return List.of(operation);});
        mvc.perform(get(OPS).param("sort",sort).param("direction","asc")).andExpect(status().isOk());assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @ParameterizedTest @ValueSource(strings={"username","time"})
    void loginSortOnlyUsesFixedSqlColumns(String sort) throws Exception
    {
        var column=sort.equals("username")?"user_name":"login_time";
        when(logins.selectLogininforList(any())).thenAnswer(call->{assertEquals(column+" desc, info_id desc",com.github.pagehelper.PageHelper.getLocalPage().getOrderBy());return List.of(login);});
        mvc.perform(get(LOGIN).param("sort",sort)).andExpect(status().isOk());assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @ParameterizedTest @ValueSource(strings={"ops-list","ops-detail","ops-delete","ops-clear","ops-export","login-list","login-delete","login-clear","login-unlock","login-export"})
    void everyOperationRequiresItsOriginalGrantAndAnonymousRequestsAreRejected(String action) throws Exception
    {
        actor(Set.of());var request=switch(action){
            case "ops-list"->get(OPS);case "ops-detail"->get(OPS+"/1");case "ops-delete"->delete(OPS).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}");
            case "ops-clear"->post(OPS+"/clear");case "ops-export"->post(OPS+"/export");case "login-list"->get(LOGIN);
            case "login-delete"->delete(LOGIN).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}");case "login-clear"->post(LOGIN+"/clear");
            case "login-unlock"->post(LOGIN+"/unlock").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\"}");default->post(LOGIN+"/export");};
        mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(request).andExpect(status().isUnauthorized());verifyNoInteractions(operations,logins,passwords);
    }
    @ParameterizedTest @ValueSource(strings={"?page=0","?pageSize=101","?sort=oper_time%20desc","?direction=descending","?status=2","?businessType=10","?from=bad","?from=2026-10-05&to=2026-10-01","/0","/9223372036854775808"})
    void invalidParametersAndSortInjectionUseProblems(String suffix) throws Exception
    {mvc.perform(get(OPS+suffix)).andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"));verifyNoInteractions(operations);assertNull(com.github.pagehelper.PageHelper.getLocalPage());}
    @Test void deletesDeduplicateExactIdsInOneStatementAndRejectOverflowBeforeMutation() throws Exception
    {
        mvc.perform(delete(OPS).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"9007199254740993\",\"9007199254740993\"]}")).andExpect(status().isNoContent());
        verify(operations).deleteOperLogByIds(aryEq(new Long[]{9007199254740993L}));
        mvc.perform(delete(LOGIN).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\",\"9223372036854775808\"]}")).andExpect(status().isBadRequest());verify(logins,never()).deleteLogininforByIds(any());
        mvc.perform(delete(LOGIN).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[]}")).andExpect(status().isBadRequest());
        mvc.perform(delete(LOGIN).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"1\"]}")).andExpect(status().isNoContent());verify(logins).deleteLogininforByIds(aryEq(new Long[]{1L}));
    }
    @Test void clearRetainsExistingCleanBehaviorAndUnlockUsesOnlyPasswordFailureState() throws Exception
    {
        mvc.perform(post(OPS+"/clear")).andExpect(status().isNoContent());verify(operations).cleanOperLog();
        mvc.perform(post(LOGIN+"/clear")).andExpect(status().isNoContent());verify(logins).cleanLogininfor();
        actor(Set.of("monitor:logininfor:unlock"));mvc.perform(post(LOGIN+"/unlock").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"中文账号\"}")).andExpect(status().isNoContent());
        verify(passwords).clearLoginRecordCache("中文账号");
        mvc.perform(get(LOGIN+"/unlock")).andExpect(status().isMethodNotAllowed());
        mvc.perform(post(LOGIN+"/unlock").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\" \"}")).andExpect(status().isBadRequest());
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("secret cache host")).when(passwords).clearLoginRecordCache("admin");
        mvc.perform(post(LOGIN+"/unlock").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\"}")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LOGIN_UNLOCK_UNAVAILABLE")).andExpect(jsonPath("$.detail").value("Login failure state could not be cleared."));
    }
    @Test void exportsAreRealXlsxIgnorePaginationAndKeepWhitelistedOrder() throws Exception
    {
        when(operations.selectOperLogList(any())).thenAnswer(call->{assertTrue(com.github.pagehelper.PageHelper.getLocalPage().isOrderByOnly());assertEquals("cost_time asc, oper_id desc",com.github.pagehelper.PageHelper.getLocalPage().getOrderBy());return List.of(operation);});
        var bytes=mvc.perform(post(OPS+"/export").param("page","999").param("pageSize","1").param("sort","duration").param("direction","asc")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try(var book=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(bytes))){assertEquals(2,book.getSheetAt(0).getPhysicalNumberOfRows());assertEquals("用户管理",book.getSheetAt(0).getRow(1).getCell(1).getStringCellValue());}
        mvc.perform(post(LOGIN+"/export")).andExpect(status().isOk());assertNull(com.github.pagehelper.PageHelper.getLocalPage());
    }
    @Test void mapperFailuresAlsoClearPagingThreadState() throws Exception
    {when(operations.selectOperLogList(any())).thenThrow(new IllegalStateException("private sql"));mvc.perform(get(OPS)).andExpect(status().isInternalServerError());assertNull(com.github.pagehelper.PageHelper.getLocalPage());}
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
