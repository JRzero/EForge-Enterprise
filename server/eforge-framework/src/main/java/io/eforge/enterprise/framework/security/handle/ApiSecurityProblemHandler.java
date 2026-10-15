package io.eforge.enterprise.framework.security.handle;

import java.io.IOException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.framework.web.exception.ApiProblems;
import io.eforge.enterprise.framework.web.exception.ApiDiagnostics;

/** Security-filter failures must obey the same contract as controller errors. */
@Component
public class ApiSecurityProblemHandler implements AuthenticationEntryPoint, AccessDeniedHandler
{
    private static final Logger LOG = LoggerFactory.getLogger(ApiSecurityProblemHandler.class);
    private final ObjectMapper objectMapper;

    public ApiSecurityProblemHandler(ObjectMapper objectMapper)
    {
        this.objectMapper = objectMapper;
    }

    public static boolean isApiRequest(HttpServletRequest request)
    {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return path.equals("/api/v1") || path.startsWith("/api/v1/");
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException
    {
        response.setHeader("WWW-Authenticate", "Bearer");
        write(request, response, HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException
    {
        write(request, response, HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access is not allowed.");
    }

    private void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status,
            String code, String detail) throws IOException
    {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader(ApiDiagnostics.REQUEST_ID_HEADER, ApiDiagnostics.requestId(request));
        objectMapper.writeValue(response.getOutputStream(), ApiProblems.create(status, code, detail, request));
    }

    public void reject(HttpServletRequest request, HttpServletResponse response,
            io.eforge.enterprise.common.exception.ApiFailure failure) throws IOException
    {
        ApiDiagnostics.reportServerError(LOG, failure, failure.status(), request);
        if (failure.status() == 401) response.setHeader("WWW-Authenticate", "Bearer");
        write(request, response, HttpStatus.valueOf(failure.status()), failure.code(), failure.getMessage());
    }

    /** Preserve the compatibility JSON shape without disclosing storage errors. */
    public void rejectLegacy(HttpServletRequest request, HttpServletResponse response,
            io.eforge.enterprise.common.exception.ApiFailure failure) throws IOException
    {
        ApiDiagnostics.reportServerError(LOG, failure, failure.status(), request);
        response.setStatus(failure.status() == 401 ? 200 : failure.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader(ApiDiagnostics.REQUEST_ID_HEADER, ApiDiagnostics.requestId(request));
        objectMapper.writeValue(response.getOutputStream(), java.util.Map.of(
                "code", failure.status(), "msg", failure.getMessage(), "requestId", ApiDiagnostics.requestId(request)));
    }
}
