package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Supplier;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.domain.SysConfig;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.ConfigurationValueReader;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.ConfigurationContracts.*;

@Service
public class ConfigurationService
{
    private final SysConfigMapper configs;
    private final ConfigurationMutationMapper writes;
    private final DepartmentMutationMapper mutex;
    private final RedisCache cache;
    private final ConfigurationValueReader values;
    private final TransactionTemplate transaction;
    public ConfigurationService(SysConfigMapper configs,ConfigurationMutationMapper writes,DepartmentMutationMapper mutex,
            RedisCache cache,ConfigurationValueReader values,PlatformTransactionManager transactions)
    {this.configs=configs;this.writes=writes;this.mutex=mutex;this.cache=cache;this.values=values;transaction=new TransactionTemplate(transactions);}
    public PageResponse<ConfigurationResponse> list(int page,int size,String name,String key,Boolean builtin,LocalDate from,LocalDate to)
    {var filter=filter(name,key,builtin,from,to);try{PageHelper.startPage(page,size,"config_id asc");var rows=configs.selectConfigList(filter);return new PageResponse<>(rows.stream().map(ConfigurationResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);}finally{PageHelper.clearPage();}}
    public List<SysConfig> export(String name,String key,Boolean builtin,LocalDate from,LocalDate to) {return configs.selectConfigList(filter(name,key,builtin,from,to));}
    public ConfigurationResponse get(String id){return ConfigurationResponse.from(require(identifier(id)));}
    public ConfigurationResponse create(ConfigurationRequest request)
    {return locked(()->{var row=row(request);unique(row);row.setCreateBy(SecurityUtils.getUsername());writes.insert(row);clearCache();put(row);return ConfigurationResponse.from(require(row.getConfigId()));});}
    public void update(String id,ConfigurationRequest request)
    {locked(()->{var old=require(identifier(id));var row=row(request);row.setConfigId(old.getConfigId());unique(row);row.setUpdateBy(SecurityUtils.getUsername());configs.updateConfig(row);clearCache();put(row);return null;});}
    public void delete(List<String> ids)
    {locked(()->{var rows=ids.stream().distinct().map(ConfigurationService::identifier).map(this::require).toList();for(var row:rows)if("Y".equals(row.getConfigType()))throw conflict("CONFIGURATION_BUILTIN");for(var row:rows)configs.deleteConfigById(row.getConfigId());clearCache();return null;});}
    public ConfigurationValueResponse lookup(String key)
    {return new ConfigurationValueResponse(values.get(key));}
    public void refresh()
    {locked(()->{clearCache();for(var row:configs.selectConfigList(new SysConfig()))put(row);return null;});}
    private void clearCache(){redis(()->{var keys=cache.keys(CacheConstants.SYS_CONFIG_KEY+"*");if(keys!=null && !keys.isEmpty())cache.deleteObject(keys);});}
    private void put(SysConfig row){redis(()->cache.setCacheObject(CacheConstants.SYS_CONFIG_KEY+row.getConfigKey(),row.getConfigValue()));}
    private static void redis(Runnable work){try{work.run();}catch(RuntimeException failure){throw unavailable();}}
    private static ApiFailure unavailable(){return new ApiFailure(503,"CONFIGURATION_CACHE_UNAVAILABLE","Configuration cache is unavailable.");}
    private <T>T locked(Supplier<T> work)
    {try{return transaction.execute(status->{if(mutex.lockRoot()==null)throw conflict("DEPARTMENT_ROOT_MISSING");return work.get();});}catch(DuplicateKeyException failure){throw conflict("CONFIGURATION_KEY_EXISTS");}}
    private void unique(SysConfig row){var duplicate=configs.checkConfigKeyUnique(row.getConfigKey());if(duplicate!=null && !Objects.equals(duplicate.getConfigId(),row.getConfigId()))throw conflict("CONFIGURATION_KEY_EXISTS");}
    private SysConfig require(Long id){var row=configs.selectConfigById(id);if(row==null)throw new ApiFailure(404,"CONFIGURATION_NOT_FOUND","Configuration does not exist.");return row;}
    private static Long identifier(String id){try{long value=Long.parseLong(id);if(value<1)throw invalid();return value;}catch(NumberFormatException|NullPointerException failure){throw invalid();}}
    private static ApiFailure invalid(){return new ApiFailure(400,"VALIDATION_ERROR","Invalid configuration request.");}
    private static ApiFailure conflict(String code){return new ApiFailure(409,code,"Configuration conflicts with existing data.");}
    private static SysConfig row(ConfigurationRequest request){var row=new SysConfig();row.setConfigName(request.name());row.setConfigKey(request.key());row.setConfigValue(request.value());row.setConfigType(request.builtin()?"Y":"N");row.setRemark(request.remark()==null?"":request.remark());return row;}
    private static SysConfig filter(String name,String key,Boolean builtin,LocalDate from,LocalDate to){if(from!=null && to!=null && from.isAfter(to))throw invalid();var row=new SysConfig();row.setConfigName(name);row.setConfigKey(key);if(builtin!=null)row.setConfigType(builtin?"Y":"N");if(from!=null)row.getParams().put("beginTime",from.toString());if(to!=null)row.getParams().put("endTime",to.toString());return row;}
}
