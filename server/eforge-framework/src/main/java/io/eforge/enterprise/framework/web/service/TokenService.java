package io.eforge.enterprise.framework.web.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.constant.Constants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.utils.ServletUtils;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.common.utils.http.UserAgentUtils;
import io.eforge.enterprise.common.utils.ip.AddressUtils;
import io.eforge.enterprise.common.utils.ip.IpUtils;
import io.eforge.enterprise.common.utils.uuid.IdUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.servlet.http.HttpServletRequest;

/**
 * token验证处理
 * 
 * @author ruoyi
 */
@Component
public class TokenService
{
    private static final Logger log = LoggerFactory.getLogger(TokenService.class);

    // 令牌自定义标识
    @Value("${token.header}")
    private String header;

    // 令牌秘钥
    @Value("${token.secret}")
    private String secret;

    // 令牌有效期（默认30分钟）
    @Value("${token.expireTime}")
    private int expireTime;

    protected static final long MILLIS_SECOND = 1000;

    protected static final long MILLIS_MINUTE = 60 * MILLIS_SECOND;

    private static final Long MILLIS_MINUTE_TWENTY = 20 * 60 * 1000L;

    @Autowired
    private RedisCache redisCache;

    @Autowired
    private RedisLoginSessionStore sessionStore;

    /**
     * 获取用户身份信息
     * 
     * @return 用户信息
     */
    public LoginUser getLoginUser(HttpServletRequest request)
    {
        // 获取请求携带的令牌
        String token = getToken(request);
        if (StringUtils.isNotEmpty(token))
        {
            try
            {
                Claims claims = parseToken(token);
                // 解析对应的权限以及用户信息
                String uuid = (String) claims.get(Constants.LOGIN_USER_KEY);
                return getLoginUserByToken(uuid);
            }
            catch (Exception e)
            {
                log.warn("Login session could not be read or verified");
            }
        }
        return null;
    }

    /**
     * 设置用户身份信息
     */
    public void setLoginUser(LoginUser loginUser)
    {
        updateLoginUser(loginUser);
    }

    /** Read exact persisted content and lifetime before allowing conditional changes. */
    public LoginUser getLoginUserByToken(String token)
    {
        if (StringUtils.isEmpty(token)) return null;
        LoginUser user = sessionStore.read(getTokenKey(token));
        return user != null && token.equals(user.getToken()) ? user : null;
    }

    /** Stale ordinary requests must not replace newly committed authorization. */
    public boolean updateLoginUser(LoginUser loginUser)
    {
        return loginUser != null && StringUtils.isNotEmpty(loginUser.getToken())
                && sessionStore.update(getTokenKey(loginUser.getToken()), loginUser);
    }

    /**
     * 删除用户身份信息
     */
    public void delLoginUser(String token)
    {
        if (StringUtils.isNotEmpty(token))
        {
            String userKey = getTokenKey(token);
            redisCache.deleteObject(userKey);
        }
    }

    /**
     * 创建令牌
     * 
     * @param loginUser 用户信息
     * @return 令牌
     */
    public String createToken(LoginUser loginUser)
    {
        String token = IdUtils.fastUUID();
        loginUser.setToken(token);
        setUserAgent(loginUser);
        loginUser.setLoginTime(System.currentTimeMillis());
        loginUser.setExpireTime(loginUser.getLoginTime() + expireTime * MILLIS_MINUTE);

        Map<String, Object> claims = new HashMap<>();
        claims.put(Constants.LOGIN_USER_KEY, token);
        claims.put(Constants.JWT_USERNAME, loginUser.getUsername());
        String jwt = createToken(claims);
        if (!sessionStore.create(getTokenKey(token), loginUser, expireTime * MILLIS_MINUTE))
            throw new IllegalStateException("Could not create a unique login session");
        return jwt;
    }

    /**
     * 验证令牌有效期，相差不足20分钟，自动刷新缓存
     * 
     * @param loginUser 登录信息
     * @return 令牌
     */
    public void verifyToken(LoginUser loginUser)
    {
        if (loginUser == null) return;
        Long expiresAt = loginUser.getExpireTime();
        if (expiresAt == null || expiresAt - System.currentTimeMillis() <= MILLIS_MINUTE_TWENTY)
            renewLifetime(loginUser, MILLIS_MINUTE_TWENTY);
    }

    /** Refresh lifetime only. Content changes use setLoginUser/updateLoginUser. */
    public void refreshToken(LoginUser loginUser)
    {
        renewLifetime(loginUser, Long.MAX_VALUE);
    }

    private void renewLifetime(LoginUser loginUser, long thresholdMillis)
    {
        if (loginUser == null || StringUtils.isEmpty(loginUser.getToken())) return;
        long ttl = sessionStore.renew(getTokenKey(loginUser.getToken()),
                expireTime * MILLIS_MINUTE, thresholdMillis);
        if (ttl > 0) loginUser.setExpireTime(System.currentTimeMillis() + ttl);
    }

    /**
     * 设置用户代理信息
     * 
     * @param loginUser 登录信息
     */
    public void setUserAgent(LoginUser loginUser)
    {
        String userAgent = ServletUtils.getRequest().getHeader("User-Agent");
        String ip = IpUtils.getIpAddr();
        loginUser.setIpaddr(ip);
        loginUser.setLoginLocation(AddressUtils.getRealAddressByIP(ip));
        loginUser.setBrowser(UserAgentUtils.getBrowser(userAgent));
        loginUser.setOs(UserAgentUtils.getOperatingSystem(userAgent));
    }

    /**
     * 从数据声明生成令牌
     *
     * @param claims 数据声明
     * @return 令牌
     */
    private String createToken(Map<String, Object> claims)
    {
        String token = Jwts.builder()
                .setClaims(claims)
                .signWith(SignatureAlgorithm.HS512, secret).compact();
        return token;
    }

    /**
     * 从令牌中获取数据声明
     *
     * @param token 令牌
     * @return 数据声明
     */
    private Claims parseToken(String token)
    {
        return Jwts.parser()
                .setSigningKey(secret)
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * 从令牌中获取用户名
     *
     * @param token 令牌
     * @return 用户名
     */
    public String getUsernameFromToken(String token)
    {
        Claims claims = parseToken(token);
        return claims.getSubject();
    }

    /**
     * 获取请求token
     *
     * @param request
     * @return token
     */
    private String getToken(HttpServletRequest request)
    {
        String token = request.getHeader(header);
        if (StringUtils.isNotEmpty(token) && token.startsWith(Constants.TOKEN_PREFIX))
        {
            token = token.replace(Constants.TOKEN_PREFIX, "");
        }
        return token;
    }

    private String getTokenKey(String uuid)
    {
        return CacheConstants.LOGIN_TOKEN_KEY + uuid;
    }

    /**
     * 角色权限变更后，刷新所有持有该角色的在线用户权限
     *
     * @param roleId            变更的角色ID
     * @param permissionService 权限服务
     */
    public void refreshPermissionByRoleId(Long roleId, SysPermissionService permissionService)
    {
        Collection<String> keys = redisCache.keys(CacheConstants.LOGIN_TOKEN_KEY + "*");
        if (keys == null) return;
        for (String key : keys)
        {
            if (!key.startsWith(CacheConstants.LOGIN_TOKEN_KEY)) continue;
            String token = key.substring(CacheConstants.LOGIN_TOKEN_KEY.length());
            for (int attempt = 0; attempt < 4; attempt++)
            {
                LoginUser user = getLoginUserByToken(token);
                if (user == null || user.getUser() == null || user.getUser().isAdmin()) break;
                boolean hasRole = user.getUser().getRoles() != null
                        && user.getUser().getRoles().stream().anyMatch(r -> roleId.equals(r.getRoleId()));
                if (!hasRole) break;
                user.setPermissions(permissionService.getMenuPermission(user.getUser()));
                if (updateLoginUser(user)) break;
                // Re-read on conflict; never turn a failed compare into an unconditional write.
                if (attempt == 3) delLoginUser(token);
            }
        }
    }
}
