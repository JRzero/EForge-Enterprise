package io.eforge.enterprise.framework.security.filter;

import jakarta.servlet.http.HttpServletRequest;
import io.eforge.enterprise.common.core.domain.model.LoginUser;

/** Compatibility boundary for fixed diagnostic servlet resources, never product API routes. */
public interface DiagnosticConsoleAuthenticator
{
    boolean matches(HttpServletRequest request);
    LoginUser authenticate(HttpServletRequest request, LoginUser bearerSession);
}
