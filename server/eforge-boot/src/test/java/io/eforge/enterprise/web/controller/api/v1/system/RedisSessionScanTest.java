package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import io.eforge.enterprise.common.core.redis.RedisCache;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RedisSessionScanTest
{
    @SuppressWarnings("unchecked")
    @Test
    void consumesTheWholeCursorDeduplicatesAndClosesWithoutKeys()
    {
        RedisTemplate<String, Object> template = mock(RedisTemplate.class);
        Cursor<String> cursor = mock(Cursor.class);
        when(template.scan(argThat(options -> options.getCount() == 256L
                && "login_tokens:*".equals(options.getPattern())))).thenReturn(cursor);
        when(cursor.hasNext()).thenReturn(true, true, true, false);
        when(cursor.next()).thenReturn("login_tokens:a", "login_tokens:a", "login_tokens:b");
        RedisCache cache = new RedisCache(); cache.redisTemplate = template;
        assertEquals(List.of("login_tokens:a", "login_tokens:b"), List.copyOf(cache.scanKeys("login_tokens:*")));
        verify(cursor).close(); verify(template, never()).keys(anyString());
    }

    @SuppressWarnings("unchecked")
    @Test
    void midCursorFailureClosesAndNeverReturnsPartialAuthority()
    {
        RedisTemplate<String, Object> template = mock(RedisTemplate.class);
        Cursor<String> cursor = mock(Cursor.class);
        when(template.scan(any(ScanOptions.class))).thenReturn(cursor);
        var failure = new IllegalStateException("owned scan fault");
        when(cursor.hasNext()).thenReturn(true).thenThrow(failure);
        when(cursor.next()).thenReturn("login_tokens:a");
        RedisCache cache = new RedisCache(); cache.redisTemplate = template;
        assertSame(failure, assertThrows(IllegalStateException.class, () -> cache.scanKeys("login_tokens:*")));
        verify(cursor).close(); verify(template, never()).keys(anyString());
    }
}
