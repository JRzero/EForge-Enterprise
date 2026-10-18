package io.eforge.enterprise.framework.web.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.connection.ReturnType;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;

/** An acceleration index, never an authorization source or proof of token existence. */
@Service
@SuppressWarnings({"unchecked", "rawtypes"})
public class SessionIndexService
{
    public static final String PREFIX = "login_user_sessions:";
    private static final int MAX_REBUILD_MEMBERS = 4096;
    private static final byte[] WRITE = script("write.lua"), READ = script("read.lua"), REBUILD = script("rebuild.lua");
    private final RedisCache cache;

    @Value("${token.sessionIndexEnabled:true}")
    private boolean enabled = true;

    public SessionIndexService(RedisCache cache) { this.cache = cache; }

    public boolean create(LoginUser session, byte[] value, long ttl)
    {
        if (ttl <= 0) throw new IllegalArgumentException("A positive session TTL is required");
        if (!enabled) return cache.createExpiringCacheObject(CacheConstants.LOGIN_TOKEN_KEY + session.getToken(), value, ttl);
        return write(session, "create", value, bytes(ttl), 0) == 1;
    }

    public boolean compareAndSet(LoginUser session, byte[] expected, byte[] value)
    {
        if (!enabled) return cache.compareAndSetExpiringCacheObject(CacheConstants.LOGIN_TOKEN_KEY + session.getToken(), expected, value);
        return expected != null && write(session, "cas", expected, value, 0) == 1;
    }

    public long renew(LoginUser session, long ttl, long threshold)
    {
        if (ttl <= 0) throw new IllegalArgumentException("A positive session TTL is required");
        if (!enabled) return cache.renewExpiringCacheObject(CacheConstants.LOGIN_TOKEN_KEY + session.getToken(), ttl, threshold);
        return write(session, "renew", bytes(""), bytes(ttl), threshold);
    }

    private long write(LoginUser session, String operation, byte[] value, byte[] replacement, long threshold)
    {
        if (session.getUserId() == null || session.getToken() == null || session.getToken().isBlank())
            throw new IllegalArgumentException("A session identity is required");
        Long result = (Long) eval(WRITE, ReturnType.INTEGER,
                List.of(CacheConstants.LOGIN_TOKEN_KEY + session.getToken(), key(session.getUserId())),
                List.of(bytes(operation), value, replacement, bytes(threshold), bytes(revision()),
                        bytes("t:" + session.getToken()), bytes(enabled ? "0" : "1")));
        return result == null ? -2 : result;
    }

    /** Returned login keys still require ordinary session/SQL/CAS verification by the caller. */
    public Collection<String> sessionKeys(Set<Long> userIds)
    {
        if (userIds.isEmpty()) return List.of();
        if (!enabled) return cache.scanKeys(CacheConstants.LOGIN_TOKEN_KEY + "*");
        Map<Long, View> views = new LinkedHashMap<>();
        Set<String> keys = new LinkedHashSet<>();
        for (Long userId : userIds)
        {
            View view = read(userId);
            views.put(userId, view);
            for (String token : view.tokens()) keys.add(CacheConstants.LOGIN_TOKEN_KEY + token);
        }
        if (views.values().stream().allMatch(View::complete)) return keys;

        // A single complete fallback covers every incomplete user. Do not repair from partial SCAN.
        Map<Long, List<Member>> recovered = new LinkedHashMap<>();
        views.forEach((id, view) -> { if (!view.complete()) recovered.put(id, new ArrayList<>()); });
        Collection<String> scanned = cache.scanKeys(CacheConstants.LOGIN_TOKEN_KEY + "*");
        if (scanned == null) throw new IllegalStateException("Session enumeration did not complete");
        for (String loginKey : scanned)
        {
            if (!loginKey.startsWith(CacheConstants.LOGIN_TOKEN_KEY)) continue;
            RedisCache.CacheSnapshot<LoginUser> snapshot = cache.getExpiringCacheSnapshot(loginKey);
            if (snapshot == null || snapshot.value() == null) continue;
            LoginUser value = snapshot.value();
            List<Member> members = recovered.get(value.getUserId());
            if (members == null || !loginKey.equals(CacheConstants.LOGIN_TOKEN_KEY + value.getToken())) continue;
            keys.add(loginKey);
            // Keep the complete caller key set, but bound reconstruction payload/memory per user.
            if (members.size() <= MAX_REBUILD_MEMBERS) members.add(new Member(value.getToken(), snapshot.ttlMillis()));
        }
        for (var entry : recovered.entrySet())
        {
            if (entry.getValue().size() <= MAX_REBUILD_MEMBERS)
                rebuild(entry.getKey(), views.get(entry.getKey()).revision(), entry.getValue());
        }
        return keys;
    }

    private View read(Long userId)
    {
        List<Object> result = (List<Object>) eval(READ, ReturnType.MULTI, List.of(key(userId)), List.of(bytes(MAX_REBUILD_MEMBERS)));
        if (result == null || result.size() < 2) throw new IllegalStateException("Invalid session index response");
        List<String> tokens = new ArrayList<>();
        for (int i = 2; i < result.size(); i++) tokens.add(text(result.get(i)));
        return new View("1".equals(text(result.get(0))), text(result.get(1)), List.copyOf(tokens));
    }

    private void rebuild(Long userId, String expected, List<Member> members)
    {
        List<byte[]> arguments = new ArrayList<>();
        arguments.add(bytes(expected)); arguments.add(bytes(revision()));
        for (Member member : members) { arguments.add(bytes("t:" + member.token())); arguments.add(bytes(member.ttl())); }
        // A revision mismatch leaves the index incomplete; the complete fallback still serves this call.
        eval(REBUILD, ReturnType.INTEGER, List.of(key(userId)), arguments);
    }

    private Object eval(byte[] script, ReturnType type, List<String> keys, List<byte[]> arguments)
    {
        byte[][] parameters = new byte[keys.size() + arguments.size()][];
        RedisSerializer serializer = cache.redisTemplate.getKeySerializer();
        for (int i = 0; i < keys.size(); i++) parameters[i] = serializer.serialize(keys.get(i));
        for (int i = 0; i < arguments.size(); i++) parameters[keys.size() + i] = arguments.get(i);
        return cache.redisTemplate.execute((RedisCallback<Object>) connection -> connection.scriptingCommands()
                .eval(script, type, keys.size(), parameters));
    }

    private static String key(Long userId) { return PREFIX + userId; }
    private static String revision() { return "m:" + UUID.randomUUID().toString().replace("-", ""); }
    private static byte[] bytes(Object value) { return value.toString().getBytes(StandardCharsets.UTF_8); }
    private static String text(Object value) { return new String((byte[]) value, StandardCharsets.UTF_8); }
    private static byte[] script(String name)
    {
        try { return new ClassPathResource("session-index/" + name).getContentAsByteArray(); }
        catch (IOException failure) { throw new ExceptionInInitializerError(failure); }
    }
    private record View(boolean complete, String revision, List<String> tokens) { }
    private record Member(String token, long ttl) { }
}
