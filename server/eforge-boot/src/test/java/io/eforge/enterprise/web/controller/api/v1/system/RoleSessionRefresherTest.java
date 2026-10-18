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
import io.eforge.enterprise.framework.web.service.SessionIndexService;
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
    @Mock SessionIndexService cache;
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
        located();
    }

    void located()
    {
        when(cache.sessionKeys(anySet())).thenReturn(List.of(key));
        when(tokens.getLoginUserByToken("existing")).thenReturn(session);
    }

    @Test
    void thirtyThreeSessionsUseTwoBoundedPublicationTransactions()
    {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(100L);
        var keys = java.util.stream.IntStream.range(0, 33).mapToObj(i -> "login_tokens:batch-" + i).toList();
        when(cache.sessionKeys(anySet())).thenReturn(keys);
        when(tokens.getLoginUserByToken(anyString())).thenAnswer(call -> {
            LoginUser value = new LoginUser(7L, 103L, new SysUser(7L), Set.of("old:permission"));
            value.setToken(call.getArgument(0));
            return value;
        });
        when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(any())).thenReturn(true);
        refresher.refresh(Set.of(7L));
        verify(manager, times(2)).getTransaction(any());
        verify(mutations, times(2)).lockRoot();
        verify(manager, times(2)).commit(any());
        var order = inOrder(tokens, manager);
        for (int i = 0; i < 32; i++) order.verify(tokens).getLoginUserByToken("batch-" + i);
        order.verify(manager).getTransaction(any());
        order.verify(tokens, times(32)).updateLoginUser(any());
        order.verify(manager).commit(any());
        order.verify(tokens).getLoginUserByToken("batch-32");
        order.verify(manager).getTransaction(any());
        order.verify(tokens).updateLoginUser(any());
        order.verify(manager).commit(any());
    }

    @Test
    void readsRedisBeforeOpeningThePublicationTransaction()
    {
        existing();
        when(users.selectUserById(7L)).thenReturn(fresh);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
        when(tokens.updateLoginUser(session)).thenReturn(true);
        refresher.refresh(Set.of(7L));
        var order = inOrder(cache, tokens, manager, mutations, users);
        order.verify(cache).sessionKeys(anySet());
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(manager).getTransaction(any());
        order.verify(mutations).lockRoot();
        order.verify(users).selectUserById(7L);
        order.verify(tokens).updateLoginUser(session);
        order.verify(manager).commit(any());
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
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(mutations).lockRoot();
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
        var order = inOrder(tokens, manager, mutations, users);
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(manager).getTransaction(any());
        order.verify(mutations).lockRoot();
        order.verify(users).selectUserById(7L);
        order.verify(tokens).updateLoginUser(session);
        order.verify(manager).commit(any());
        order.verify(tokens).getLoginUserByToken("existing");
        order.verify(manager).getTransaction(any());
        order.verify(mutations).lockRoot();
        order.verify(users).selectUserById(7L);
        order.verify(tokens).updateLoginUser(profileWon);
        order.verify(manager).commit(any());
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
        located();
        when(tokens.getLoginUserByToken("existing")).thenReturn(null);
        refresher.refresh(Set.of(7L));
        verifyNoInteractions(users, navigation, permissions, manager, mutations);
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
        located();
        refresher.refresh(Set.of(8L));
        verifyNoInteractions(users, navigation, permissions, manager, mutations);
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
    void missingRootRollsBackBeforeReadingAuthorityOrPublishingSession()
    {
        located();
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(null);
        assertThrows(io.eforge.enterprise.common.exception.ApiFailure.class, () -> refresher.refresh(Set.of(7L)));
        verify(manager).rollback(any());
        verifyNoInteractions(users, navigation, permissions);
        verify(tokens, never()).updateLoginUser(any());
        verify(tokens, never()).delLoginUser(any());
    }

    @Test
    void failedEnumerationCannotAcquireRootOrPublishAPartialBatch()
    {
        when(cache.sessionKeys(anySet())).thenThrow(new IllegalStateException("cursor failed"));
        assertThrows(IllegalStateException.class, () -> refresher.refresh(Set.of(7L)));
        verifyNoInteractions(manager, mutations, users, tokens);
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
