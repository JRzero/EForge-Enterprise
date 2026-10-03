package io.eforge.enterprise.web.api.v1;

import java.net.URI;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.base.BaseException;
import io.eforge.enterprise.common.exception.user.BlackListException;
import io.eforge.enterprise.common.exception.user.CaptchaException;
import io.eforge.enterprise.common.exception.user.CaptchaExpireException;
import io.eforge.enterprise.common.exception.user.UserException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "io.eforge.enterprise.web.api.v1")
public class ApiV1ExceptionHandler
{
    private static final Logger log = LoggerFactory.getLogger(ApiV1ExceptionHandler.class);
    private static final URI PROBLEM_BASE = URI.create("https://eforge.dev/problems/");

    @ExceptionHandler({ CaptchaException.class, CaptchaExpireException.class })
    public ProblemDetail handleCaptcha(RuntimeException exception, HttpServletRequest request)
    {
        return problem(HttpStatus.BAD_REQUEST, "Captcha validation failed",
                "Captcha validation failed.", "CAPTCHA_INVALID", request);
    }

    @ExceptionHandler(BlackListException.class)
    public ProblemDetail handleBlocked(BlackListException exception, HttpServletRequest request)
    {
        return problem(HttpStatus.FORBIDDEN, "Login blocked",
                "Login is not allowed from this client.", "LOGIN_BLOCKED", request);
    }

    @ExceptionHandler(UserException.class)
    public ProblemDetail handleAuthentication(UserException exception, HttpServletRequest request)
    {
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed",
                "Authentication failed.", "AUTHENTICATION_FAILED", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException exception, HttpServletRequest request)
    {
        return problem(HttpStatus.FORBIDDEN, "Access denied",
                "You do not have permission to perform this operation.", "ACCESS_DENIED", request);
    }

    @ExceptionHandler({ MethodArgumentNotValidException.class, BindException.class })
    public ProblemDetail handleValidation(Exception exception, HttpServletRequest request)
    {
        return problem(HttpStatus.BAD_REQUEST, "Validation failed",
                "One or more request fields are invalid.", "VALIDATION_ERROR", request);
    }

    @ExceptionHandler(ServiceException.class)
    public ProblemDetail handleService(ServiceException exception, HttpServletRequest request)
    {
        log.warn("API v1 business request failed: {}", exception.getMessage());
        return problem(HttpStatus.BAD_REQUEST, "Request failed",
                "The request could not be processed.", "REQUEST_FAILED", request);
    }

    @ExceptionHandler(BaseException.class)
    public ProblemDetail handleBase(BaseException exception, HttpServletRequest request)
    {
        log.warn("API v1 request failed: {}", exception.getMessage());
        return problem(HttpStatus.BAD_REQUEST, "Request failed",
                "The request could not be processed.", "REQUEST_FAILED", request);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception exception, HttpServletRequest request)
    {
        log.error("Unexpected API v1 error for '{}'.", request.getRequestURI(), exception);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error",
                "An unexpected error occurred.", "INTERNAL_ERROR", request);
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail, String code,
            HttpServletRequest request)
    {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setType(PROBLEM_BASE.resolve(code.toLowerCase().replace('_', '-')));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        return problem;
    }
}
