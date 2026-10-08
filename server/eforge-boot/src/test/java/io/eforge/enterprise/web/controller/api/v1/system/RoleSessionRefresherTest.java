package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
    @Mock ISysUserService users;
    @Mock NavigationMapper navigation;
    @Mock SysPermissionService permissions;
    @Mock TokenService tokens;
    @Mock DepartmentMutationMapper mutations;
    @Mock PlatformTransactionManager manager;
    RoleSessionRefresher refresher;
    LoginUser session;
    SysUser fresh;

    @BeforeEach void prepare()
    {
        refresher = new RoleSessionRefresher(cache, users, navigation, permissions, tokens, mutations, manager);
        fresh = new SysUser(7L); fresh.setStatus("0"); fresh.setDelFlag("0"); fresh.setDeptId(105L);
        session = new LoginUser(7L, 103L, new SysUser(7L), Set.of("old:permission"));
        session.setToken("existing"); session.setExpireTime(12345L);
    }
    void existing()
    {
        when(manager.getTransaction(any())).thenAnswer(call -> {
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, call.<TransactionDefinition>getArgument(0).getPropagationBehavior());
            return new SimpleTransactionStatus();
        });
        when(mutations.lockRoot()).thenReturn(100L);
        when(cache.keys("login_tokens:*")).thenReturn(List.of("login_tokens:existing"));
        when(tokens.getLoginUserByToken("existing")).thenReturn(session);
    }
    @Test void freshAuthorizationUsesConditionalWriteAfterTakingSharedLock()
    {
        existing(); when(users.selectUserById(7L)).thenReturn(fresh);
        SysRole role = new SysRole(2L); role.setDataScope("5");
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of(role));
        when(permissions.getMenuPermission(fresh)).thenReturn(Set.of("new:permission"));
        when(tokens.updateLoginUser(session)).thenReturn(true);
        refresher.refresh(Set.of(7L));
        assertSame(fresh, session.getUser()); assertEquals(105L, session.getDeptId());
        assertEquals("5", session.getUser().getRoles().get(0).getDataScope());
        assertEquals(Set.of("new:permission"), session.getPermissions());
        assertEquals(12345L, session.getExpireTime());
        var order = inOrder(mutations, tokens, users, manager);
        order.verify(mutations).lockRoot(); order.verify(tokens).getLoginUserByToken("existing");
        order.verify(users).selectUserById(7L); order.verify(tokens).updateLoginUser(session);
        order.verify(manager).commit(any());
    }
    @Test void roleRemovalCannotRecreateAConcurrentlyLoggedOutSession()
    {
        existing(); when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(false);
        when(tokens.getLoginUserByToken("existing")).thenReturn(session, null);
        refresher.refresh(Set.of(7L));
        assertTrue(session.getPermissions().isEmpty());
        verify(tokens).updateLoginUser(session); verify(tokens, never()).delLoginUser(anyString());
        verifyNoInteractions(permissions);
    }
    @Test void expiredSessionIsNeverWritten()
    {
        existing(); when(tokens.getLoginUserByToken("existing")).thenReturn(null);
        refresher.refresh(Set.of(7L));
        verify(tokens, never()).updateLoginUser(any()); verifyNoInteractions(users, navigation, permissions);
    }
    @Test void conflictRereadsBeforeRetryingAndSustainedContentionRevokes()
    {
        existing(); when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(false);
        refresher.refresh(Set.of(7L));
        verify(tokens, times(4)).getLoginUserByToken("existing");
        verify(users, times(4)).selectUserById(7L);
        verify(tokens, times(4)).updateLoginUser(session);
        verify(tokens).delLoginUser("existing");
    }
    @Test void disabledAccountIsRevoked()
    {
        existing(); fresh.setStatus("1"); when(users.selectUserById(7L)).thenReturn(fresh);
        refresher.refresh(Set.of(7L)); verify(tokens).delLoginUser("existing");
        verify(tokens, never()).updateLoginUser(any()); verifyNoInteractions(navigation, permissions);
    }
    @Test void unrelatedSessionsAreUntouched()
    {
        existing(); refresher.refresh(Set.of(8L));
        verifyNoInteractions(users, navigation, permissions); verify(tokens, never()).updateLoginUser(any());
    }
    @Test void emptyAffectedSetDoesNotOpenTransactionOrScanRedis()
    {
        refresher.refresh(Set.of()); verifyNoInteractions(manager, mutations, cache, users, tokens);
    }
    @Test void missingRootRollsBackBeforeReadingSessions()
    {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(null);
        assertThrows(io.eforge.enterprise.common.exception.ApiFailure.class, () -> refresher.refresh(Set.of(7L)));
        verify(manager).rollback(any()); verifyNoInteractions(cache, users, tokens);
    }
}
