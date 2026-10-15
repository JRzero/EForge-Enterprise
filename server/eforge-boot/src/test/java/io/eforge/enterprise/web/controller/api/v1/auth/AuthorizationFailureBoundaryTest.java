package io.eforge.enterprise.web.controller.api.v1.auth;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.framework.web.exception.ApiDiagnostics;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.framework.web.service.SysLoginService;
import io.eforge.enterprise.web.controller.system.SysLoginController;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controller/advice routing; the production security filter chain has separate coverage. */
class AuthorizationFailureBoundaryTest
{
    private static final String CANONICAL = "/api/v1/auth/login";
    private static final String LEGACY = "/login";
    private static final String BODY = "{\"username\":\"reader\",\"password\":\"Password123\",\"code\":\"\",\"uuid\":\"\"}";
    private static final String PRIVATE = "private driver SQL password=secret redis://internal.example";
    private final SysLoginService login = mock(SysLoginService.class);
    private MockMvc mvc;

    @BeforeEach void setup()
    {
        SysLoginController compatibility = new SysLoginController();
        ReflectionTestUtils.setField(compatibility, "loginService", login);
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(login), compatibility)
                // Deliberately register broad legacy advice first: @Order/package scoping must still win.
                .setControllerAdvice(new GlobalExceptionHandler(), new ApiExceptionHandler()).build();
    }

    @ParameterizedTest @ValueSource(ints = {401, 503})
    void canonicalFailureRetainsHttpStatusAndProblemDetailDespiteBroadLegacyAdvice(int status) throws Exception
    {
        ApiFailure failure = failure(status);
        when(login.login(anyString(), anyString(), anyString(), anyString())).thenThrow(failure);
        MvcResult result = mvc.perform(post(CANONICAL).contentType(MediaType.APPLICATION_JSON).content(BODY)
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, "caller-controlled"))
                .andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.code").value(failure.code()))
                .andExpect(jsonPath("$.detail").value(failure.getMessage()))
                .andExpect(jsonPath("$.instance").value(CANONICAL))
                .andExpect(jsonPath("$.msg").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist()).andReturn();
        if (status == 401) assertEquals("Bearer", result.getResponse().getHeader("WWW-Authenticate"));
        else assertNull(result.getResponse().getHeader("WWW-Authenticate"));
        assertSafeCorrelatedResponse(result);
        verify(login).login("reader", "Password123", "", "");
    }

    @ParameterizedTest @ValueSource(ints = {401, 503})
    void compatibilityFailureRetainsAjaxEnvelopeAndDoesNotHideStorageOutageAsAuthenticationRejection(int status) throws Exception
    {
        ApiFailure failure = failure(status);
        when(login.login(anyString(), anyString(), anyString(), anyString())).thenThrow(failure);
        MvcResult result = mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(BODY)
                        .header(ApiDiagnostics.REQUEST_ID_HEADER, "caller-controlled"))
                .andExpect(status().is(status == 401 ? 200 : status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value(status))
                .andExpect(jsonPath("$.msg").value(failure.getMessage()))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist()).andReturn();
        assertSafeCorrelatedResponse(result);
        verify(login).login("reader", "Password123", "", "");
    }

    @Test void ordinarySafeProviderRejectionStillUsesOriginalCompatibilityContract() throws Exception
    {
        when(login.login(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new ServiceException("Password is incorrect."));
        mvc.perform(post(LEGACY).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value("Password is incorrect."))
                .andExpect(jsonPath("$.token").doesNotExist());
        mvc.perform(post(CANONICAL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.detail").value("Login was rejected."));
    }

    private static ApiFailure failure(int status)
    {
        ApiFailure failure = status == 401
                ? new ApiFailure(401, "AUTHENTICATION_FAILED", "An active account is required.")
                : new ApiFailure(503, "AUTHORIZATION_UNAVAILABLE", "Current authorization could not be verified.");
        failure.initCause(new DataAccessResourceFailureException(PRIVATE));
        return failure;
    }

    private static void assertSafeCorrelatedResponse(MvcResult result) throws Exception
    {
        String body = result.getResponse().getContentAsString();
        assertFalse(body.contains("private")); assertFalse(body.contains("secret"));
        assertFalse(body.contains("internal.example")); assertFalse(body.contains("DataAccessResourceFailureException"));
        String requestId = result.getResponse().getHeader(ApiDiagnostics.REQUEST_ID_HEADER);
        assertNotNull(requestId); assertNotEquals("caller-controlled", requestId);
        assertEquals(requestId, UUID.fromString(requestId).toString());
        jsonPath("$.requestId").value(requestId).match(result);
    }
}
