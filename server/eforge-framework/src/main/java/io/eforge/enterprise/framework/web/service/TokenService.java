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
                log.error("获取用户信息异常'{}'", e.getMessage());
            }
        }
        return null;
    }

    /**
     * Read the persisted snapshot and TTL together. The original bytes are kept
     * only on this request object, so later profile/bootstrap writes can detect
     * authorization changes made after the request started.
     */
    public LoginUser getLoginUserByToken(String token)
    {
        if (StringUtils.isEmpty(token))
        {
            return null;
        }
        RedisCache.CacheSnapshot<LoginUser> snapshot = redisCache.getExpiringCacheSnapshot(getTokenKey(token));
        if (snapshot == null || snapshot.value() == null || !token.equals(snapshot.value().getToken()))
        {
            return null;
        }
        LoginUser loginUser = snapshot.value();
        loginUser.rememberCacheSnapshot(snapshot.bytes());
        // Redis TTL is authoritative; TTL-only renewal never rewrites the JSON.
        loginUser.setExpireTime(System.currentTimeMillis() + snapshot.ttlMillis());
        return loginUser;
    }

    /**
     * Compatibility entry point for updating an existing request snapshot.
     * A stale, expired or logged-out session is deliberately never recreated.
     */
    public void setLoginUser(LoginUser loginUser)
    {
        updateLoginUser(loginUser);
    }

    /**
     * Conditionally persist content without extending its remaining lifetime.
     * Callers that require authoritative permission propagation must reread and
     * recompute after a conflict; ordinary stale request updates are discarded.
     */
    public boolean updateLoginUser(LoginUser loginUser)
    {
        if (loginUser == null || StringUtils.isEmpty(loginUser.getToken()) || loginUser.cacheSnapshot() == null)
        {
            return false;
        }
        byte[] value = redisCache.serializeCacheObject(loginUser);
        boolean updated = redisCache.compareAndSetExpiringCacheObject(getTokenKey(loginUser.getToken()),
                loginUser.cacheSnapshot(), value);
        if (updated)
        {
            loginUser.rememberCacheSnapshot(value);
        }
        return updated;
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
        byte[] value = redisCache.serializeCacheObject(loginUser);
        if (!redisCache.createExpiringCacheObject(getTokenKey(token), value, expireTime * MILLIS_MINUTE))
        {
            throw new IllegalStateException("Could not create a unique login session");
        }
        loginUser.rememberCacheSnapshot(value);
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
        Long expiresAt = loginUser.getExpireTime();
        long currentTime = System.currentTimeMillis();
        if (expiresAt == null || expiresAt - currentTime <= MILLIS_MINUTE_TWENTY)
        {
            renewLifetime(loginUser, MILLIS_MINUTE_TWENTY);
        }
    }

    /**
     * 刷新令牌有效期
     * 
     * @param loginUser 登录信息
     */
    public void refreshToken(LoginUser loginUser)
    {
        // Kept for upstream callers. Content changes use setLoginUser instead.
        renewLifetime(loginUser, Long.MAX_VALUE);
    }

    private void renewLifetime(LoginUser loginUser, long thresholdMillis)
    {
        if (loginUser == null || StringUtils.isEmpty(loginUser.getToken()))
        {
            return;
        }
        long ttl = redisCache.renewExpiringCacheObject(getTokenKey(loginUser.getToken()),
                expireTime * MILLIS_MINUTE, thresholdMillis);
        if (ttl > 0)
        {
            loginUser.setExpireTime(System.currentTimeMillis() + ttl);
        }
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
     * Compatibility fallback for external callers of the imported API.
     * Canonical and legacy controllers use the committed authoritative refresher.
     * A caller without that DB snapshot can safely revoke, never publish cached roles.
     *
     * @param roleId            变更的角色ID
     * @param permissionService 权限服务
     */
    public void refreshPermissionByRoleId(Long roleId, SysPermissionService permissionService)
    {
        // 扫描所有在线 token
        String pattern = CacheConstants.LOGIN_TOKEN_KEY + "*";
        Collection<String> keys = redisCache.keys(pattern);
        if (keys == null || keys.isEmpty())
        {
            return;
        }
        for (String key : keys)
        {
            LoginUser loginUser = getLoginUserByToken(key.substring(CacheConstants.LOGIN_TOKEN_KEY.length()));
            if (loginUser == null || loginUser.getUser() == null || loginUser.getUser().isAdmin())
            {
                // 管理员拥有所有权限，跳过
                continue;
            }
            // 判断该用户是否拥有此角色
            boolean hasRole = loginUser.getUser().getRoles() != null
                    && loginUser.getUser().getRoles().stream().anyMatch(r -> roleId.equals(r.getRoleId()));
            if (!hasRole)
            {
                continue;
            }
            delLoginUser(loginUser.getToken());
            log.info("角色[{}]权限变更，已撤销在线用户[{}]的旧权限会话", roleId, loginUser.getUsername());
        }
    }
}
