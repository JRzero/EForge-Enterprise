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
import org.springframework.http.ResponseCookie;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.web.controller.api.v1.app.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={ConsoleAccessController.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,
        SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,
        JwtAuthenticationTokenFilter.class,ConsoleAccessControllerTest.Configuration.class})
class ConsoleAccessControllerTest
{
    @Autowired MockMvc mvc;
    @MockitoBean TokenService tokens;
    @MockitoBean ConsoleTicketService tickets;
    @MockitoBean BootstrapService bootstrap;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    LoginUser session;
    @Test void statelessAuthenticationPreservesNativeConsoleSessionIdentity() throws Exception {
        var nativeSession=new org.springframework.mock.web.MockHttpSession();
        nativeSession.setAttribute("druid-user","console-validator");var identity=nativeSession.getId();
        for(int i=0;i<3;i++) {
            mvc.perform(get("/api/v1/monitor/consoles/druid").session(nativeSession)).andExpect(status().isOk());
            org.junit.jupiter.api.Assertions.assertEquals(identity,nativeSession.getId(),"JWT authentication must not rotate the independent servlet session on every request.");
            org.junit.jupiter.api.Assertions.assertEquals("console-validator",nativeSession.getAttribute("druid-user"));
        }
    }
    @BeforeEach void setup(){session=new LoginUser();var user=new io.eforge.enterprise.common.core.domain.entity.SysUser(2L);user.setUserName("reader");session.setUser(user);session.setToken("1234567890abcdef1234567890abcdef");when(tokens.getLoginUser(any())).thenReturn(session);grants("*:*:*");}
    void grants(String... values){when(bootstrap.refreshConsoleAuthorization(session)).thenReturn(new BootstrapResponse(null,Set.of(),Set.of(values),List.of(),null));}
    @Test void statusesAreCanonicalAndDisabledWithoutLeakingConsoleResources() throws Exception
    {
        for(String path:List.of("druid","api-docs"))mvc.perform(get("/api/v1/monitor/consoles/"+path)).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.enabled").value(false)).andExpect(jsonPath("$.code").doesNotExist());
        mvc.perform(post("/api/v1/monitor/consoles/druid/session")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONSOLE_DISABLED"));
        verifyNoInteractions(tickets);
    }
    @Test void everyOperationRequiresItsOriginalGrantAndAnonymousRequestsCannotReachServices() throws Exception
    {
        grants();for(String path:List.of("druid","api-docs")) {
            mvc.perform(get("/api/v1/monitor/consoles/"+path)).andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/monitor/consoles/"+path+"/session")).andExpect(status().isForbidden());
        }
        reset(bootstrap);when(tokens.getLoginUser(any())).thenReturn(null);
        mvc.perform(get("/api/v1/monitor/consoles/druid")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
        verifyNoInteractions(bootstrap,tickets);
    }
    @Test void rawConsoleServletResourcesUseTheSameSecurityBoundaryEvenWithBearerAuthentication() throws Exception
    {
        mvc.perform(get("/druid/index.html")).andExpect(status().isNotFound()).andExpect(content().contentType("application/problem+json"));
        grants();mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get("/v3/api-docs/api-v1")).andExpect(status().isUnauthorized()).andExpect(header().string("WWW-Authenticate","Bearer"));
        verify(tokens,never()).verifyToken(any());
    }
    @Test void consoleCookieCannotAuthenticateAProductApi() throws Exception
    {
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get("/api/v1/monitor/consoles/druid").cookie(new jakarta.servlet.http.Cookie("eforge_console_druid","a".repeat(43))))
            .andExpect(status().isUnauthorized());verifyNoInteractions(tickets,bootstrap);
    }
    @Test void authenticatedSchemaExportRemainsAvailableWithInteractiveConsoleDisabled() throws Exception
    {
        // There is no Springdoc servlet in this MVC slice: 404 routing proves the filter admitted it.
        mvc.perform(get("/v3/api-docs/api-v1")).andExpect(status().isNotFound());verify(bootstrap).refreshConsoleAuthorization(session);
        grants();mvc.perform(get("/v3/api-docs/api-v1")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }
    @Test void enabledOpenReturnsOnlyFixedEntryAndCookieMetadata() throws Exception
    {
        var access=new ConsoleAccessService(tickets,bootstrap,true,true,true,true);
        when(tickets.issue(ConsoleTarget.DRUID,session,true)).thenReturn(ResponseCookie.from("eforge_console_druid","a".repeat(43)).httpOnly(true).secure(true).sameSite("Strict").path("/druid").build());
        var controller=new ConsoleAccessController(access);
        // SecurityUtils reads the current request principal; endpoint filter/security is covered above.
        var authentication=new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(session,null,List.of());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authentication);
        try {var response=controller.openDruid(new org.springframework.mock.web.MockHttpServletRequest());
            org.junit.jupiter.api.Assertions.assertEquals("/druid/login.html",response.getBody().entryPath());
            org.junit.jupiter.api.Assertions.assertEquals(300,response.getBody().expiresInSeconds());
            org.junit.jupiter.api.Assertions.assertFalse(response.getBody().toString().contains(session.getToken()));
        } finally {org.springframework.security.core.context.SecurityContextHolder.clearContext();}
    }
    @TestConfiguration static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}
        @Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}
        @Bean ConsoleAccessService access(ConsoleTicketService tickets,BootstrapService bootstrap){return new ConsoleAccessService(tickets,bootstrap,false,false,true,true);}
    }
}
