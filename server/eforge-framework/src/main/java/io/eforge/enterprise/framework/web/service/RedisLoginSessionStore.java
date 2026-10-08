package io.eforge.enterprise.framework.web.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.data.redis.connection.ReturnType;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.common.core.domain.model.LoginUser;

/** Single-key atomic session operations using the configured, lossless Java serializer. */
@Component
public class RedisLoginSessionStore
{
    private static final byte[] READ = script("""
            local value = redis.call('GET', KEYS[1])
            if not value then return nil end
            local ttl = redis.call('PTTL', KEYS[1])
            if ttl <= 0 then return nil end
            return {value, tostring(ttl)}
            """);
    private static final byte[] CREATE = script("""
            if redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return 1 end
            return 0
            """);
    private static final byte[] UPDATE = script("""
            local current = redis.call('GET', KEYS[1])
            if not current or current ~= ARGV[1] then return 0 end
            local ttl = redis.call('PTTL', KEYS[1])
            if ttl <= 0 then return 0 end
            redis.call('SET', KEYS[1], ARGV[2], 'PX', ttl)
            return 1
            """);
    private static final byte[] RENEW = script("""
            local ttl = redis.call('PTTL', KEYS[1])
            if ttl <= 0 then return ttl end
            if ttl <= tonumber(ARGV[2]) and ttl < tonumber(ARGV[1]) then
                redis.call('PEXPIRE', KEYS[1], ARGV[1])
                return tonumber(ARGV[1])
            end
            return ttl
            """);
    private final RedisTemplate<Object, Object> redis;

    public RedisLoginSessionStore(RedisTemplate<Object, Object> redis)
    {
        this.redis = redis;
    }

    public LoginUser read(String key)
    {
        List<?> result = redis.execute((RedisCallback<List<?>>) connection ->
                connection.scriptingCommands().eval(READ, ReturnType.MULTI, 1, key(key)));
        if (result == null || result.size() != 2) return null;
        byte[] bytes = (byte[]) result.get(0);
        long ttl = Long.parseLong(new String((byte[]) result.get(1), StandardCharsets.UTF_8));
        Object value = redis.getValueSerializer().deserialize(bytes);
        if (!(value instanceof LoginUser user)) return null;
        user.rememberCacheSnapshot(bytes);
        // The stored JSON deadline may predate a TTL-only renewal. Redis owns expiry.
        user.setExpireTime(System.currentTimeMillis() + ttl);
        return user;
    }

    public boolean create(String key, LoginUser user, long ttlMillis)
    {
        if (ttlMillis <= 0) throw new IllegalArgumentException("A positive session lifetime is required");
        byte[] value = value(user);
        Long result = redis.execute((RedisCallback<Long>) connection ->
                connection.scriptingCommands().eval(CREATE, ReturnType.INTEGER, 1,
                        key(key), value, number(ttlMillis)));
        if (!Long.valueOf(1).equals(result)) return false;
        user.rememberCacheSnapshot(value);
        return true;
    }

    /** Never insert, overwrite a newer snapshot, or reset the remaining lifetime. */
    public boolean update(String key, LoginUser user)
    {
        byte[] expected = user.cacheSnapshot();
        if (expected == null) return false;
        byte[] value = value(user);
        Long result = redis.execute((RedisCallback<Long>) connection ->
                connection.scriptingCommands().eval(UPDATE, ReturnType.INTEGER, 1,
                        key(key), expected, value));
        if (!Long.valueOf(1).equals(result)) return false;
        user.rememberCacheSnapshot(value);
        return true;
    }

    /** Extend an existing key only; never write caller-provided identity or permissions. */
    public long renew(String key, long ttlMillis, long thresholdMillis)
    {
        if (ttlMillis <= 0 || thresholdMillis < 0) throw new IllegalArgumentException("Invalid session lifetime");
        Long result = redis.execute((RedisCallback<Long>) connection ->
                connection.scriptingCommands().eval(RENEW, ReturnType.INTEGER, 1,
                        key(key), number(ttlMillis), number(thresholdMillis)));
        return result == null ? -2 : result;
    }

    @SuppressWarnings("unchecked")
    private byte[] key(String key)
    {
        return ((RedisSerializer<Object>) redis.getKeySerializer()).serialize(key);
    }

    @SuppressWarnings("unchecked")
    private byte[] value(LoginUser value)
    {
        // Do not decode/re-encode this JSON in Lua: Fastjson type markers and long IDs must survive.
        return ((RedisSerializer<Object>) redis.getValueSerializer()).serialize(value);
    }

    private static byte[] number(long value) { return script(Long.toString(value)); }
    private static byte[] script(String value) { return value.getBytes(StandardCharsets.UTF_8); }
}
