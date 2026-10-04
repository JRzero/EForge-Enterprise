package io.eforge.enterprise.framework.web.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import io.eforge.enterprise.common.exception.user.BlackListException;
import io.eforge.enterprise.common.exception.user.CaptchaException;
import io.eforge.enterprise.common.exception.user.CaptchaExpireException;
import io.eforge.enterprise.common.exception.user.UserException;

/** New API errors are isolated from legacy AjaxResult advice. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "io.eforge.enterprise.web.controller.api.v1")
public class ApiExceptionHandler extends ResponseEntityExceptionHandler
{
    @ExceptionHandler(io.eforge.enterprise.common.exception.ApiFailure.class)
    public ResponseEntity<Object> business(io.eforge.enterprise.common.exception.ApiFailure exception,
            HttpServletRequest request)
    {
        return problem(HttpStatus.valueOf(exception.status()), exception.code(), exception.getMessage(), request);
    }

    @ExceptionHandler({UserException.class, AuthenticationException.class})
    public ResponseEntity<Object> authentication(RuntimeException exception, HttpServletRequest request)
    {
        if (exception instanceof CaptchaException || exception instanceof CaptchaExpireException)
        {
            return problem(HttpStatus.BAD_REQUEST, "CAPTCHA_INVALID", "Captcha is invalid or expired.", request);
        }
        if (exception instanceof BlackListException)
        {
            return problem(HttpStatus.FORBIDDEN, "LOGIN_BLOCKED", "Login is not allowed.", request);
        }
        return problem(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED", "Login was rejected.", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> forbidden(HttpServletRequest request)
    {
        return problem(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access is not allowed.", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> unexpected(HttpServletRequest request)
    {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "The request could not be completed.", request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body,
            HttpHeaders headers, HttpStatusCode status, WebRequest request)
    {
        // Never serialize rejected values, parser messages or exception details.
        HttpStatus httpStatus = HttpStatus.valueOf(status.value());
        ProblemDetail problem = ApiProblems.create(httpStatus,
                status.value() == 400 ? "VALIDATION_ERROR" : "HTTP_" + status.value(),
                status.value() == 400 ? "The request body or parameters are invalid." : httpStatus.getReasonPhrase(),
                ((ServletWebRequest) request).getRequest());
        HttpHeaders responseHeaders = new HttpHeaders();
        responseHeaders.putAll(headers);
        responseHeaders.setCacheControl("no-store");
        return new ResponseEntity<>(problem, responseHeaders, status);
    }

    private ResponseEntity<Object> problem(HttpStatus status, String code, String detail, HttpServletRequest request)
    {
        var response = ResponseEntity.status(status).header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (status == HttpStatus.UNAUTHORIZED)
            response.header(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        return response.body(ApiProblems.create(status, code, detail, request));
    }
}
