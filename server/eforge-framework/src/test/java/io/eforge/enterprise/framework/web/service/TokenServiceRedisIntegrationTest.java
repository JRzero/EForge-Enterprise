package io.eforge.enterprise.framework.web.service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.RedisConfig;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Real Redis and production serializer checks for request/revocation interleavings.
 * Enable against an owned Redis fixture with -Deforge.test.redis.port=6379.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfSystemProperty(named = "eforge.test.redis.port", matches = "\\d+")
class TokenServiceRedisIntegrationTest
{
    private LettuceConnectionFactory connections;
    private RedisTemplate<Object, Object> redis;
    private TokenService tokens;
    private final List<String> ownedKeys = new ArrayList<>();

    @BeforeAll
    void connect()
    {
        connections = new LettuceConnectionFactory("127.0.0.1", Integer.parseInt(System.getProperty("eforge.test.redis.port")));
        connections.afterPropertiesSet();
        connections.start();
        redis = new RedisConfig().redisTemplate(connections);
        RedisCache cache = new RedisCache();
        cache.redisTemplate = redis;
        tokens = new TokenService()
        {
            @Override
            public void setUserAgent(LoginUser user)
            {
                // Request fingerprinting is independent of Redis session consistency.
            }
        };
        ReflectionTestUtils.setField(tokens, "redisCache", cache);
        ReflectionTestUtils.setField(tokens, "header", "Authorization");
        ReflectionTestUtils.setField(tokens, "secret", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        ReflectionTestUtils.setField(tokens, "expireTime", 30);
    }

    @AfterEach
    void removeOwnedSessions()
    {
        if (!ownedKeys.isEmpty()) redis.delete(new ArrayList<>(ownedKeys));
        ownedKeys.clear();
    }

    @AfterAll
    void disconnect()
    {
        if (connections != null) connections.destroy();
    }

    @Test
    void revokedSessionCannotBeRecreatedByAnyStaleRequestWrite()
    {
        Fixture fixture = login();
        LoginUser inFlight = read(fixture);
        inFlight.setExpireTime(System.currentTimeMillis());
        tokens.delLoginUser(inFlight.getToken());

        tokens.verifyToken(inFlight);
        assertNull(read(fixture), "Middleware renewal must not undo logout or forced revocation");
        tokens.refreshToken(inFlight);
        assertNull(read(fixture), "Compatibility renewal must not recreate the session");
        inFlight.getUser().setNickName("A profile write that finished after logout");
        tokens.setLoginUser(inFlight);
        assertNull(read(fixture), "An in-flight profile/bootstrap write must not undo revocation");
        assertFalse(Boolean.TRUE.equals(redis.hasKey(fixture.key())));
    }

    @Test
    void missingSessionIsAnOrdinaryCacheMissForDirectAuthorizationRefresh()
    {
        Fixture fixture = login();
        String token = read(fixture).getToken();
        tokens.delLoginUser(token);
        assertNull(tokens.getLoginUserByToken(token));
        assertNull(tokens.getLoginUserByToken("not-an-existing-session"));
    }

    @Test
    void oldRequestRenewalPreservesACompletedPermissionWithdrawal()
    {
        Fixture fixture = login();
        LoginUser inFlight = read(fixture);
        LoginUser authorization = read(fixture);
        authorization.setPermissions(Set.of());
        tokens.setLoginUser(authorization);
        assertTrue(redis.expire(fixture.key(), Duration.ofSeconds(20)));

        inFlight.setExpireTime(System.currentTimeMillis());
        tokens.verifyToken(inFlight);
        tokens.refreshToken(inFlight);

        LoginUser after = read(fixture);
        assertNotNull(after);
        assertTrue(after.getPermissions().isEmpty(), "TTL renewal must not publish the old permissions");
        assertTrue(redis.getExpire(fixture.key(), TimeUnit.SECONDS) > 60, "An existing short-lived session is still renewed");
    }

    @Test
    void staleProfileSnapshotCannotOverwriteNewAuthorizationButFreshProfileCanBeSaved()
    {
        Fixture fixture = login();
        LoginUser oldProfile = read(fixture);
        LoginUser authorization = read(fixture);
        authorization.setPermissions(Set.of());
        authorization.setDeptId(200L);
        authorization.getUser().setDeptId(200L);
        tokens.setLoginUser(authorization);

        oldProfile.getUser().setNickName("Stale profile");
        tokens.setLoginUser(oldProfile);
        LoginUser latest = read(fixture);
        assertTrue(latest.getPermissions().isEmpty());
        assertEquals(200L, latest.getDeptId());

        latest.getUser().setNickName("Current profile");
        tokens.setLoginUser(latest);
        LoginUser saved = read(fixture);
        assertEquals("Current profile", saved.getUser().getNickName());
        assertTrue(saved.getPermissions().isEmpty());
        assertEquals(200L, saved.getDeptId());
    }

    @Test
    void conditionalContentUpdatePreservesTheCurrentRemainingLifetime()
    {
        Fixture fixture = login();
        LoginUser profile = read(fixture);
        assertTrue(redis.expire(fixture.key(), Duration.ofSeconds(17)));
        profile.getUser().setNickName("Updated without extending the session");
        tokens.setLoginUser(profile);

        Long remaining = redis.getExpire(fixture.key(), TimeUnit.MILLISECONDS);
        assertNotNull(remaining);
        assertTrue(remaining > 0 && remaining <= 17_000, "Content changes must preserve Redis TTL rather than reset it");
        assertEquals("Updated without extending the session", read(fixture).getUser().getNickName());
    }

    @Test
    void oneSnapshotCanBeUpdatedAgainAfterItsOwnSuccessfulWrite()
    {
        Fixture fixture = login();
        LoginUser session = read(fixture);
        session.getUser().setNickName("First update");
        tokens.setLoginUser(session);
        session.getUser().setNickName("Second update");
        tokens.setLoginUser(session);
        assertEquals("Second update", read(fixture).getUser().getNickName());
    }

    private Fixture login()
    {
        SysUser user = new SysUser(42L);
        user.setUserName("session-concurrency-fixture");
        user.setNickName("Original profile");
        user.setDeptId(100L);
        user.setStatus("0");
        user.setDelFlag("0");
        user.setRoles(List.of());
        LoginUser session = new LoginUser(42L, 100L, user, Set.of("system:user:edit"));
        String jwt = tokens.createToken(session);
        String key = CacheConstants.LOGIN_TOKEN_KEY + session.getToken();
        ownedKeys.add(key);
        Fixture fixture = new Fixture(jwt, key);
        assertNotNull(read(fixture), "Login must still create an authenticatable session");
        return fixture;
    }

    private LoginUser read(Fixture fixture)
    {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + fixture.jwt());
        return tokens.getLoginUser(request);
    }

    private record Fixture(String jwt, String key) {}
}
