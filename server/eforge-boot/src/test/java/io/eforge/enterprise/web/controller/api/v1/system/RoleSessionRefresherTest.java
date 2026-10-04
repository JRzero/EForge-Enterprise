package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleSessionRefresherTest
{
    @Mock RedisCache cache;
    @Mock RedisTemplate<Object,Object> redis;
    @Mock ValueOperations<Object,Object> values;
    @Mock ISysUserService users;
    @Mock NavigationMapper navigation;
    @Mock SysPermissionService permissions;
    @Mock TokenService tokens;
    @Mock DepartmentMutationMapper mutations;
    @Mock PlatformTransactionManager manager;
    RoleSessionRefresher refresher;
    String key="login_tokens:existing";
    LoginUser session;
    SysUser fresh;
    @BeforeEach void prepare()
    {
        refresher=new RoleSessionRefresher(cache,redis,users,navigation,permissions,tokens,mutations,manager);
        fresh=new SysUser(7L);fresh.setStatus("0");fresh.setDelFlag("0");fresh.setDeptId(105L);
        session=new LoginUser(7L,103L,new SysUser(7L),Set.of("old:permission"));session.setToken("existing");session.setExpireTime(12345L);
    }
    void existing()
    {
        when(manager.getTransaction(any())).thenAnswer(call->{assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW,call.<TransactionDefinition>getArgument(0).getPropagationBehavior());return new SimpleTransactionStatus();});
        when(mutations.lockRoot()).thenReturn(100L);when(cache.keys("login_tokens:*")).thenReturn(List.of(key));when(cache.getCacheObject(key)).thenReturn(session);
    }
    @Test void refreshesFreshRoleScopeAndPermissionsAfterTakingLockPreservingExpiry()
    {
        existing();when(users.selectUserById(7L)).thenReturn(fresh);
        SysRole role=new SysRole(2L);role.setDataScope("5");when(navigation.selectActiveRoles(7L)).thenReturn(List.of(role));
        when(permissions.getMenuPermission(fresh)).thenReturn(Set.of("new:permission"));when(redis.getExpire(key,TimeUnit.SECONDS)).thenReturn(120L);when(redis.opsForValue()).thenReturn(values);
        refresher.refresh(Set.of(7L));
        assertSame(fresh,session.getUser());assertEquals(105L,session.getDeptId());assertEquals("5",session.getUser().getRoles().get(0).getDataScope());assertEquals(Set.of("new:permission"),session.getPermissions());assertEquals(12345L,session.getExpireTime());
        var order=inOrder(mutations,users,values,manager);order.verify(mutations).lockRoot();order.verify(users).selectUserById(7L);order.verify(values).setIfPresent(key,session,120L,TimeUnit.SECONDS);order.verify(manager).commit(any());
    }
    @Test void roleRemovalClearsPermissionsWithoutRecreatingLoggedOutSession()
    {
        existing();when(users.selectUserById(7L)).thenReturn(fresh);when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(redis.getExpire(key,TimeUnit.SECONDS)).thenReturn(120L);when(redis.opsForValue()).thenReturn(values);when(values.setIfPresent(key,session,120L,TimeUnit.SECONDS)).thenReturn(false);
        refresher.refresh(Set.of(7L));assertTrue(session.getPermissions().isEmpty());assertTrue(fresh.getRoles().isEmpty());verifyNoInteractions(permissions);verify(values).setIfPresent(key,session,120L,TimeUnit.SECONDS);verifyNoMoreInteractions(values);
    }
    @Test void expiredSessionIsNeverWritten()
    {
        existing();when(users.selectUserById(7L)).thenReturn(fresh);when(navigation.selectActiveRoles(7L)).thenReturn(List.of());when(redis.getExpire(key,TimeUnit.SECONDS)).thenReturn(-2L);
        refresher.refresh(Set.of(7L));verify(redis,never()).opsForValue();verifyNoInteractions(values,permissions);
    }
    @Test void disabledAccountIsRevoked()
    {
        existing();fresh.setStatus("1");when(users.selectUserById(7L)).thenReturn(fresh);
        refresher.refresh(Set.of(7L));verify(tokens).delLoginUser("existing");verifyNoInteractions(redis,navigation,permissions);
    }
    @Test void unrelatedSessionsAreUntouched()
    {
        existing();refresher.refresh(Set.of(8L));verifyNoInteractions(users,redis,navigation,permissions,tokens);
    }
    @Test void emptyAffectedSetDoesNotOpenTransactionOrScanRedis()
    {
        refresher.refresh(Set.of());verifyNoInteractions(manager,mutations,cache,redis,users);
    }
    @Test void missingRootRollsBackBeforeReadingOrWritingSessions()
    {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(null);
        assertThrows(io.eforge.enterprise.common.exception.ApiFailure.class,()->refresher.refresh(Set.of(7L)));
        verify(manager).rollback(any());verifyNoInteractions(cache,redis,users);
    }
}
