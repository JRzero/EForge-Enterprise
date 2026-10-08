package io.eforge.enterprise.framework.web.service;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.config.FastJson2JsonRedisSerializer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TokenServiceConcurrencyTest
{
    private TokenService tokens;
    private RedisCache cache;
    private RedisLoginSessionStore store;
    private LoginUser user;

    @BeforeEach
    void setup()
    {
        tokens = new TokenService();
        cache = mock(RedisCache.class);
        store = mock(RedisLoginSessionStore.class);
        ReflectionTestUtils.setField(tokens, "redisCache", cache);
        ReflectionTestUtils.setField(tokens, "sessionStore", store);
        ReflectionTestUtils.setField(tokens, "expireTime", 30);
        SysUser account = new SysUser(9007199254740993L);
        account.setUserName("session-fixture");
        user = new LoginUser(account.getUserId(), 105L, account, Set.of("old:grant"));
        user.setToken("existing");
    }

    @Test
    void ordinaryRenewalNeverWritesIdentityOrAuthorization()
    {
        when(store.renew("login_tokens:existing", 1800000L, Long.MAX_VALUE)).thenReturn(1800000L);
        tokens.refreshToken(user);
        verify(store).renew("login_tokens:existing", 1800000L, Long.MAX_VALUE);
        verifyNoMoreInteractions(store);
        verifyNoInteractions(cache);
        assertEquals(Set.of("old:grant"), user.getPermissions());
    }

    @Test
    void deletedOrExpiredSessionIsNotCreatedByEitherRefreshEntryPoint()
    {
        when(store.renew("login_tokens:existing", 1800000L, Long.MAX_VALUE)).thenReturn(-2L);
        when(store.update("login_tokens:existing", user)).thenReturn(false);
        tokens.refreshToken(user);
        tokens.setLoginUser(user);
        verify(store).renew("login_tokens:existing", 1800000L, Long.MAX_VALUE);
        verify(store).update("login_tokens:existing", user);
        verifyNoMoreInteractions(store);
        verifyNoInteractions(cache);
    }

    @Test
    void persistedTokenMustMatchTheRequestedKey()
    {
        when(store.read("login_tokens:other")).thenReturn(user);
        assertNull(tokens.getLoginUserByToken("other"));
        assertNull(tokens.getLoginUserByToken(""));
        assertFalse(tokens.updateLoginUser(null));
    }

    @Test
    void snapshotIsDefensivelyCopiedAndNeverSerialized() throws Exception
    {
        byte[] expected = {1, 2, 3};
        user.rememberCacheSnapshot(expected);
        expected[0] = 9;
        byte[] copy = user.cacheSnapshot();
        copy[1] = 9;
        assertArrayEquals(new byte[] {1, 2, 3}, user.cacheSnapshot());
        var serializer = new FastJson2JsonRedisSerializer<Object>(Object.class);
        byte[] stored = serializer.serialize(user);
        LoginUser restored = (LoginUser) serializer.deserialize(stored);
        assertNull(restored.cacheSnapshot());
        assertFalse(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(user).contains("cacheSnapshot"));
    }
}
