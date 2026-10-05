package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.net.URI;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.security.filter.DiagnosticConsoleAuthenticator;
import io.eforge.enterprise.web.controller.api.v1.app.BootstrapService;

@Service
public class ConsoleAccessService implements DiagnosticConsoleAuthenticator
{
    private final ConsoleTicketService tickets;
    private final BootstrapService bootstrap;
    private final boolean druidEnabled, docsEnabled, openapiEnabled, secureCookie;
    public ConsoleAccessService(ConsoleTicketService tickets, BootstrapService bootstrap,
            @Value("${spring.datasource.druid.statViewServlet.enabled:false}") boolean druidEnabled,
            @Value("${springdoc.swagger-ui.enabled:false}") boolean swaggerEnabled,
            @Value("${springdoc.api-docs.enabled:false}") boolean openapiEnabled,
            @Value("${eforge.console.secure-cookie:true}") boolean secureCookie)
    {this.tickets=tickets;this.bootstrap=bootstrap;this.druidEnabled=druidEnabled;this.openapiEnabled=openapiEnabled;docsEnabled=swaggerEnabled&&openapiEnabled;this.secureCookie=secureCookie;}

    public boolean enabled(ConsoleTarget target){return target==ConsoleTarget.DRUID?druidEnabled:docsEnabled;}
    public void authorize(ConsoleTarget target,LoginUser session)
    {
        if(session==null)throw failure(401,"AUTHENTICATION_REQUIRED","Authentication is required.");
        try {
            var snapshot=bootstrap.refreshConsoleAuthorization(session);
            if(!snapshot.permissions().contains("*:*:*") && !snapshot.permissions().contains(target.permission()))
                throw failure(403,"ACCESS_DENIED","Access is not allowed.");
        } catch(AuthenticationException denied){throw failure(401,"AUTHENTICATION_REQUIRED","Authentication is required.");}
        catch(ApiFailure failure){throw failure;}
        catch(RuntimeException unavailable){throw failure(503,"CONSOLE_UNAVAILABLE","The diagnostic console is unavailable.");}
    }
    public ResponseCookie open(ConsoleTarget target,LoginUser session,HttpServletRequest request)
    {
        authorize(target,session);requireEnabled(target);requireSameOrigin(request);
        return tickets.issue(target,session,secureCookie||request.isSecure());
    }
    @Override public boolean matches(HttpServletRequest request)
    {return ConsoleTarget.DRUID.contains(request.getRequestURI()) || ConsoleTarget.API_DOCS.contains(request.getRequestURI());}
    @Override public LoginUser authenticate(HttpServletRequest request,LoginUser bearerSession)
    {
        ConsoleTarget target=ConsoleTarget.DRUID.contains(request.getRequestURI())?ConsoleTarget.DRUID:ConsoleTarget.API_DOCS;
        requireSameOrigin(request);
        LoginUser session=bearerSession!=null?bearerSession:tickets.resolve(target,request);
        authorize(target,session);
        if(bearerSession==null && !"same-origin".equals(request.getHeader("Sec-Fetch-Site"))
                && request.getHeader("Origin")==null) {
            String referer=request.getHeader("Referer");
            if(referer==null || !sameOrigin(request,referer,false))throw failure(403,"ACCESS_DENIED","Access is not allowed.");
        }
        // Authenticated schema export remains usable when interactive Swagger is disabled.
        boolean schemaExport=target==ConsoleTarget.API_DOCS && bearerSession!=null && openapiEnabled
                && (request.getRequestURI().equals("/v3/api-docs") || request.getRequestURI().startsWith("/v3/api-docs/"));
        if(!schemaExport)requireEnabled(target);
        return session;
    }
    private void requireEnabled(ConsoleTarget target)
    {if(!enabled(target))throw failure(404,"CONSOLE_DISABLED","The diagnostic console is disabled.");}
    private static void requireSameOrigin(HttpServletRequest request)
    {
        String site=request.getHeader("Sec-Fetch-Site"),origin=request.getHeader("Origin");
        if("cross-site".equals(site) || "same-site".equals(site))throw failure(403,"ACCESS_DENIED","Access is not allowed.");
        if(origin!=null) {
            if(!sameOrigin(request,origin,true))throw failure(403,"ACCESS_DENIED","Access is not allowed.");
        }
    }
    private static boolean sameOrigin(HttpServletRequest request,String value,boolean origin)
    {
        try {
            URI uri=URI.create(value);int port=uri.getPort()<0?("https".equals(uri.getScheme())?443:80):uri.getPort();
            return request.getScheme().equals(uri.getScheme()) && request.getServerName().equalsIgnoreCase(uri.getHost()) && request.getServerPort()==port
                    && uri.getRawUserInfo()==null && (!origin || (uri.getRawQuery()==null && uri.getRawFragment()==null && (uri.getRawPath()==null || uri.getRawPath().isEmpty())));
        } catch(RuntimeException invalid){return false;}
    }
    private static ApiFailure failure(int status,String code,String detail){return new ApiFailure(status,code,detail);}
}
