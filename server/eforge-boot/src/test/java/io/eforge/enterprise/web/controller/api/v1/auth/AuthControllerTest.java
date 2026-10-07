package io.eforge.enterprise.web.controller.api.v1.auth;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.user.BlackListException;
import io.eforge.enterprise.common.exception.user.CaptchaException;
import io.eforge.enterprise.common.exception.user.CaptchaExpireException;
import io.eforge.enterprise.common.exception.user.UserPasswordNotMatchException;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.security.handle.AuthenticationEntryPointImpl;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.framework.web.exception.ApiRoutingExceptionResolver;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.web.service.SysLoginService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.web.controller.api.v1.app.BootstrapController;
import io.eforge.enterprise.web.controller.api.v1.app.BootstrapService;
import io.eforge.enterprise.web.controller.api.v1.app.BootstrapResponse;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import java.util.Set;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises the production security chain and both advice boundaries. */
@WebMvcTest
@ContextConfiguration(classes = {AuthController.class, BootstrapController.class, AuthControllerTest.ProtectedController.class,
        ApiExceptionHandler.class, ApiRoutingExceptionResolver.class, GlobalExceptionHandler.class, SpringUtils.class, SecurityConfig.class,
        ApiSecurityProblemHandler.class, AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class,
        AuthControllerTest.Configuration.class})
class AuthControllerTest
{
    private static final String LOGIN = "/api/v1/auth/login";
    private static final String BODY = "{\"username\":\"admin\",\"password\":\"admin123\"}";

    @Autowired private MockMvc mvc;
    @MockitoBean private SysLoginService loginService;
    @MockitoBean private TokenService tokenService;
    @MockitoBean private LogoutSuccessHandlerImpl logoutHandler;
    @MockitoBean private BootstrapService bootstrapService;

    @Test
    void bootstrapUsesAuthenticatedSessionAndReturnsOnlyPublicFields() throws Exception
    {
        LoginUser session = new LoginUser(2L, 105L, new SysUser(), Set.of());
        when(tokenService.getLoginUser(any())).thenReturn(session);
        when(bootstrapService.bootstrap(session)).thenReturn(new BootstrapResponse(
                new BootstrapResponse.UserSummary("2", "ry", "Display name", null), Set.of("common"),
                Set.of("system:user:list"), List.of()));
        mvc.perform(get("/api/v1/app/bootstrap").header("Authorization", "Bearer session-token"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.user.id").value("2")).andExpect(jsonPath("$.roles[0]").value("common"))
                .andExpect(jsonPath("$.user.password").doesNotExist()).andExpect(jsonPath("$.code").doesNotExist());
        verify(bootstrapService).bootstrap(session);
    }

    @Test
    void anonymousLoginReturnsConcreteContractAndDoesNotCacheToken() throws Exception
    {
        when(loginService.login("admin", "admin123", "", "")).thenReturn("session-token");
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.accessToken").value("session-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.code").doesNotExist()).andExpect(jsonPath("$.token").doesNotExist());
        verify(loginService).login("admin", "admin123", "", "");
    }

    @Test
    void forwardsCaptchaWithoutChangingCredentials() throws Exception
    {
        when(loginService.login("admin", "admin123", "42", "captcha-id")).thenReturn("session-token");
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"admin123\",\"code\":\"42\",\"uuid\":\"captcha-id\"}"))
                .andExpect(status().isOk());
        verify(loginService).login("admin", "admin123", "42", "captcha-id");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"username\":\"admin\",\"password\":\"\"}", "null", "{broken"})
    void invalidInputNeverReachesAuthentication(String body) throws Exception
    {
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.status").value(400));
        verifyNoInteractions(loginService);
    }

    @Test
    void badCredentialsReturnUnauthorized() throws Exception
    {
        when(loginService.login(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new UserPasswordNotMatchException());
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.instance").value(LOGIN));
    }

    @Test
    void providerRejectionDoesNotExposeUpstreamMessage() throws Exception
    {
        when(loginService.login(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new ServiceException("internal password SQL diagnostic"));
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.detail").value("Login was rejected."));
    }

    @Test
    void bothCaptchaFailuresRemainClientErrors() throws Exception
    {
        when(loginService.login(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new CaptchaException()).thenThrow(new CaptchaExpireException());
        for (int attempt = 0; attempt < 2; attempt++)
            mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CAPTCHA_INVALID"));
    }

    @Test
    void blockedLoginReturnsForbidden() throws Exception
    {
        when(loginService.login(anyString(), anyString(), anyString(), anyString())).thenThrow(new BlackListException());
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("LOGIN_BLOCKED"));
    }

    @Test
    void unexpectedFailureDoesNotExposeExceptionDetails() throws Exception
    {
        when(loginService.login(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new IllegalStateException("redis password=secret"));
        mvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("The request could not be completed."));
    }

    @Test
    void onlyLoginPostIsPublicAndLegacyUnauthorizedContractIsPreserved() throws Exception
    {
        for (String path : List.of("/api/v1/app/bootstrap", LOGIN, "/v3/api-docs", "/druid/index.html"))
        {
            var result = mvc.perform(get(path));
            if (path.startsWith("/api/v1/"))
                result.andExpect(status().isUnauthorized())
                        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                        .andExpect(header().string("WWW-Authenticate", "Bearer"))
                        .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
            else
                result.andExpect(jsonPath("$.code").value(401));
        }
        mvc.perform(get("/getInfo")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(401));
    }

    @Test
    @WithMockUser
    void methodAuthorizationReturnsProblemDetail() throws Exception
    {
        mvc.perform(get("/api/v1/test/protected")).andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    @WithMockUser
    void wrongMethodAndMediaTypeUseHttpSemantics() throws Exception
    {
        mvc.perform(get(LOGIN)).andExpect(status().isMethodNotAllowed())
                .andExpect(header().string("Allow", "POST"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(get("/api/v1/missing-resource")).andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("HTTP_404"));
        mvc.perform(post(LOGIN).contentType(MediaType.TEXT_PLAIN).content(BODY))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @RestController
    static class ProtectedController
    {
        @GetMapping("/api/v1/test/protected")
        @PreAuthorize("hasAuthority('test:read')")
        public String protectedResource() { return "protected"; }
    }

    @TestConfiguration
    static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
