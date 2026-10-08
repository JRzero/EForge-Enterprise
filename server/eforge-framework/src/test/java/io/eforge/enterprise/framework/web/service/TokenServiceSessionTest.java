package io.eforge.enterprise.framework.web.service;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.FastJson2JsonRedisSerializer;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Deterministic request interleavings with the production serializer. The Redis
 * integration test separately executes the actual atomic scripts on Redis.
 */
class TokenServiceSessionTest
{
    private static final long MINUTE = 60_000;
    private MemoryRedis cache;
    private TokenService tokens;
    private String jwt;
    private String token;

    @BeforeEach
    void createSession()
    {
        cache = new MemoryRedis();
        tokens = new TokenService()
        {
            @Override
            public void setUserAgent(LoginUser session)
            {
                // User-agent parsing is independent of session persistence.
            }
        };
        ReflectionTestUtils.setField(tokens, "redisCache", cache);
        ReflectionTestUtils.setField(tokens, "header", "Authorization");
        ReflectionTestUtils.setField(tokens, "secret", "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=");
        ReflectionTestUtils.setField(tokens, "expireTime", 30);
        SysUser user = new SysUser(7L);
        user.setDeptId(103L);
        user.setUserName("session-test");
        user.setNickName("Original name");
        user.setStatus("0");
        user.setDelFlag("0");
        user.setRoles(java.util.List.of());
        LoginUser session = new LoginUser(7L, 103L, user, Set.of("system:user:edit"));
        jwt = tokens.createToken(session);
        token = session.getToken();
    }

    @Test
    void aRevokedSessionCannotBeRecreatedByAnyStaleWriter()
    {
        cache.remaining(key(), 5 * MINUTE);
        LoginUser inFlight = read();
        tokens.delLoginUser(token);

        tokens.verifyToken(inFlight);
        tokens.refreshToken(inFlight);
        inFlight.getUser().setNickName("Late profile");
        tokens.setLoginUser(inFlight);

        assertNull(read());
        assertFalse(tokens.updateLoginUser(inFlight));
        assertEquals(1, cache.creations, "Only the initial login may create a key");
    }

    @Test
    void staleRenewalProfileAndBootstrapCannotRestoreWithdrawnPermissions()
    {
        cache.remaining(key(), 5 * MINUTE);
        LoginUser inFlight = read();
        LoginUser authoritative = read();
        authoritative.setPermissions(Set.of());
        authoritative.getUser().setNickName("Authoritative name");
        assertTrue(tokens.updateLoginUser(authoritative));
        byte[] withdrawn = cache.bytes(key());

        tokens.verifyToken(inFlight);
        tokens.refreshToken(inFlight);
        inFlight.getUser().setNickName("Stale profile");
        tokens.setLoginUser(inFlight);

        assertArrayEquals(withdrawn, cache.bytes(key()), "Renewal cannot rewrite authorization JSON");
        LoginUser current = read();
        assertTrue(current.getPermissions().isEmpty());
        assertEquals("Authoritative name", current.getUser().getNickName());
        assertEquals(30 * MINUTE, cache.ttl(key()));
    }

    @Test
    void anAuthorizationWriterMustRereadAfterAConcurrentProfileUpdate()
    {
        LoginUser originalAuthority = read();
        LoginUser profile = read();
        profile.getUser().setNickName("New profile");
        assertTrue(tokens.updateLoginUser(profile));

        originalAuthority.setPermissions(Set.of());
        assertFalse(tokens.updateLoginUser(originalAuthority));
        LoginUser recomputed = read();
        recomputed.setPermissions(Set.of());
        assertTrue(tokens.updateLoginUser(recomputed));

        profile.getUser().setNickName("Late profile callback");
        tokens.setLoginUser(profile);
        assertTrue(read().getPermissions().isEmpty());
        assertEquals("New profile", read().getUser().getNickName());
    }

    @Test
    void contentUpdatesPreserveTheCurrentTtlAndSuccessfulSnapshotsCanBeUpdatedAgain()
    {
        cache.remaining(key(), 7 * MINUTE);
        LoginUser session = read();
        session.getUser().setNickName("First");
        assertTrue(tokens.updateLoginUser(session));
        session.getUser().setNickName("Second");
        assertTrue(tokens.updateLoginUser(session));

        assertEquals("Second", read().getUser().getNickName());
        assertEquals(7 * MINUTE, cache.ttl(key()));
    }

    @Test
    void readsUseActualTtlAfterRenewalAndDoNotRenewAgainOnEveryRequest()
    {
        long loggedInAt = read().getLoginTime();
        cache.remaining(key(), 5 * MINUTE);
        tokens.verifyToken(read());
        assertEquals(1, cache.renewals);
        cache.advance(MINUTE);

        LoginUser fresh = read();
        long remaining = fresh.getExpireTime() - System.currentTimeMillis();
        assertTrue(remaining > 28 * MINUTE && remaining <= 29 * MINUTE);
        tokens.verifyToken(fresh);
        assertEquals(1, cache.renewals);
        assertEquals(loggedInAt, fresh.getLoginTime(), "Renewal preserves the original login time");
    }

    @Test
    void aSessionWithoutAnObservedSnapshotCannotInsertOrOverwriteAnExistingKey()
    {
        LoginUser unobserved = new LoginUser(7L, 103L, new SysUser(7L), Set.of("*:*:*"));
        unobserved.setToken(token);
        tokens.setLoginUser(unobserved);
        assertFalse(tokens.updateLoginUser(unobserved));
        assertEquals(Set.of("system:user:edit"), read().getPermissions());

        unobserved.setToken("not-created-by-login");
        tokens.setLoginUser(unobserved);
        assertNull(tokens.getLoginUserByToken(unobserved.getToken()));
    }

    @Test
    void cacheSnapshotsAreNeitherSerializedNorAcceptedFromJson() throws Exception
    {
        LoginUser session = read();
        byte[] secretSnapshot = "request-local-marker".getBytes(StandardCharsets.UTF_8);
        session.rememberCacheSnapshot(secretSnapshot);
        secretSnapshot[0] = '!';
        assertEquals('r', session.cacheSnapshot()[0]);
        byte[] returned = session.cacheSnapshot();
        returned[0] = '?';
        assertEquals('r', session.cacheSnapshot()[0]);

        String redisJson = new String(cache.serializeCacheObject(session), StandardCharsets.UTF_8);
        ObjectMapper mapper = new ObjectMapper();
        String httpJson = mapper.writeValueAsString(session);
        assertFalse(redisJson.contains("cacheSnapshot"));
        assertFalse(httpJson.contains("cacheSnapshot"));
        assertFalse(redisJson.contains("request-local-marker"));
        assertFalse(httpJson.contains("request-local-marker"));
        String injectedSnapshot = "{\"cacheSnapshot\":\"aW5qZWN0ZWQ=\"}";
        assertThrows(UnrecognizedPropertyException.class, () -> mapper.readValue(injectedSnapshot, LoginUser.class));
        ObjectMapper ignoringUnknownFields = mapper.copy().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        assertNull(ignoringUnknownFields.readValue(injectedSnapshot, LoginUser.class).cacheSnapshot());
        assertNull(com.alibaba.fastjson2.JSON.parseObject(injectedSnapshot, LoginUser.class).cacheSnapshot());
    }

    private LoginUser read()
    {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwt);
        return tokens.getLoginUser(request);
    }

    private String key()
    {
        return CacheConstants.LOGIN_TOKEN_KEY + token;
    }

    /** Redis operation semantics only; values always cross the real serialization boundary. */
    private static final class MemoryRedis extends RedisCache
    {
        private final FastJson2JsonRedisSerializer<Object> serializer = new FastJson2JsonRedisSerializer<>(Object.class);
        private final Map<String, Entry> data = new HashMap<>();
        private long now = System.currentTimeMillis();
        private int creations;
        private int renewals;

        private record Entry(byte[] bytes, long expiresAt) {}

        @Override
        public byte[] serializeCacheObject(Object value)
        {
            return serializer.serialize(value);
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> CacheSnapshot<T> getExpiringCacheSnapshot(String key)
        {
            Entry entry = existing(key);
            return entry == null ? null : new CacheSnapshot<>((T) serializer.deserialize(entry.bytes()), entry.bytes(), entry.expiresAt() - now);
        }

        @Override
        public boolean createExpiringCacheObject(String key, byte[] value, long ttl)
        {
            if (existing(key) != null) return false;
            data.put(key, new Entry(value.clone(), now + ttl));
            creations++;
            return true;
        }

        @Override
        public boolean compareAndSetExpiringCacheObject(String key, byte[] expected, byte[] value)
        {
            Entry entry = existing(key);
            if (entry == null || !Arrays.equals(expected, entry.bytes())) return false;
            data.put(key, new Entry(value.clone(), entry.expiresAt()));
            return true;
        }

        @Override
        public long renewExpiringCacheObject(String key, long ttl, long threshold)
        {
            Entry entry = existing(key);
            if (entry == null) return -2;
            long remaining = entry.expiresAt() - now;
            if (remaining <= threshold)
            {
                data.put(key, new Entry(entry.bytes(), now + ttl));
                renewals++;
                return ttl;
            }
            return remaining;
        }

        @Override
        public boolean deleteObject(String key)
        {
            return data.remove(key) != null;
        }

        @Override
        public Collection<String> keys(String pattern)
        {
            return java.util.List.copyOf(data.keySet());
        }

        private Entry existing(String key)
        {
            Entry entry = data.get(key);
            if (entry != null && entry.expiresAt() <= now)
            {
                data.remove(key);
                return null;
            }
            return entry;
        }

        private byte[] bytes(String key)
        {
            return existing(key).bytes().clone();
        }

        private long ttl(String key)
        {
            Entry entry = existing(key);
            return entry == null ? -2 : entry.expiresAt() - now;
        }

        private void remaining(String key, long ttl)
        {
            data.put(key, new Entry(existing(key).bytes(), now + ttl));
        }

        private void advance(long millis)
        {
            now += millis;
        }
    }
}
