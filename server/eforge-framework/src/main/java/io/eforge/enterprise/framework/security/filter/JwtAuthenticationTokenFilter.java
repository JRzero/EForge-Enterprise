package io.eforge.enterprise.framework.security.filter;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;

/**
 * token过滤器 验证token有效性
 * 
 * @author ruoyi
 */
@Component
public class JwtAuthenticationTokenFilter extends OncePerRequestFilter
{
    @Autowired
    private TokenService tokenService;

    @Autowired
    private ObjectProvider<DiagnosticConsoleAuthenticator> consoleAuthenticator;
    @Autowired
    private ObjectProvider<ApiSecurityProblemHandler> apiProblems;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException
    {
        LoginUser loginUser = tokenService.getLoginUser(request);
        var console = consoleAuthenticator.getIfAvailable();
        boolean consoleRequest = console != null && console.matches(request);
        if (consoleRequest)
        {
            response = new DiagnosticResponse(response);
            try { loginUser = console.authenticate(request, loginUser); }
            catch (ApiFailure failure) { apiProblems.getObject().reject(request, response, failure); return; }
        }
        if (StringUtils.isNotNull(loginUser) && StringUtils.isNull(SecurityUtils.getAuthentication()))
        {
            if (!consoleRequest) tokenService.verifyToken(loginUser);
            UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities());
            authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authenticationToken);
        }
        chain.doFilter(request, response);
    }

    /** Imported static-resource servlets must not override the credential boundary with public caching. */
    private static final class DiagnosticResponse extends HttpServletResponseWrapper
    {
        DiagnosticResponse(HttpServletResponse response) {super(response);protect();}
        private void protect() {super.setHeader("Cache-Control", "no-store");super.setHeader("Pragma", "no-cache");super.setHeader("Expires", "0");}
        private String protectedValue(String name, String value) {
            if("Cache-Control".equalsIgnoreCase(name))return "no-store";
            if("Pragma".equalsIgnoreCase(name))return "no-cache";
            if("Expires".equalsIgnoreCase(name))return "0";
            return value;
        }
        @Override public void setHeader(String name,String value) {super.setHeader(name,protectedValue(name,value));}
        @Override public void addHeader(String name,String value) {
            if("Cache-Control".equalsIgnoreCase(name)||"Pragma".equalsIgnoreCase(name)||"Expires".equalsIgnoreCase(name))setHeader(name,value);
            else super.addHeader(name,value);
        }
        @Override public void setDateHeader(String name,long value) {if("Expires".equalsIgnoreCase(name))setHeader(name,"0");else super.setDateHeader(name,value);}
        @Override public void addDateHeader(String name,long value) {if("Expires".equalsIgnoreCase(name))setHeader(name,"0");else super.addDateHeader(name,value);}
        @Override public void reset() {super.reset();protect();}
    }
}
