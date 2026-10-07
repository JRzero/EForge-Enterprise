package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.CredentialsExpiredException;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.web.controller.api.v1.app.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class ConsoleAccessServiceTest
{
    ConsoleTicketService tickets; BootstrapService bootstrap; LoginUser session; ConsoleAccessService access;
    @BeforeEach void prepare(){tickets=mock(ConsoleTicketService.class);bootstrap=mock(BootstrapService.class);session=new LoginUser();access=new ConsoleAccessService(tickets,bootstrap,true,true,true,true);grants("*:*:*");}
    void grants(String... values){when(bootstrap.refreshConsoleAuthorization(session)).thenReturn(new BootstrapResponse(null,Set.of(),Set.of(values),List.of(),null));}
    MockHttpServletRequest request(String path){var request=new MockHttpServletRequest();request.setRequestURI(path);return request;}
    @Test void bothTargetsRequireTheirOriginalFreshDatabaseGrants()
    {
        grants("monitor:druid:list");access.authorize(ConsoleTarget.DRUID,session);
        assertEquals(403,assertThrows(ApiFailure.class,()->access.authorize(ConsoleTarget.API_DOCS,session)).status());
        grants("tool:swagger:list");access.authorize(ConsoleTarget.API_DOCS,session);
        assertEquals(403,assertThrows(ApiFailure.class,()->access.authorize(ConsoleTarget.DRUID,session)).status());
        grants();assertEquals(403,assertThrows(ApiFailure.class,()->access.authorize(ConsoleTarget.API_DOCS,session)).status());verifyNoInteractions(tickets);
    }
    @Test void revokedGrantsAndDisabledAccountsAreRecheckedOnEachEmbeddedRequest()
    {
        var request=request("/druid/index.html");request.addHeader("Sec-Fetch-Site","same-origin");when(tickets.resolve(ConsoleTarget.DRUID,request)).thenReturn(session);
        assertSame(session,access.authenticate(request,null));grants();
        assertEquals(403,assertThrows(ApiFailure.class,()->access.authenticate(request,null)).status());
        when(bootstrap.refreshConsoleAuthorization(session)).thenThrow(new CredentialsExpiredException("private account"));
        var failure=assertThrows(ApiFailure.class,()->access.authenticate(request,null));assertEquals(401,failure.status());assertEquals("Authentication is required.",failure.getMessage());
        verify(bootstrap,times(3)).refreshConsoleAuthorization(session);
    }
    @Test void missingOrExpiredSessionCannotAuthenticateEvenIfConsoleEnabled()
    {assertEquals(401,assertThrows(ApiFailure.class,()->access.authenticate(request("/swagger-ui/index.html"),null)).status());verifyNoInteractions(bootstrap);}
    @Test void disabledStatesRemainExplicitAndNeverIssueTickets()
    {
        var disabled=new ConsoleAccessService(tickets,bootstrap,false,false,false,true);
        for(var target:ConsoleTarget.values()){assertFalse(disabled.enabled(target));assertEquals(404,assertThrows(ApiFailure.class,()->disabled.open(target,session,request(target.entryPath()))).status());}
        verifyNoInteractions(tickets);
        assertFalse(new ConsoleAccessService(tickets,bootstrap,true,true,false,true).enabled(ConsoleTarget.API_DOCS));
    }
    @Test void schemaExportCanRemainEnabledWithSwaggerDisabledButCannotUseConsoleCookies()
    {
        var schemaOnly=new ConsoleAccessService(tickets,bootstrap,false,false,true,true);var request=request("/v3/api-docs/api-v1");
        assertSame(session,schemaOnly.authenticate(request,session));verifyNoInteractions(tickets);
        request.addHeader("Origin","http://localhost");
        when(tickets.resolve(ConsoleTarget.API_DOCS,request)).thenReturn(session);
        assertEquals(404,assertThrows(ApiFailure.class,()->schemaOnly.authenticate(request,null)).status());
        assertEquals(404,assertThrows(ApiFailure.class,()->schemaOnly.authenticate(request("/swagger-ui/index.html"),session)).status());
    }
    @Test void cookieSecurityDefaultsToSecureAndTlsCannotBeDowngraded()
    {
        var request=request("/api/v1/monitor/consoles/druid/session");access.open(ConsoleTarget.DRUID,session,request);verify(tickets).issue(ConsoleTarget.DRUID,session,true);
        var development=new ConsoleAccessService(tickets,bootstrap,true,true,true,false);development.open(ConsoleTarget.DRUID,session,request);verify(tickets).issue(ConsoleTarget.DRUID,session,false);
        request.setSecure(true);development.open(ConsoleTarget.DRUID,session,request);verify(tickets,times(2)).issue(ConsoleTarget.DRUID,session,true);
    }
    @Test void crossSiteAndSiblingOriginRequestsAreRejectedBeforeTicketReadsOrIssuance()
    {
        for(String site:List.of("cross-site","same-site")){var request=request("/druid/reset-all.json");request.addHeader("Sec-Fetch-Site",site);assertEquals(403,assertThrows(ApiFailure.class,()->access.authenticate(request,null)).status());}
        for(String origin:List.of("https://evil.example","null","http://localhost:81","http://localhost/path","http://user@localhost","http://localhost?query")) {
            var request=request("/druid/reset-all.json");request.addHeader("Origin",origin);assertEquals(403,assertThrows(ApiFailure.class,()->access.authenticate(request,session)).status());
        }verifyNoInteractions(tickets,bootstrap);
    }
    @Test void sameOriginAndBearerAccessStillRequireFreshAuthorization()
    {
        var request=request("/swagger-ui/index.html");request.addHeader("Origin","http://localhost");request.addHeader("Sec-Fetch-Site","same-origin");
        assertSame(session,access.authenticate(request,session));verifyNoInteractions(tickets);verify(bootstrap).refreshConsoleAuthorization(session);
    }
    @Test void onlyFixedCompatibilityResourcesAreEligibleForCookieAuthentication()
    {assertFalse(access.matches(request("/api/v1/system/users")));assertFalse(access.matches(request("/swagger-ui-evil/index.html")));assertTrue(access.matches(request("/druid/index.html")));assertTrue(access.matches(request("/v3/api-docs/swagger-config")));}
    @Test void cookiesRequirePositiveSameOriginEvidenceEvenWhenFetchMetadataIsMissing()
    {
        var request=request("/druid/reset-all.json");when(tickets.resolve(ConsoleTarget.DRUID,request)).thenReturn(session);
        assertEquals(403,assertThrows(ApiFailure.class,()->access.authenticate(request,null)).status());
        request.addHeader("Referer","http://localhost/druid/index.html");assertSame(session,access.authenticate(request,null));
        var hostile=request("/druid/reset-all.json");hostile.addHeader("Referer","http://evil.localhost/druid/index.html");when(tickets.resolve(ConsoleTarget.DRUID,hostile)).thenReturn(session);
        assertEquals(403,assertThrows(ApiFailure.class,()->access.authenticate(hostile,null)).status());
    }
}
