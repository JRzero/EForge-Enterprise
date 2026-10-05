package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import java.util.concurrent.TimeUnit;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ConsoleTicketServiceTest
{
    RedisCache cache; ConsoleTicketService tickets; LoginUser session;
    @BeforeEach void setup(){cache=mock(RedisCache.class);tickets=new ConsoleTicketService(cache);session=new LoginUser();session.setToken("1234567890abcdef1234567890abcdef");}
    @Test void transportUsesRandomScopedStrictHttpOnlyCookiesAndOnlyStoresHashedSessionBindings()
    {
        var first=tickets.issue(ConsoleTarget.DRUID,session,true);
        var second=tickets.issue(ConsoleTarget.DRUID,session,true);
        assertNotEquals(first.getValue(),second.getValue());assertEquals(43,first.getValue().length());
        assertTrue(first.isHttpOnly());assertTrue(first.isSecure());assertEquals("Strict",first.getSameSite());assertEquals("/druid",first.getPath());
        assertEquals(300,first.getMaxAge().getSeconds());
        verify(cache,times(2)).setCacheObject(matches("console_tickets:DRUID:[a-f0-9]{64}"),eq(session.getToken()),eq(300),eq(TimeUnit.SECONDS));
        assertFalse(first.toString().contains(session.getToken()));
        assertEquals("/",tickets.issue(ConsoleTarget.API_DOCS,session,false).getPath());
    }
    @Test void onlyAnExistingMatchingSessionCanBeResolvedWithoutRenewal()
    {
        var cookie=tickets.issue(ConsoleTarget.DRUID,session,false);clearInvocations(cache);
        when(cache.getCacheObject(startsWith("console_tickets:DRUID:"))).thenReturn(session.getToken());
        when(cache.getCacheObject(CacheConstants.LOGIN_TOKEN_KEY+session.getToken())).thenReturn(session);
        assertSame(session,tickets.resolve(ConsoleTarget.DRUID,request("/druid/index.html",cookie.getName(),cookie.getValue())));
        verify(cache,never()).setCacheObject(anyString(),any(),anyInt(),any(TimeUnit.class));
        when(cache.getCacheObject(CacheConstants.LOGIN_TOKEN_KEY+session.getToken())).thenReturn(null);
        assertNull(tickets.resolve(ConsoleTarget.DRUID,request("/druid/index.html",cookie.getName(),cookie.getValue())));
    }
    @Test void pathsAndScopesCannotAuthenticateProductApisOrOtherConsoles()
    {
        for(String path:List.of("/api/v1/system/users","/logout","/profile/avatar.png","/druidevil/index.html","/druid/../api/v1","/druid/%2e%2e/api","/druid/index;other"))
            assertNull(tickets.resolve(ConsoleTarget.DRUID,request(path,"eforge_console_druid","a".repeat(43))));
        assertNull(tickets.resolve(ConsoleTarget.API_DOCS,request("/swagger-ui/index.html","eforge_console_druid","a".repeat(43))));
        assertNull(tickets.resolve(ConsoleTarget.API_DOCS,request("/api/v1/auth/login","eforge_console_docs","a".repeat(43))));
        verifyNoInteractions(cache);
        assertTrue(ConsoleTarget.API_DOCS.contains("/v3/api-docs/api-v1"));assertTrue(ConsoleTarget.API_DOCS.contains("/swagger-ui/swagger-ui.css"));
    }
    @Test void malformedDuplicateMissingOrUnboundCookiesAreRejected()
    {
        assertNull(tickets.resolve(ConsoleTarget.DRUID,request("/druid/index.html","eforge_console_druid","not-a-ticket")));
        var duplicate=request("/druid/index.html","eforge_console_druid","a".repeat(43));duplicate.setCookies(new Cookie("eforge_console_druid","a".repeat(43)),new Cookie("eforge_console_druid","b".repeat(43)));
        assertNull(tickets.resolve(ConsoleTarget.DRUID,duplicate));verifyNoInteractions(cache);
        var request=request("/druid/index.html","eforge_console_druid","a".repeat(43));assertNull(tickets.resolve(ConsoleTarget.DRUID,request));
        when(cache.getCacheObject(startsWith("console_tickets:DRUID:"))).thenReturn("../session");assertNull(tickets.resolve(ConsoleTarget.DRUID,request));
    }
    @Test void aMismatchedCachedSessionIsRejected()
    {
        when(cache.getCacheObject(startsWith("console_tickets:DRUID:"))).thenReturn(session.getToken());
        var mismatched=new LoginUser();mismatched.setToken("different");when(cache.getCacheObject(CacheConstants.LOGIN_TOKEN_KEY+session.getToken())).thenReturn(mismatched);
        assertNull(tickets.resolve(ConsoleTarget.DRUID,request("/druid/index.html","eforge_console_druid","a".repeat(43))));
    }
    @Test void redisFailuresAreGenericAndCannotFallBackToAnotherCredential()
    {
        doThrow(new IllegalStateException("private redis address")).when(cache).setCacheObject(anyString(),any(),anyInt(),any(TimeUnit.class));
        assertEquals("The diagnostic console is unavailable.",assertThrows(ApiFailure.class,()->tickets.issue(ConsoleTarget.DRUID,session,false)).getMessage());
        when(cache.getCacheObject(anyString())).thenThrow(new IllegalStateException("private cached session"));
        assertThrows(ApiFailure.class,()->tickets.resolve(ConsoleTarget.DRUID,request("/druid/index.html","eforge_console_druid","a".repeat(43))));
    }
    private MockHttpServletRequest request(String path,String name,String value)
    {var request=new MockHttpServletRequest();request.setRequestURI(path);request.setCookies(new Cookie(name,value));return request;}
}
