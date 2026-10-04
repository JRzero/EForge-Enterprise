package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
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
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={OnlineSessionController.class,OnlineSessionService.class,PermissionService.class,
        ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,OnlineSessionControllerTest.Configuration.class})
class OnlineSessionControllerTest
{
    static final String BASE="/api/v1/monitor/online-sessions",PREFIX=CacheConstants.LOGIN_TOKEN_KEY;
    static final String FIRST="00000000-0000-0000-0000-000000000001",SECOND="00000000-0000-0000-0000-000000000002";
    @Autowired MockMvc mvc;
    @MockitoBean RedisCache cache;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare(){actor(Set.of("*:*:*"));}
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    LoginUser session(String id,String username,String ip,long time) {
        var user=new SysUser(9007199254740993L);user.setUserName(username);user.setPassword("private-password-hash");
        var department=new SysDept();department.setDeptName("中文部门");user.setDept(department);
        var session=new LoginUser(user.getUserId(),103L,user,Set.of("private-grant"));session.setToken(id);session.setIpaddr(ip);
        session.setLoginTime(time);session.setExpireTime(time+3600000);session.setLoginLocation("本地");session.setBrowser("Chrome");session.setOs("Windows");return session;
    }
    void seed() {
        when(cache.keys(PREFIX+"*")).thenReturn(List.of(PREFIX+FIRST,PREFIX+SECOND,PREFIX+"expired",PREFIX+"partial",PREFIX+"mismatch"));
        when(cache.getCacheObject(PREFIX+FIRST)).thenReturn(session(FIRST,"张三","127.0.0.1",1000));
        when(cache.getCacheObject(PREFIX+SECOND)).thenReturn(session(SECOND,"张三","127.0.0.2",2000));
        when(cache.getCacheObject(PREFIX+"partial")).thenReturn(new LoginUser());
        when(cache.getCacheObject(PREFIX+"mismatch")).thenReturn(session(FIRST,"张三","127.0.0.1",3000));
    }
    @Test void safeProjectionSkipsExpiredPartialAndMismatchedKeysAndSortsBeforePaging() throws Exception {
        seed();mvc.perform(get(BASE).param("pageSize","1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.pageSize").value(1))
                .andExpect(jsonPath("$.items[0].id").value(SECOND)).andExpect(jsonPath("$.items[0].departmentName").value("中文部门"))
                .andExpect(jsonPath("$.items[0].loggedInAt").value("1970-01-01T00:00:02Z"))
                .andExpect(jsonPath("$.items[0].password").doesNotExist()).andExpect(jsonPath("$.items[0].user").doesNotExist())
                .andExpect(jsonPath("$.items[0].permissions").doesNotExist()).andExpect(jsonPath("$.items[0].accessToken").doesNotExist())
                .andExpect(jsonPath("$.rows").doesNotExist());
        mvc.perform(get(BASE).param("page","2").param("pageSize","1")).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(FIRST));
        mvc.perform(get(BASE).param("page","1000000")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0)).andExpect(jsonPath("$.total").value(2));
    }
    @Test void exactFiltersDoNotBecomeSubstringOrCaseInsensitiveMatching() throws Exception {
        seed();mvc.perform(get(BASE).param("username","张三").param("ip","127.0.0.1")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value(FIRST));
        mvc.perform(get(BASE).param("username","张")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get(BASE).param("ip","127.")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get(BASE).param("username","").param("ip","")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
    }
    @Test void equalTimesHaveStableIdOrderingAndEmptyCacheHasDefaultPaging() throws Exception {
        when(cache.keys(PREFIX+"*")).thenReturn(List.of(PREFIX+FIRST,PREFIX+SECOND));
        when(cache.getCacheObject(PREFIX+FIRST)).thenReturn(session(FIRST,"reader","127.0.0.1",1000));
        when(cache.getCacheObject(PREFIX+SECOND)).thenReturn(session(SECOND,"reader","127.0.0.1",1000));
        mvc.perform(get(BASE)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(SECOND));
        when(cache.keys(PREFIX+"*")).thenReturn(null);
        mvc.perform(get(BASE)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.pageSize").value(10));
    }
    @Test void revokeOnlyDeletesTheSelectedLoginKeyAndMissingSessionIsIdempotent() throws Exception {
        actor(Set.of("monitor:online:forceLogout"));mvc.perform(delete(BASE+"/"+FIRST)).andExpect(status().isNoContent());
        verify(cache).deleteObject(PREFIX+FIRST);verifyNoMoreInteractions(cache);
        mvc.perform(get(BASE)).andExpect(status().isForbidden());
    }
    @ParameterizedTest @ValueSource(strings={"list","revoke"})
    void originalSeparateGrantsAreAuthoritativeAndAnonymousRequestsFail(String action) throws Exception {
        actor(Set.of());var request=action.equals("list")?get(BASE):delete(BASE+"/"+FIRST);
        mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(request).andExpect(status().isUnauthorized());verifyNoInteractions(cache);
    }
    @ParameterizedTest @ValueSource(strings={"?page=0","?pageSize=101","?page=1000001","?username=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","/not-a-session","/pwd_err_cnt:admin","/00000000-0000-0000-0000-000000000001extra"})
    void invalidQueriesAndIdentifiersFailBeforeCacheAccess(String suffix) throws Exception {
        var request=suffix.startsWith("?")?get(BASE+suffix):delete(BASE+suffix);
        mvc.perform(request).andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"));verifyNoInteractions(cache);
    }
    @Test void cacheReadAndDeleteFailuresAreUnavailableAndNeverExposeConnectionDetails() throws Exception {
        when(cache.keys(PREFIX+"*")).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("private-cache-host"));
        mvc.perform(get(BASE)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("ONLINE_SESSIONS_UNAVAILABLE"))
                .andExpect(jsonPath("$.detail").value("Online session state is temporarily unavailable."));
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("private-cache-host")).when(cache).deleteObject(PREFIX+FIRST);
        mvc.perform(delete(BASE+"/"+FIRST)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("ONLINE_SESSIONS_UNAVAILABLE"));
    }
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
