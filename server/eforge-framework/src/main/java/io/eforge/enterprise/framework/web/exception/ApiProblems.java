package io.eforge.enterprise.framework.web.exception;

import java.net.URI;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

public final class ApiProblems
{
    private ApiProblems() { }

    public static ProblemDetail create(HttpStatus status, String code, String detail, HttpServletRequest request)
    {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        return problem;
    }
}
