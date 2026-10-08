package io.eforge.enterprise.framework.web.service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.FastJson2JsonRedisSerializer;
import static org.junit.jupiter.api.Assertions.*;

/** Real Redis and production serializer. Uses only UUID-owned keys; never FLUSHDB. */
@EnabledIfSystemProperty(named = "eforge.test.redis.port", matches = "[0-9]+")
class TokenServiceRedisIntegrationTest
{
    private LettuceConnectionFactory factory;
    private RedisTemplate<Object, Object> redis;
    private RedisLoginSessionStore store;
    private TokenService tokens;
    private final List<String> ownedKeys = new ArrayList<>();

    @BeforeEach
    void setup()
    {
        factory = new LettuceConnectionFactory("127.0.0.1", Integer.parseInt(System.getProperty("eforge.test.redis.port")));
        factory.afterPropertiesSet();
        redis = new RedisTemplate<>();
        redis.setConnectionFactory(factory);
        redis.setKeySerializer(new StringRedisSerializer());
        redis.setValueSerializer(new FastJson2JsonRedisSerializer<Object>(Object.class));
        redis.afterPropertiesSet();
        store = new RedisLoginSessionStore(redis);
        RedisCache cache = new RedisCache();
        cache.redisTemplate = redis;
        tokens = new TokenService() { @Override public void setUserAgent(LoginUser user) {} };
        ReflectionTestUtils.setField(tokens, "redisCache", cache);
        ReflectionTestUtils.setField(tokens, "sessionStore", store);
        ReflectionTestUtils.setField(tokens, "expireTime", 30);
        ReflectionTestUtils.setField(tokens, "header", "Authorization");
        ReflectionTestUtils.setField(tokens, "secret", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    }

    @AfterEach
    void cleanup()
    {
        try { if (redis != null && !ownedKeys.isEmpty()) redis.delete(new ArrayList<Object>(ownedKeys)); }
        finally { if (factory != null) factory.destroy(); }
    }

    private LoginUser account()
    {
        SysUser account = new SysUser(9007199254740993L);
        account.setUserName("redis-session-fixture");
        account.setNickName("会话测试");
        account.setRoles(List.of());
        return new LoginUser(account.getUserId(), 105L, account, Set.of("old:grant"));
    }

    private LoginUser seedLegacy()
    {
        LoginUser user = account();
        user.setToken("round2-" + UUID.randomUUID());
        user.setLoginTime(System.currentTimeMillis());
        user.setExpireTime(System.currentTimeMillis() + 60000);
        String key = "login_tokens:" + user.getToken();
        ownedKeys.add(key);
        // Deliberately use the pre-fix writer: deployed sessions must remain readable.
        redis.opsForValue().set(key, user, Duration.ofSeconds(60));
        return tokens.getLoginUserByToken(user.getToken());
    }

    @Test
    void actualCreateReadAndJwtLogoutLifecycle()
    {
        LoginUser user = account();
        String jwt = tokens.createToken(user);
        ownedKeys.add("login_tokens:" + user.getToken());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwt);
        LoginUser restored = tokens.getLoginUser(request);
        assertNotNull(restored);
        assertEquals(9007199254740993L, restored.getUserId());
        assertTrue(redis.getExpire(ownedKeys.get(0), TimeUnit.SECONDS) > 1700);
        tokens.delLoginUser(user.getToken());
        assertNull(tokens.getLoginUser(request));
    }

    @Test
    void logoutAfterRequestReadCannotBeUndoneByLateRenewOrContentWrite()
    {
        LoginUser stale = seedLegacy();
        tokens.delLoginUser(stale.getToken());
        tokens.refreshToken(stale);
        tokens.setLoginUser(stale);
        assertFalse(Boolean.TRUE.equals(redis.hasKey("login_tokens:" + stale.getToken())));
    }

    @Test
    void revokedPermissionsSurviveBothKindsOfLateRequest()
    {
        LoginUser stale = seedLegacy();
        LoginUser current = tokens.getLoginUserByToken(stale.getToken());
        current.setPermissions(Set.of("new:grant"));
        assertTrue(tokens.updateLoginUser(current));
        tokens.refreshToken(stale);
        assertFalse(tokens.updateLoginUser(stale));
        LoginUser result = tokens.getLoginUserByToken(stale.getToken());
        assertEquals(Set.of("new:grant"), result.getPermissions());
        assertEquals(9007199254740993L, result.getUserId());
    }

    @Test
    void contentUpdateUsesCurrentTtlAtomicallyWithoutExtendingOrShorteningRenewal()
    {
        LoginUser observed = seedLegacy();
        String key = "login_tokens:" + observed.getToken();
        redis.expire(key, Duration.ofSeconds(25));
        observed.getUser().setNickName("changed");
        assertTrue(tokens.updateLoginUser(observed));
        long shortTtl = redis.getExpire(key, TimeUnit.MILLISECONDS);
        assertTrue(shortTtl > 0 && shortTtl <= 25000);
        LoginUser later = tokens.getLoginUserByToken(observed.getToken());
        tokens.refreshToken(observed);
        later.setPermissions(Set.of());
        assertTrue(tokens.updateLoginUser(later));
        assertTrue(redis.getExpire(key, TimeUnit.SECONDS) > 1700);
    }

    @Test
    void ttlOnlyRenewalRetainsExactSerializedContentAndEffectiveExpiryComesFromRedis()
    {
        LoginUser observed = seedLegacy();
        byte[] original = observed.cacheSnapshot();
        tokens.refreshToken(observed);
        LoginUser renewed = tokens.getLoginUserByToken(observed.getToken());
        assertArrayEquals(original, renewed.cacheSnapshot());
        assertTrue(renewed.getExpireTime() - System.currentTimeMillis() > 1700000L);
    }

    @Test
    void expiredAndNonExpiringKeysFailClosedAndCannotBeCreatedByUpdate()
    {
        LoginUser observed = seedLegacy();
        String key = "login_tokens:" + observed.getToken();
        redis.persist(key);
        assertNull(tokens.getLoginUserByToken(observed.getToken()));
        assertFalse(tokens.updateLoginUser(observed));
        tokens.refreshToken(observed);
        assertEquals(-1L, redis.getExpire(key));
        redis.expire(key, Duration.ZERO);
        assertNull(tokens.getLoginUserByToken(observed.getToken()));
        tokens.refreshToken(observed);
        assertFalse(Boolean.TRUE.equals(redis.hasKey(key)));
    }

    @Test
    void creationCannotOverwriteAnExistingSessionAndUnobservedObjectsCannotUpdateIt()
    {
        LoginUser observed = seedLegacy();
        String key = "login_tokens:" + observed.getToken();
        LoginUser unobserved = account();
        unobserved.setToken(observed.getToken());
        assertFalse(store.create(key, unobserved, 60000));
        assertFalse(tokens.updateLoginUser(unobserved));
        assertEquals(Set.of("old:grant"), tokens.getLoginUserByToken(observed.getToken()).getPermissions());
    }
}
