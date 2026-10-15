package io.eforge.enterprise.framework.web.service;

import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.ProblemDetailJacksonMixin;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.security.filter.DiagnosticConsoleAuthenticator;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthorizationFilterTest
{
    private final TokenService tokens = mock(TokenService.class);
    private final JwtAuthenticationTokenFilter filter = new JwtAuthenticationTokenFilter();
    private final ObjectMapper json = new ObjectMapper().addMixIn(ProblemDetail.class, ProblemDetailJacksonMixin.class);
    private final ApiSecurityProblemHandler problems = new ApiSecurityProblemHandler(json);
    private final LoginUser session = new LoginUser(7L, 103L, new SysUser(7L), Set.of("stale"));

    @BeforeEach void setup()
    {
        SecurityContextHolder.clearContext();
        var consoles = new org.springframework.beans.factory.support.StaticListableBeanFactory()
                .getBeanProvider(DiagnosticConsoleAuthenticator.class);
        var handlers = new org.springframework.beans.factory.support.StaticListableBeanFactory(); handlers.addBean("problems", problems);
        ObjectProvider<ApiSecurityProblemHandler> handler = handlers.getBeanProvider(ApiSecurityProblemHandler.class);
        ReflectionTestUtils.setField(filter, "tokenService", tokens);
        ReflectionTestUtils.setField(filter, "consoleAuthenticator", consoles);
        ReflectionTestUtils.setField(filter, "apiProblems", handler);
        session.setToken("unit-session");
    }
    @AfterEach void cleanup() {SecurityContextHolder.clearContext();}

    @Test void bothCanonicalAndLegacyPrincipalsMustRefreshBeforeTtlAndProtectedChain() throws Exception
    {
        for (String path : new String[] {"/api/v1/system/posts", "/system/post/list"})
        {
            SecurityContextHolder.clearContext(); clearInvocations(tokens);
            var request = new MockHttpServletRequest("GET", path); var response = new MockHttpServletResponse();
            when(tokens.getLoginUser(request)).thenReturn(session);
            doAnswer(invocation -> {assertNull(SecurityContextHolder.getContext().getAuthentication()); session.setPermissions(Set.of()); return null;})
                    .when(tokens).refreshAuthorization(session);
            filter.doFilter(request, response, (incoming, outgoing) -> {
                assertSame(session, SecurityContextHolder.getContext().getAuthentication().getPrincipal());
                assertTrue(session.getPermissions().isEmpty());
            });
            var order = inOrder(tokens); order.verify(tokens).getLoginUser(request);
            order.verify(tokens).refreshAuthorization(session); order.verify(tokens).verifyToken(session);
        }
    }

    @Test void storageFailureNeverEntersProtectedChainAndUsesSafeCanonicalAndLegacyResponses() throws Exception
    {
        for (String path : new String[] {"/api/v1/system/posts", "/system/post/list"})
        {
            var request = new MockHttpServletRequest("GET", path); var response = new MockHttpServletResponse();
            when(tokens.getLoginUser(request)).thenReturn(session);
            var failure = new ApiFailure(503, "AUTHORIZATION_UNAVAILABLE", "Current authorization could not be verified.");
            failure.initCause(new IllegalStateException("secret SELECT private_table password"));
            doThrow(failure).when(tokens).refreshAuthorization(session);
            filter.doFilter(request, response, (incoming, outgoing) -> fail("A failed authority lookup must not reach the handler"));
            assertEquals(503, response.getStatus()); assertNull(SecurityContextHolder.getContext().getAuthentication());
            var body = json.readTree(response.getContentAsString());
            assertEquals(response.getHeader("X-Request-ID"), body.path("requestId").asText());
            assertEquals("no-store", response.getHeader("Cache-Control"));
            assertFalse(response.getContentAsString().contains("private_table"));
            if (path.startsWith("/api")) assertEquals("application/problem+json", response.getContentType());
            else assertEquals(503, body.path("code").asInt());
        }
        verify(tokens, never()).verifyToken(any());
    }

    @Test void disabledAccountDoesNotRenewAndPreservesCompatibility401Envelope() throws Exception
    {
        for (String path : new String[] {"/api/v1/system/posts", "/system/post/list"})
        {
            var request = new MockHttpServletRequest("GET", path); var response = new MockHttpServletResponse();
            when(tokens.getLoginUser(request)).thenReturn(session);
            doThrow(new ApiFailure(401, "AUTHENTICATION_REQUIRED", "An active account is required.")).when(tokens).refreshAuthorization(session);
            filter.doFilter(request, response, (incoming, outgoing) -> fail("Inactive account"));
            assertEquals(path.startsWith("/api") ? 401 : 200, response.getStatus());
            if (!path.startsWith("/api")) assertEquals(401, json.readTree(response.getContentAsString()).path("code").asInt());
        }
        verify(tokens, never()).verifyToken(any());
    }

    @Test void redisReadAndRenewalFailuresAreHandledBeforeAuthentication() throws Exception
    {
        for (boolean reading : new boolean[] {true, false})
        {
            reset(tokens);
            var request = new MockHttpServletRequest("GET", "/api/v1/system/posts"); var response = new MockHttpServletResponse();
            var failure = new ApiFailure(503, "SESSION_STORE_UNAVAILABLE", "The login session could not be verified.");
            if (reading) when(tokens.getLoginUser(request)).thenThrow(failure);
            else {when(tokens.getLoginUser(request)).thenReturn(session); doThrow(failure).when(tokens).verifyToken(session);}
            filter.doFilter(request, response, (incoming, outgoing) -> fail("Unavailable session"));
            assertEquals(503, response.getStatus()); assertNull(SecurityContextHolder.getContext().getAuthentication());
        }
    }

    @Test void logoutFailureDoesNotClaimSuccessOrConsultSql() throws Exception
    {
        var logout = new LogoutSuccessHandlerImpl();
        ReflectionTestUtils.setField(logout, "tokenService", tokens); ReflectionTestUtils.setField(logout, "problems", problems);
        var request = new MockHttpServletRequest("POST", "/logout"); var response = new MockHttpServletResponse();
        when(tokens.getLoginUser(request)).thenReturn(session);
        doThrow(new ApiFailure(503, "SESSION_STORE_UNAVAILABLE", "The login session could not be verified.")).when(tokens).delLoginUser("unit-session");
        logout.onLogoutSuccess(request, response, null);
        assertEquals(503, response.getStatus()); assertEquals(503, json.readTree(response.getContentAsString()).path("code").asInt());
        verify(tokens, never()).refreshAuthorization(any());
    }
}
