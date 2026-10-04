package io.eforge.enterprise.framework.security.handle;

import java.io.IOException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.framework.web.exception.ApiProblems;

/** Security-filter failures must obey the same contract as controller errors. */
@Component
public class ApiSecurityProblemHandler implements AuthenticationEntryPoint, AccessDeniedHandler
{
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
        objectMapper.writeValue(response.getOutputStream(), ApiProblems.create(status, code, detail, request));
    }
}
