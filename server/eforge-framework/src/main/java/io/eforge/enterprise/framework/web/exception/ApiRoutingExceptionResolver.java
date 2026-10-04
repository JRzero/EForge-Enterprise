package io.eforge.enterprise.framework.web.exception;

import java.io.IOException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.ErrorResponse;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.servlet.ModelAndView;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;

/** Package-scoped advice cannot handle routing and static-resource failures. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiRoutingExceptionResolver implements HandlerExceptionResolver
{
    private final ObjectMapper objectMapper;

    public ApiRoutingExceptionResolver(ObjectMapper objectMapper)
    {
        this.objectMapper = objectMapper;
    }

    @Override
    public ModelAndView resolveException(HttpServletRequest request, HttpServletResponse response,
            Object handler, Exception exception)
    {
        // Newly owned avatar resources need real HTTP errors when replacement removes a file.
        boolean canonicalAvatar = request.getRequestURI().startsWith(request.getContextPath() + "/profile/avatar/canonical/");
        if (!(ApiSecurityProblemHandler.isApiRequest(request) || canonicalAvatar)
                || !(exception instanceof ErrorResponse error))
            return null;
        HttpStatus status = HttpStatus.valueOf(error.getStatusCode().value());
        response.setStatus(status.value());
        error.getHeaders().forEach((name, values) -> values.forEach(value -> response.addHeader(name, value)));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader("Cache-Control", "no-store");
        try
        {
            objectMapper.writeValue(response.getOutputStream(),
                    ApiProblems.create(status, status.value() == 400 ? "VALIDATION_ERROR" : "HTTP_" + status.value(),
                            status.value() == 400 ? "The request body or parameters are invalid." : status.getReasonPhrase(), request));
        }
        catch (IOException failure)
        {
            throw new IllegalStateException("Could not write API routing error", failure);
        }
        return new ModelAndView();
    }
}
