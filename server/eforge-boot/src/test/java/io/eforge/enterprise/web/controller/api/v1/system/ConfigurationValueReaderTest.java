package io.eforge.enterprise.web.controller.api.v1.system;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.system.domain.SysConfig;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.ConfigurationValueReader;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ConfigurationValueReaderTest
{
    @Test void compatibilityPolicyReadsUseCommittedRowsBeforePublishingCache()
    {
        var configs=mock(SysConfigMapper.class);var mutex=mock(DepartmentMutationMapper.class);var cache=mock(RedisCache.class);var transactions=mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);
        var row=new SysConfig();row.setConfigValue("false");when(configs.selectConfig(any())).thenReturn(row);
        assertEquals("false",new ConfigurationValueReader(configs,mutex,cache,transactions).get("sys.account.captchaEnabled"));
        var order=inOrder(mutex,configs,cache,transactions);order.verify(mutex).lockRoot();order.verify(configs).selectConfig(argThat(filter->filter.getConfigKey().equals("sys.account.captchaEnabled")));order.verify(cache).setCacheObject("sys_config:sys.account.captchaEnabled","false");order.verify(transactions).commit(any());verify(cache,never()).getCacheObject(anyString());
    }
    @Test void missingConfigurationPreservesOriginalEmptyString()
    {
        var configs=mock(SysConfigMapper.class);var mutex=mock(DepartmentMutationMapper.class);var cache=mock(RedisCache.class);var transactions=mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);
        assertEquals("",new ConfigurationValueReader(configs,mutex,cache,transactions).get("missing"));verify(cache).setCacheObject("sys_config:missing","");
    }
    @Test void cacheFailureIsExplicitAndRollsBackReaderTransaction()
    {
        var configs=mock(SysConfigMapper.class);var mutex=mock(DepartmentMutationMapper.class);var cache=mock(RedisCache.class);var transactions=mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(mutex.lockRoot()).thenReturn(100L);doThrow(new IllegalStateException("failure")).when(cache).setCacheObject(anyString(),any());
        assertThrows(ApiFailure.class,()->new ConfigurationValueReader(configs,mutex,cache,transactions).get("missing"));verify(transactions).rollback(any());verify(transactions,never()).commit(any());
    }
}
