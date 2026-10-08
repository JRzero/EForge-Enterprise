package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
    String key = "login_tokens:existing";
    LoginUser session;
    SysUser fresh;

    @BeforeEach
    void prepare()
    {
        refresher = new RoleSessionRefresher(cache, users, navigation, permissions, tokens, mutations, manager);
        fresh = user("Current profile");
        session = new LoginUser(7L, 103L, new SysUser(7L), Set.of("old:permission"));
        session.setToken("existing");
        session.setExpireTime(12345L);
    }

    @AfterEach
    void clearSynchronization()
    {
        if (TransactionSynchronizationManager.isSynchronizationActive())
        {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    void existing()
    {
        when(manager.getTransaction(any())).thenAnswer(call -> {
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW,
                    call.<TransactionDefinition>getArgument(0).getPropagationBehavior());
            return new SimpleTransactionStatus();
        });
        when(mutations.lockRoot()).thenReturn(100L);
        when(cache.keys("login_tokens:*")).thenReturn(List.of(key));
        when(tokens.getLoginUserByToken("existing")).thenReturn(session);
    }

    @Test
    void refreshesFreshRoleScopeAndPermissionsAfterTakingLockPreservingExpiry()
    {
        existing();
        when(users.selectUserById(7L)).thenReturn(fresh);
        SysRole role = new SysRole(2L);
        role.setDataScope("5");
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of(role));
        when(permissions.getMenuPermission(fresh)).thenReturn(Set.of("new:permission"));
        when(tokens.updateLoginUser(session)).thenReturn(true);

        refresher.refresh(Set.of(7L));

        assertSame(fresh, session.getUser());
        assertEquals(105L, session.getDeptId());
        assertEquals("5", session.getUser().getRoles().get(0).getDataScope());
        assertEquals(Set.of("new:permission"), session.getPermissions());
        assertEquals(12345L, session.getExpireTime());
        var order = inOrder(mutations, tokens, users, manager);
        order.verify(mutations).lockRoot();
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(users).selectUserById(7L);
        order.verify(tokens).updateLoginUser(session);
        order.verify(manager).commit(any());
    }

    @Test
    void roleRemovalDoesNotRecreateASessionLoggedOutDuringTheUpdate()
    {
        existing();
        when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.getLoginUserByToken("existing")).thenReturn(session, null);
        when(tokens.updateLoginUser(session)).thenReturn(false);

        refresher.refresh(Set.of(7L));

        assertTrue(session.getPermissions().isEmpty());
        verifyNoInteractions(permissions);
        verify(tokens).updateLoginUser(session);
        verify(tokens, never()).setLoginUser(any());
        verify(tokens, never()).delLoginUser(any());
    }

    @Test
    void concurrentProfileWriteRequiresFreshSessionAndDatabaseAuthorityBeforeRetry()
    {
        existing();
        LoginUser profileWon = new LoginUser(7L, 103L, new SysUser(7L), Set.of("old:permission"));
        profileWon.setToken("existing");
        SysUser newest = user("Newer committed profile");
        when(tokens.getLoginUserByToken("existing")).thenReturn(session, profileWon);
        when(users.selectUserById(7L)).thenReturn(fresh, newest);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(false);
        when(tokens.updateLoginUser(profileWon)).thenReturn(true);

        refresher.refresh(Set.of(7L));

        assertTrue(profileWon.getPermissions().isEmpty(), "A profile conflict cannot drop the permission withdrawal");
        assertEquals("Newer committed profile", profileWon.getUser().getNickName());
        verify(users, times(2)).selectUserById(7L);
        verify(navigation, times(2)).selectActiveRoles(7L);
        var order = inOrder(tokens);
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(tokens).updateLoginUser(session);
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(tokens).updateLoginUser(profileWon);
        verify(tokens, never()).delLoginUser(any());
    }

    @Test
    void repeatedContentionRevokesInsteadOfLeavingWithdrawnPermissionsUsable()
    {
        existing();
        when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(false);

        refresher.refresh(Set.of(7L));

        verify(tokens, times(3)).getLoginUserByToken("existing");
        verify(tokens, times(3)).updateLoginUser(session);
        verify(tokens).delLoginUser("existing");
    }

    @Test
    void failedAuthorityReadRevokesTheIdentifiedSessionBeforePropagatingFailure()
    {
        existing();
        RuntimeException unavailable = new IllegalStateException("authority unavailable");
        when(users.selectUserById(7L)).thenThrow(unavailable);

        assertSame(unavailable, assertThrows(RuntimeException.class, () -> refresher.refresh(Set.of(7L))));
        verify(tokens).delLoginUser("existing");
        verify(tokens, never()).updateLoginUser(any());
        verify(manager).rollback(any());
    }

    @Test
    void aRevocationFailureDoesNotHideTheOriginalAuthorityFailure()
    {
        existing();
        RuntimeException unavailable = new IllegalStateException("authority unavailable");
        RuntimeException cacheUnavailable = new IllegalStateException("cache unavailable");
        when(users.selectUserById(7L)).thenThrow(unavailable);
        doThrow(cacheUnavailable).when(tokens).delLoginUser("existing");

        assertSame(unavailable, assertThrows(RuntimeException.class, () -> refresher.refresh(Set.of(7L))));
        assertArrayEquals(new Throwable[] {cacheUnavailable}, unavailable.getSuppressed());
        verify(manager).rollback(any());
    }

    @Test
    void expiredSessionIsNeverWritten()
    {
        existing();
        when(tokens.getLoginUserByToken("existing")).thenReturn(null);
        refresher.refresh(Set.of(7L));
        verifyNoInteractions(users, navigation, permissions);
        verify(tokens, never()).updateLoginUser(any());
    }

    @Test
    void disabledAccountIsRevoked()
    {
        existing();
        fresh.setStatus("1");
        when(users.selectUserById(7L)).thenReturn(fresh);
        refresher.refresh(Set.of(7L));
        verify(tokens).delLoginUser("existing");
        verify(tokens, never()).updateLoginUser(any());
        verifyNoInteractions(navigation, permissions);
    }

    @Test
    void unrelatedSessionsAreUntouched()
    {
        existing();
        refresher.refresh(Set.of(8L));
        verifyNoInteractions(users, navigation, permissions);
        verify(tokens, never()).updateLoginUser(any());
        verify(tokens, never()).delLoginUser(any());
    }

    @Test
    void emptyAffectedSetDoesNotOpenTransactionOrScanRedis()
    {
        refresher.refresh(Set.of());
        refresher.refreshAfterCommit(Set.of());
        verifyNoInteractions(manager, mutations, cache, users, tokens);
    }

    @Test
    void afterCommitCapturesAffectedUsersAndDoesNotPublishBeforeCommit()
    {
        existing();
        when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(true);
        TransactionSynchronizationManager.initSynchronization();
        Set<Long> affected = new HashSet<>(Set.of(7L));

        refresher.refreshAfterCommit(affected);
        affected.clear();
        verifyNoInteractions(cache, tokens, users, manager);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);

        verify(tokens).updateLoginUser(session);
    }

    @Test
    void rollbackDoesNotPublishSessionChanges()
    {
        TransactionSynchronizationManager.initSynchronization();
        refresher.refreshAfterCommit(Set.of(7L));
        TransactionSynchronizationManager.getSynchronizations().forEach(
                synchronization -> synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(manager, mutations, cache, users, tokens);
    }

    @Test
    void missingRootRollsBackBeforeReadingOrWritingSessions()
    {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(null);
        assertThrows(io.eforge.enterprise.common.exception.ApiFailure.class, () -> refresher.refresh(Set.of(7L)));
        verify(manager).rollback(any());
        verifyNoInteractions(cache, users, tokens);
    }

    private static SysUser user(String name)
    {
        SysUser user = new SysUser(7L);
        user.setStatus("0");
        user.setDelFlag("0");
        user.setDeptId(105L);
        user.setNickName(name);
        return user;
    }
}
