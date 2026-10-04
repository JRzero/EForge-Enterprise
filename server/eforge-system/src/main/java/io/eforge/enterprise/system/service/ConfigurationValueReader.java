package io.eforge.enterprise.system.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.system.domain.SysConfig;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.SysConfigMapper;

/** Compatibility policy consumers share the canonical mutation boundary. */
@Component
public class ConfigurationValueReader
{
    private final SysConfigMapper configs;
    private final DepartmentMutationMapper mutex;
    private final RedisCache cache;
    private final TransactionTemplate transaction;
    public ConfigurationValueReader(SysConfigMapper configs, DepartmentMutationMapper mutex,
            RedisCache cache, PlatformTransactionManager transactions)
    {this.configs=configs;this.mutex=mutex;this.cache=cache;transaction=new TransactionTemplate(transactions);}
    public String get(String key)
    {
        return transaction.execute(status -> {
            if(mutex.lockRoot()==null) throw new ApiFailure(409,"DEPARTMENT_ROOT_MISSING","Configuration mutation root is missing.");
            var filter=new SysConfig();filter.setConfigKey(key);var row=configs.selectConfig(filter);
            // Always use current DB rows; legacy caches may contain aliases or stale values.
            var value=row==null || row.getConfigValue()==null ? "" : row.getConfigValue();
            try{cache.setCacheObject(CacheConstants.SYS_CONFIG_KEY+key,value);}
            catch(RuntimeException failure){throw new ApiFailure(503,"CONFIGURATION_CACHE_UNAVAILABLE","Configuration cache is unavailable.");}
            return value;
        });
    }
}
