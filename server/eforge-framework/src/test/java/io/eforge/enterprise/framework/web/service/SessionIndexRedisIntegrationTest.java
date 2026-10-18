package io.eforge.enterprise.framework.web.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.RedisConfig;
import io.lettuce.core.RedisClient;
import io.lettuce.core.AclSetuserArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.protocol.CommandType;
import static org.junit.jupiter.api.Assertions.*;

/** Actual pinned Redis commands, expiry and serializer, using only fixture-owned keys/users. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfSystemProperty(named = "eforge.test.redis.port", matches = "\\d+")
class SessionIndexRedisIntegrationTest
{
    private LettuceConnectionFactory connection;
    private RedisTemplate<Object,Object> redis;
    private CountingCache cache;
    private SessionIndexService index;
    private RedisClient adminClient;
    private StatefulRedisConnection<String,String> admin;
    private final List<String> owned = new ArrayList<>();
    private final long user = 9007199254740995L;

    static class CountingCache extends RedisCache
    {
        int scans, reads;
        Runnable beforeScan;
        @Override public Collection<String> scanKeys(String pattern)
        {
            scans++;
            if (beforeScan != null) { Runnable callback = beforeScan; beforeScan = null; callback.run(); }
            return super.scanKeys(pattern);
        }
        @Override public <T> CacheSnapshot<T> getExpiringCacheSnapshot(String key)
        { reads++; return super.getExpiringCacheSnapshot(key); }
    }

    @BeforeAll void connect()
    {
        connection = new LettuceConnectionFactory("127.0.0.1", Integer.parseInt(System.getProperty("eforge.test.redis.port")));
        connection.afterPropertiesSet(); connection.start();
        redis = new RedisConfig().redisTemplate(connection);
        cache = new CountingCache(); cache.redisTemplate = redis;
        index = new SessionIndexService(cache);
        adminClient = RedisClient.create("redis://127.0.0.1:" + System.getProperty("eforge.test.redis.port"));
        admin = adminClient.connect();
    }
    @AfterEach void cleanup()
    {
        redis.delete(new ArrayList<Object>(owned)); owned.clear();
        cache.scans = 0; cache.reads = 0; cache.beforeScan = null;
        ReflectionTestUtils.setField(index, "enabled", true);
    }
    @AfterAll void close()
    {
        if (admin != null) admin.close();
        if (adminClient != null) adminClient.shutdown();
        if (connection != null) connection.destroy();
    }

    private LoginUser session(long id)
    {
        LoginUser session = new LoginUser(id, 103L, new SysUser(id), Set.of("original:permission"));
        session.setToken("owned-index-" + UUID.randomUUID());
        owned.add(key(session)); owned.add(SessionIndexService.PREFIX + id);
        return session;
    }
    private String key(LoginUser session) { return "login_tokens:" + session.getToken(); }
    private LoginUser create(long id, long ttl)
    {
        LoginUser session = session(id);
        assertTrue(index.create(session, cache.serializeCacheObject(session), ttl));
        return session;
    }
    private Set<String> keys(long id) { return new LinkedHashSet<>(index.sessionKeys(Set.of(id))); }

    @Test void oldSessionsRecoverOnceThenOnlyAffectedKeysAreRead()
    {
        Set<String> wanted = new LinkedHashSet<>();
        for (int i = 0; i < 100; i++)
        {
            LoginUser session = session(i < 3 ? user : user + 1);
            assertTrue(cache.createExpiringCacheObject(key(session), cache.serializeCacheObject(session), 60000));
            if (i < 3) wanted.add(key(session));
        }
        assertEquals(wanted, keys(user));
        assertEquals(1, cache.scans); assertEquals(100, cache.reads);
        cache.scans = 0; cache.reads = 0;
        assertEquals(wanted, keys(user));
        assertEquals(0, cache.scans); assertEquals(0, cache.reads, "Index lookup must not decode unrelated sessions");
        for (String key : wanted) assertNotNull(cache.getExpiringCacheSnapshot(key));
        assertEquals(3, cache.reads);
    }

    @Test void creationAndRenewalMaintainACompleteIndexWithOriginalIdentity()
    {
        LoginUser first = create(user, 60000);
        assertEquals(Set.of(key(first)), keys(user));
        cache.scans = 0;
        LoginUser second = create(user, 60000);
        assertEquals(Set.of(key(first), key(second)), keys(user));
        byte[] original = cache.getExpiringCacheSnapshot(key(first)).bytes();
        assertEquals(120000, index.renew(first, 120000, Long.MAX_VALUE));
        assertArrayEquals(original, cache.getExpiringCacheSnapshot(key(first)).bytes(), "TTL renewal cannot rewrite authority");
        assertEquals(Set.of(key(first), key(second)), keys(user));
        assertEquals(0, cache.scans);
        assertTrue(redis.getExpire(SessionIndexService.PREFIX + user, TimeUnit.MILLISECONDS) >= redis.getExpire(key(first), TimeUnit.MILLISECONDS));
    }

    @Test void missingIndexFollowedByNewLoginCannotHideAnExistingSession()
    {
        LoginUser first = create(user, 60000); keys(user);
        redis.delete(SessionIndexService.PREFIX + user);
        LoginUser second = create(user, 60000);
        cache.scans = 0;
        assertEquals(Set.of(key(first), key(second)), keys(user));
        assertEquals(1, cache.scans);
    }

    @Test void concurrentCreationInvalidatesRecoveryRevisionInsteadOfCompletingAnOldSnapshot()
    {
        LoginUser first = create(user, 60000);
        List<LoginUser> concurrent = new ArrayList<>();
        cache.beforeScan = () -> concurrent.add(create(user, 60000));
        assertEquals(2, keys(user).size());
        assertEquals(1, cache.scans);
        assertEquals(Set.of(key(first), key(concurrent.get(0))), keys(user));
        assertEquals(2, cache.scans, "The conflicted repair must remain incomplete until a new full scan");
        keys(user); assertEquals(2, cache.scans);
    }

    @Test void compareAndSetAndLogoutCannotResurrectOrExtendASession()
    {
        LoginUser session = create(user, 60000); keys(user);
        var before = cache.<LoginUser>getExpiringCacheSnapshot(key(session));
        session.setPermissions(Set.of());
        assertTrue(index.compareAndSet(session, before.bytes(), cache.serializeCacheObject(session)));
        assertTrue(cache.getExpiringCacheSnapshot(key(session)).ttlMillis() <= before.ttlMillis());
        assertFalse(index.compareAndSet(session, before.bytes(), cache.serializeCacheObject(session)));
        redis.delete(key(session));
        assertFalse(index.compareAndSet(session, cache.serializeCacheObject(session), cache.serializeCacheObject(session)));
        assertEquals(-2, index.renew(session, 60000, Long.MAX_VALUE));
        for (String candidate : keys(user)) assertNull(cache.getExpiringCacheSnapshot(candidate));
        assertFalse(redis.hasKey(key(session)));
    }

    @Test void expiredMembersArePrunedWithoutTreatingMissingMetadataAsEmpty() throws Exception
    {
        LoginUser session = create(user, 1000); keys(user);
        Thread.sleep(1100);
        assertNull(cache.getExpiringCacheSnapshot(key(session)));
        assertEquals(Set.of(), keys(user));
        redis.delete(SessionIndexService.PREFIX + user);
        cache.scans = 0; assertEquals(Set.of(), keys(user)); assertEquals(1, cache.scans);
    }

    @Test void corruptCompletenessAndCacheClearingRequireSafeRecovery()
    {
        LoginUser session = create(user, 60000); keys(user);
        assertEquals(1, admin.sync().zadd(SessionIndexService.PREFIX + user, -1, "invalid-metadata"));
        cache.scans = 0; assertEquals(Set.of(key(session)), keys(user)); assertEquals(1, cache.scans);
        redis.delete(List.<Object>of(key(session), SessionIndexService.PREFIX + user));
        assertEquals(Set.of(), keys(user));
        LoginUser replacement = create(user, 60000);
        assertEquals(Set.of(key(replacement)), keys(user));
    }

    @ParameterizedTest
    @EnumSource(value = CommandType.class, names = {"PEXPIRETIME", "PEXPIREAT", "ZADD", "ZREMRANGEBYSCORE", "SET"})
    void scriptCommandFailuresPreserveEveryCreatedSessionAndPermitRecovery(CommandType deniedCommand)
    {
        LoginUser first = create(user, 60000); keys(user);
        String username = "owned_index_" + UUID.randomUUID().toString().replace("-", "");
        String password = UUID.randomUUID().toString();
        assertEquals("OK", admin.sync().aclSetuser(username, new AclSetuserArgs().reset().on().addPassword(password)
                .allKeys().allCommands().removeCommand(deniedCommand)));
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration("127.0.0.1", Integer.parseInt(System.getProperty("eforge.test.redis.port")));
        config.setUsername(username); config.setPassword(password);
        LettuceConnectionFactory restricted = new LettuceConnectionFactory(config);
        restricted.afterPropertiesSet(); restricted.start();
        try
        {
            RedisCache limited = new RedisCache(); limited.redisTemplate = new RedisConfig().redisTemplate(restricted);
            SessionIndexService limitedIndex = new SessionIndexService(limited);
            LoginUser second = session(user);
            assertThrows(RuntimeException.class, () -> limitedIndex.create(second, cache.serializeCacheObject(second), 60000));
            boolean written = deniedCommand == CommandType.PEXPIRETIME || deniedCommand == CommandType.PEXPIREAT;
            assertEquals(written, cache.getExpiringCacheSnapshot(key(second)) != null,
                    "Verify the actual fallible-command boundary, not an early fixture error");
            cache.scans = 0;
            assertEquals(written ? Set.of(key(first), key(second)) : Set.of(key(first)), keys(user));
            // ZREMRANGEBYSCORE is the first index mutation: denial leaves the old complete index intact.
            assertEquals(deniedCommand == CommandType.ZREMRANGEBYSCORE ? 0 : 1, cache.scans);
        }
        finally { restricted.destroy(); assertEquals(1, admin.sync().aclDeluser(username)); }
    }

    @Test void compatibilityModeKeepsFullScanningAndUnchangedLoginKeys()
    {
        ReflectionTestUtils.setField(index, "enabled", false);
        LoginUser session = create(user, 60000);
        assertFalse(redis.hasKey(SessionIndexService.PREFIX + user));
        assertTrue(keys(user).contains(key(session))); assertEquals(1, cache.scans);
        assertTrue(keys(user).contains(key(session))); assertEquals(2, cache.scans);
    }

    @Test void documentedRolloutRetainsSessionsAndRebuildsAfterAllWritersUpgrade()
    {
        LoginUser current = create(user, 60000); keys(user);
        byte[] original = cache.getExpiringCacheSnapshot(key(current)).bytes();
        ReflectionTestUtils.setField(index, "enabled", false);
        LoginUser mixedVersion = create(user, 60000);
        assertEquals(Set.of(key(current), key(mixedVersion)), keys(user));
        // Model the explicit upgrade step: remove only the internal acceleration index.
        redis.delete(SessionIndexService.PREFIX + user);
        ReflectionTestUtils.setField(index, "enabled", true);
        cache.scans = 0;
        assertEquals(Set.of(key(current), key(mixedVersion)), keys(user));
        assertEquals(1, cache.scans);
        LoginUser afterUpgrade = create(user, 60000);
        assertEquals(Set.of(key(current), key(mixedVersion), key(afterUpgrade)), keys(user));
        assertEquals(1, cache.scans);
        assertArrayEquals(original, cache.getExpiringCacheSnapshot(key(current)).bytes());
    }

    @Test void concurrentRenewalPreventsCompletingAnObsoleteRecovery()
    {
        LoginUser first = create(user, 60000);
        cache.beforeScan = () -> assertEquals(120000, index.renew(first, 120000, Long.MAX_VALUE));
        assertEquals(Set.of(key(first)), keys(user));
        assertEquals(1, cache.scans);
        assertEquals(Set.of(key(first)), keys(user));
        assertEquals(2, cache.scans);
        keys(user); assertEquals(2, cache.scans);
        assertTrue(redis.getExpire(SessionIndexService.PREFIX + user, TimeUnit.MILLISECONDS)
                >= redis.getExpire(key(first), TimeUnit.MILLISECONDS));
    }

    @Test void oversizedRecoveryReturnsEverySessionWithoutPublishingATruncatedIndex()
    {
        Set<String> expected = new LinkedHashSet<>();
        for (int i = 0; i < 4097; i++)
        {
            LoginUser session = session(user);
            assertTrue(cache.createExpiringCacheObject(key(session), cache.serializeCacheObject(session), 120000));
            expected.add(key(session));
        }
        assertEquals(expected, keys(user));
        assertEquals(1, cache.scans);
        assertFalse(redis.hasKey(SessionIndexService.PREFIX + user));
        assertEquals(expected, keys(user));
        assertEquals(2, cache.scans, "An oversized recovery must retain the full fallback path");
    }

    @Test void wrongIndexTypeFailsWithoutCreatingOrRewritingSessions()
    {
        LoginUser first = create(user, 60000); keys(user);
        byte[] original = cache.getExpiringCacheSnapshot(key(first)).bytes();
        admin.sync().del(SessionIndexService.PREFIX + user);
        admin.sync().set(SessionIndexService.PREFIX + user, "owned wrong-type fixture");
        LoginUser second = session(user);
        assertThrows(RuntimeException.class, () -> index.create(second, cache.serializeCacheObject(second), 60000));
        assertThrows(RuntimeException.class, () -> keys(user));
        assertFalse(redis.hasKey(key(second)));
        assertArrayEquals(original, cache.getExpiringCacheSnapshot(key(first)).bytes());
        admin.sync().del(SessionIndexService.PREFIX + user);
        assertEquals(Set.of(key(first)), keys(user));
    }
}
