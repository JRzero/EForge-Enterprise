package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.framework.security.filter.DiagnosticConsoleAuthenticator;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.web.service.TokenService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DiagnosticConsoleCacheTest
{
    @Test void rawConsoleServletCannotRestoreCachingEvenAfterReset() throws Exception
    {
        var response=invoke("/druid/login.html",true);
        assertEquals("no-store",response.getHeader("Cache-Control"));
        assertEquals(1,response.getHeaders("Cache-Control").size());
        assertEquals("no-cache",response.getHeader("Pragma"));assertEquals("0",response.getHeader("Expires"));
    }
    @Test void ordinaryResourcesKeepTheirOwnCachePolicy() throws Exception
    {assertEquals("public, max-age=3600",invoke("/profile/avatar.png",false).getHeader("Cache-Control"));}
    @SuppressWarnings("unchecked")
    private MockHttpServletResponse invoke(String path,boolean diagnostic) throws Exception
    {
        var filter=new JwtAuthenticationTokenFilter();var tokens=mock(TokenService.class);
        var authenticator=mock(DiagnosticConsoleAuthenticator.class);var provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(authenticator);when(authenticator.matches(any())).thenReturn(diagnostic);
        ReflectionTestUtils.setField(filter,"tokenService",tokens);ReflectionTestUtils.setField(filter,"consoleAuthenticator",provider);
        var request=new MockHttpServletRequest("GET",path);var response=new MockHttpServletResponse();
        filter.doFilter(request,response,(req,res)->{
            var http=(HttpServletResponse)res;http.reset();http.setHeader("Cache-Control","public, max-age=3600");
            http.addHeader("cache-control","max-age=86400");http.setHeader("Pragma","cache");
            http.setDateHeader("Expires",System.currentTimeMillis()+3600000);http.addDateHeader("expires",System.currentTimeMillis()+7200000);
        });
        verify(tokens,never()).verifyToken(any());return response;
    }
}
