package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.data.redis.connection.*;
import org.springframework.data.redis.core.*;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest
@ContextConfiguration(classes={CacheMonitorController.class,CacheMonitorService.class,PermissionService.class,
        ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,CacheMonitorControllerTest.Configuration.class})
class CacheMonitorControllerTest
{
    static final String BASE="/api/v1/monitor/cache";
    @Autowired MockMvc mvc;
    @MockitoBean RedisTemplate<Object,Object> redis;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    RedisConnection connection;RedisServerCommands server;RedisStringCommands strings;
    @SuppressWarnings({"unchecked","rawtypes"})
    @BeforeEach void prepare(){
        actor(Set.of("monitor:cache:list"));connection=mock(RedisConnection.class);server=mock(RedisServerCommands.class);strings=mock(RedisStringCommands.class);
        when(connection.serverCommands()).thenReturn(server);when(connection.stringCommands()).thenReturn(strings);
        doAnswer(invocation->((RedisCallback)invocation.getArgument(0)).doInRedis(connection)).when(redis).execute(any(RedisCallback.class));
    }
    void actor(Set<String> grants){var user=new SysUser(2L);user.setUserName("reader");when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,grants));}
    @Test void everyReadAndClearRetainsTheOriginalGrantAndRejectsAnonymousCallers() throws Exception {
        var requests=List.of(get(BASE),get(BASE+"/names"),get(BASE+"/keys").param("name","sys_config:"),get(BASE+"/value").param("name","sys_config:").param("key","sys_config:a"),
                delete(BASE+"/names/sys_config:"),delete(BASE+"/keys").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"sys_config:\",\"key\":\"sys_config:a\"}"),delete(BASE));
        actor(Set.of());for(var request:requests) mvc.perform(request).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(tokens.getLoginUser(any())).thenReturn(null);for(var request:requests) mvc.perform(request).andExpect(status().isUnauthorized());
        verifyNoInteractions(redis,server,strings);
    }
    @Test void sevenNamespacesRemainOrderedAndConcreteWithoutRedisOrLegacyWrappers() throws Exception {
        mvc.perform(get(BASE+"/names")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(7))
                .andExpect(jsonPath("$[0].name").value("login_tokens:")).andExpect(jsonPath("$[6].name").value("pwd_err_cnt:"));verifyNoInteractions(redis);
    }
    @Test void statsProjectAllOriginalFieldsAndExactCountsWithoutRedisInternalProperties() throws Exception {
        var info=new Properties();info.setProperty("redis_version","7.4");info.setProperty("redis_mode","standalone");info.setProperty("tcp_port","6379");
        info.setProperty("used_memory","9007199254740993");info.setProperty("used_memory_human","1.2M");info.setProperty("executable","private-path");
        info.setProperty("connected_clients","5");info.setProperty("uptime_in_days","3");info.setProperty("used_cpu_user_children","0.12");info.setProperty("maxmemory_human","0B");
        info.setProperty("aof_enabled","1");info.setProperty("rdb_last_bgsave_status","ok");info.setProperty("instantaneous_input_kbps","1.23");info.setProperty("instantaneous_output_kbps","4.56");
        var stats=new Properties();stats.setProperty("cmdstat_set","calls=2,usec=7,usec_per_call=3.5");stats.setProperty("cmdstat_get","calls=9007199254740993,usec=9");
        when(server.info()).thenReturn(info);when(server.info("commandstats")).thenReturn(stats);when(server.dbSize()).thenReturn(9007199254740993L);
        var response=mvc.perform(get(BASE)).andExpect(status().isOk()).andExpect(jsonPath("$.info.version").value("7.4"))
                .andExpect(jsonPath("$.info.usedMemoryBytes").value("9007199254740993")).andExpect(jsonPath("$.keyCount").value("9007199254740993"))
                .andExpect(jsonPath("$.info.mode").value("standalone")).andExpect(jsonPath("$.info.port").value("6379")).andExpect(jsonPath("$.info.connectedClients").value("5"))
                .andExpect(jsonPath("$.info.uptimeDays").value("3")).andExpect(jsonPath("$.info.usedMemory").value("1.2M")).andExpect(jsonPath("$.info.userChildrenCpuSeconds").value("0.12"))
                .andExpect(jsonPath("$.info.maxMemory").value("0B")).andExpect(jsonPath("$.info.aofEnabled").value("1")).andExpect(jsonPath("$.info.rdbLastSaveStatus").value("ok"))
                .andExpect(jsonPath("$.info.inputKbps").value("1.23")).andExpect(jsonPath("$.info.outputKbps").value("4.56"))
                .andExpect(jsonPath("$.commands[0].name").value("get")).andExpect(jsonPath("$.commands[0].calls").value("9007199254740993"))
                .andExpect(jsonPath("$.code").doesNotExist()).andReturn().getResponse().getContentAsString();assertFalse(response.contains("private-path"));
    }
    @Test void keysAreLiteralNamespaceSortedAndValuesPreserveUnicodeSlashesAndJsonWithoutClassConstruction() throws Exception {
        String key="sys_config:中文/a & b";
        when(redis.keys("sys_config:*")).thenReturn(Set.of("sys_config:z",key));
        mvc.perform(get(BASE+"/keys").param("name","sys_config:")).andExpect(status().isOk()).andExpect(jsonPath("$[0]").value("sys_config:z"));
        when(strings.get(key.getBytes(StandardCharsets.UTF_8))).thenReturn("\"中文/配置\"".getBytes(StandardCharsets.UTF_8));
        mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key",key)).andExpect(status().isOk()).andExpect(jsonPath("$.key").value(key)).andExpect(jsonPath("$.value").value("中文/配置"));
        when(strings.get(key.getBytes(StandardCharsets.UTF_8))).thenReturn("{\"@type\":\"java.lang.ProcessBuilder\",\"value\":\"<script>文本</script>\"}".getBytes(StandardCharsets.UTF_8));
        mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key",key)).andExpect(status().isOk()).andExpect(jsonPath("$.value").value(org.hamcrest.Matchers.containsString("java.lang.ProcessBuilder")));
    }
    @Test void cachedSessionValuesRedactNestedCredentialsWithoutChangingStoredBytes() throws Exception {
        String key="login_tokens:opaque-id";
        byte[] stored="{\"@type\":\"io.eforge.enterprise.common.core.domain.model.LoginUser\",\"deptId\":9007199254740993L,\"user\":{\"userName\":\"reader\",\"password\":\"private-hash\"},\"permissions\":Set[\"read\"],\"accessToken\":\"private-jwt\",\"nested\":[{\"refreshToken\":\"private-refresh\"}]}".getBytes(StandardCharsets.UTF_8);
        when(strings.get(key.getBytes(StandardCharsets.UTF_8))).thenReturn(stored);
        String response=mvc.perform(get(BASE+"/value").param("name","login_tokens:").param("key",key)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(response.contains("reader"));assertTrue(response.contains("9007199254740993"));assertFalse(response.contains("9007199254740993L"));assertFalse(response.contains("private-"));verify(redis,never()).delete(anyString());assertTrue(new String(stored,StandardCharsets.UTF_8).contains("private-hash"));
    }
    @Test void malformedSessionDataFailsClosedInsteadOfReturningRawCredentials() throws Exception {
        when(strings.get(any(byte[].class))).thenReturn("password=private-secret".getBytes(StandardCharsets.UTF_8));
        String response=mvc.perform(get(BASE+"/value").param("name","login_tokens:").param("key","login_tokens:invalid")).andExpect(status().isServiceUnavailable()).andReturn().getResponse().getContentAsString();assertFalse(response.contains("private-secret"));
    }
    @Test void cacheTypeMetadataCannotConstructApplicationClasses() throws Exception {
        UnexpectedCacheType.constructed=0;
        when(strings.get(any(byte[].class))).thenReturn(("{\"@type\":\""+UnexpectedCacheType.class.getName()+"\",\"value\":\"metadata\"}").getBytes(StandardCharsets.UTF_8));
        mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key","sys_config:type")).andExpect(status().isOk());assertEquals(0,UnexpectedCacheType.constructed);
    }
    public static class UnexpectedCacheType {static int constructed;public UnexpectedCacheType(){constructed++;}public String value;}
    @Test void malformedNamespaceCrossNamespaceKeysAndInvalidBodiesNeverTouchRedis() throws Exception {
        mvc.perform(get(BASE+"/keys").param("name","*")).andExpect(status().isBadRequest());
        mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key","login_tokens:other")).andExpect(status().isBadRequest());
        mvc.perform(delete(BASE+"/keys").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"sys_config:\",\"key\":\"login_tokens:other\"}")).andExpect(status().isBadRequest());
        mvc.perform(delete(BASE+"/keys").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());verifyNoInteractions(redis);
    }
    @Test void expiredKeyIsNotFoundAndAlreadyAbsentDeleteRemainsSuccessful() throws Exception {
        mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key","sys_config:expired")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CACHE_KEY_NOT_FOUND"));
        when(redis.delete("sys_config:expired")).thenReturn(false);
        mvc.perform(delete(BASE+"/keys").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"sys_config:\",\"key\":\"sys_config:expired\"}")).andExpect(status().isNoContent());
    }
    @Test void namespaceClearUsesOneScopedDeleteAndAllClearIncludesSessionsAndOtherKeys() throws Exception {
        when(redis.keys("sys_config:*")).thenReturn(Set.of("sys_config:a","sys_config:b"));
        mvc.perform(delete(BASE+"/names/sys_config:")).andExpect(status().isNoContent());verify(redis).delete(List.<Object>of("sys_config:a","sys_config:b"));
        when(redis.keys("*")).thenReturn(Set.of("login_tokens:caller","custom:key"));
        mvc.perform(delete(BASE)).andExpect(status().isNoContent());verify(redis).delete(List.<Object>of("custom:key","login_tokens:caller"));
    }
    @Test void failedEnumerationDoesNotDeleteAndReadDeleteFaultsReturnGenericProblems() throws Exception {
        when(redis.keys("sys_config:*")).thenThrow(new DataAccessResourceFailureException("private-key/password"));
        mvc.perform(delete(BASE+"/names/sys_config:")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("CACHE_UNAVAILABLE"));verify(redis,never()).delete(anyCollection());
        when(strings.get(any(byte[].class))).thenThrow(new DataAccessResourceFailureException("private-value"));
        String response=mvc.perform(get(BASE+"/value").param("name","sys_config:").param("key","sys_config:a")).andExpect(status().isServiceUnavailable()).andReturn().getResponse().getContentAsString();assertFalse(response.contains("private-value"));
        when(redis.delete("sys_config:a")).thenThrow(new DataAccessResourceFailureException("private-key"));
        mvc.perform(delete(BASE+"/keys").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"sys_config:\",\"key\":\"sys_config:a\"}")).andExpect(status().isServiceUnavailable());
    }
    @Test void missingOrMalformedRedisStatsReturnUnavailableRatherThanPartialSuccess() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isServiceUnavailable());
        var stats=new Properties();stats.setProperty("cmdstat_get","not-a-call-count");when(server.info()).thenReturn(new Properties());when(server.info("commandstats")).thenReturn(stats);when(server.dbSize()).thenReturn(0L);
        mvc.perform(get(BASE)).andExpect(status().isServiceUnavailable());
    }
    @TestConfiguration static class Configuration
    {@Bean PermitAllUrlProperties permitAllUrlProperties(){return new PermitAllUrlProperties();}@Bean CorsFilter corsFilter(){return new CorsFilter(new UrlBasedCorsConfigurationSource());}}
}
