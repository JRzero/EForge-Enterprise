package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.exception.ApiFailure;
import static io.eforge.enterprise.web.controller.api.v1.monitor.CacheMonitorContracts.*;

/** Local projection over the existing Redis connection; never deserialize cached Java classes for diagnostics. */
@Service
public class CacheMonitorService
{
    private static final List<CacheName> NAMES=List.of(new CacheName(CacheConstants.LOGIN_TOKEN_KEY,"用户信息"),
            new CacheName(CacheConstants.SYS_CONFIG_KEY,"配置信息"),new CacheName(CacheConstants.SYS_DICT_KEY,"数据字典"),
            new CacheName(CacheConstants.CAPTCHA_CODE_KEY,"验证码"),new CacheName(CacheConstants.REPEAT_SUBMIT_KEY,"防重提交"),
            new CacheName(CacheConstants.RATE_LIMIT_KEY,"限流处理"),new CacheName(CacheConstants.PWD_ERR_CNT_KEY,"密码错误次数"));
    private static final Pattern CALLS=Pattern.compile("(?:^|,)calls=(\\d+)(?:,|$)");
    private final RedisTemplate<Object,Object> redis;
    private final ObjectMapper json;
    public CacheMonitorService(RedisTemplate<Object,Object> redis,ObjectMapper json){this.redis=redis;this.json=json;}
    public List<CacheName> names(){return NAMES;}
    public CacheStatistics statistics(){return guarded(()->redis.execute((RedisCallback<CacheStatistics>) connection->{
        Properties info=connection.serverCommands().info(),stats=connection.serverCommands().info("commandstats");
        Long count=connection.serverCommands().dbSize();
        if(info==null || stats==null || count==null) throw unavailable();
        List<CommandStatistic> commands=new ArrayList<>();
        for(String key:new TreeSet<>(stats.stringPropertyNames())) {
            if(!key.startsWith("cmdstat_")) continue;
            var matcher=CALLS.matcher(stats.getProperty(key));if(!matcher.find()) throw unavailable();
            commands.add(new CommandStatistic(key.substring(8),matcher.group(1)));
        }
        var details=new RedisInformation(info.getProperty("redis_version"),info.getProperty("redis_mode"),info.getProperty("tcp_port"),
                info.getProperty("connected_clients"),info.getProperty("uptime_in_days"),info.getProperty("used_memory_human"),
                info.getProperty("used_memory"),info.getProperty("used_cpu_user_children"),info.getProperty("maxmemory_human"),
                info.getProperty("aof_enabled"),info.getProperty("rdb_last_bgsave_status"),info.getProperty("instantaneous_input_kbps"),info.getProperty("instantaneous_output_kbps"));
        return new CacheStatistics(details,count.toString(),commands);
    }));}
    public List<String> keys(String name){checkName(name);return guarded(()->snapshotKeys(name+"*"));}
    public CacheValue value(String name,String key){checkKey(name,key);return guarded(()->{
        byte[] bytes=redis.execute((RedisCallback<byte[]>) connection->connection.stringCommands().get(key.getBytes(StandardCharsets.UTF_8)));
        if(bytes==null) throw new ApiFailure(404,"CACHE_KEY_NOT_FOUND","The cache key no longer exists.");
        String text=new String(bytes,StandardCharsets.UTF_8);
        try {
            // No AutoType feature or filter: parse the upstream Long/Set notation as data, never cached Java classes.
            JsonNode node=json.valueToTree(com.alibaba.fastjson2.JSON.parse(text));
            if(node!=null) {
                if(CacheConstants.LOGIN_TOKEN_KEY.equals(name)) redactSessionCredentials(node);
                text=node.isTextual()?node.textValue():json.writerWithDefaultPrettyPrinter().writeValueAsString(node);
            }
        } catch(com.alibaba.fastjson2.JSONException | java.io.IOException invalid) {
            if(CacheConstants.LOGIN_TOKEN_KEY.equals(name)) throw unavailable();
            // Non-session plain Redis strings remain readable verbatim.
        }
        return new CacheValue(name,key,text);
    });}
    public void clearName(String name){checkName(name);guarded(()->{deleteSnapshot(name+"*");return null;});}
    public void clearKey(String name,String key){checkKey(name,key);guarded(()->{redis.delete(key);return null;});}
    public void clearAll(){guarded(()->{deleteSnapshot("*");return null;});}
    private List<String> snapshotKeys(String pattern){
        Set<Object> keys=redis.keys(pattern);if(keys==null) throw unavailable();
        return keys.stream().map(Object::toString).sorted().toList();
    }
    private void deleteSnapshot(String pattern){List<String> keys=snapshotKeys(pattern);if(!keys.isEmpty()) redis.delete(new ArrayList<Object>(keys));}
    private void checkName(String name){if(NAMES.stream().noneMatch(entry->entry.name().equals(name))) throw new ApiFailure(400,"INVALID_CACHE_NAME","Choose a supported cache namespace.");}
    private void checkKey(String name,String key){checkName(name);if(key==null || key.length()>4096 || !key.startsWith(name)) throw new ApiFailure(400,"INVALID_CACHE_KEY","The cache key must belong to the selected namespace.");}
    private void redactSessionCredentials(JsonNode node){
        if(node instanceof ObjectNode object) {
            object.remove(List.of("password","accessToken","refreshToken","credentials"));
            object.elements().forEachRemaining(this::redactSessionCredentials);
        } else if(node.isArray()) node.elements().forEachRemaining(this::redactSessionCredentials);
    }
    private <T> T guarded(Supplier<T> work){try{return work.get();}catch(DataAccessException failure){throw unavailable();}}
    private ApiFailure unavailable(){return new ApiFailure(503,"CACHE_UNAVAILABLE","Cache diagnostics are temporarily unavailable.");}
}
