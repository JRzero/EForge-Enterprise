package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Scoped browser transport only. The consumer must refresh account/grants before authentication. */
@Service
public class ConsoleTicketService
{
    public static final int LIFETIME_SECONDS=300;
    private final RedisCache cache;
    private final SecureRandom random=new SecureRandom();
    public ConsoleTicketService(RedisCache cache){this.cache=cache;}

    public ResponseCookie issue(ConsoleTarget target, LoginUser session, boolean secure)
    {
        if(session==null || session.getToken()==null || session.getToken().isBlank())
            throw new ApiFailure(401,"AUTHENTICATION_REQUIRED","Authentication is required.");
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String ticket=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {cache.setCacheObject(key(target,ticket),session.getToken(),LIFETIME_SECONDS,TimeUnit.SECONDS);}
        catch(RuntimeException failure){throw unavailable();}
        return ResponseCookie.from(target.cookieName(),ticket).path(target.cookiePath())
                .httpOnly(true).secure(secure).sameSite("Strict").maxAge(LIFETIME_SECONDS).build();
    }

    public LoginUser resolve(ConsoleTarget target, HttpServletRequest request)
    {
        if(!target.contains(request.getRequestURI()) || request.getCookies()==null)return null;
        String ticket=null;
        for(Cookie cookie:request.getCookies())if(target.cookieName().equals(cookie.getName())) {
            if(ticket!=null)return null; // Reject ambiguous credentials.
            ticket=cookie.getValue();
        }
        if(ticket==null || !ticket.matches("[A-Za-z0-9_-]{43}"))return null;
        try {
            Object binding=cache.getCacheObject(key(target,ticket));
            if(!(binding instanceof String uuid) || !uuid.matches("[A-Za-z0-9-]{16,64}"))return null;
            Object value=cache.getCacheObject(CacheConstants.LOGIN_TOKEN_KEY+uuid);
            if(!(value instanceof LoginUser session) || !uuid.equals(session.getToken()))return null;
            // Read without extending ticket/session TTL; logout or full cache clear revokes access.
            return session;
        } catch(RuntimeException failure){throw unavailable();}
    }

    private static String key(ConsoleTarget target,String ticket)
    {
        try {return "console_tickets:"+target.name()+":"+HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(ticket.getBytes(StandardCharsets.US_ASCII)));}
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    private static ApiFailure unavailable()
    {return new ApiFailure(503,"CONSOLE_UNAVAILABLE","The diagnostic console is unavailable.");}
}
