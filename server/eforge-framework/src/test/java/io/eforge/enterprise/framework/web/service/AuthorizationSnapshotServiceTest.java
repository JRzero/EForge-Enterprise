package io.eforge.enterprise.framework.web.service;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.support.SimpleTransactionStatus;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthorizationSnapshotServiceTest
{
    private final ISysUserService users = mock(ISysUserService.class);
    private final NavigationMapper navigation = mock(NavigationMapper.class);
    private final SysPermissionService permissions = mock(SysPermissionService.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private AuthorizationSnapshotService service;
    private LoginUser session;
    private SysUser current;

    @BeforeEach void setup()
    {
        when(manager.getTransaction(any())).thenAnswer(invocation -> {
            TransactionDefinition definition = invocation.getArgument(0);
            assertEquals("MASTER", DynamicDataSourceContextHolder.getDataSourceType());
            assertTrue(definition.isReadOnly());
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
            assertEquals(TransactionDefinition.ISOLATION_REPEATABLE_READ, definition.getIsolationLevel());
            return new SimpleTransactionStatus();
        });
        service = new AuthorizationSnapshotService(users, navigation, permissions, manager);
        SysUser cached = new SysUser(7L); cached.setDeptId(103L); cached.setUserName("reader");
        session = new LoginUser(7L, 103L, cached, Set.of("withdrawn"));
        session.setToken("session-token"); session.setExpireTime(123456L); session.rememberCacheSnapshot(new byte[] {1, 2, 3});
        current = new SysUser(7L); current.setDeptId(105L); current.setUserName("reader");
        current.setStatus("0"); current.setDelFlag("0");
        when(users.selectUserById(7L)).thenReturn(current);
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of());
    }
    @AfterEach void cleanup() {DynamicDataSourceContextHolder.clearDataSourceType();}

    @Test void primarySnapshotReplacesAllAuthorityAndRestoresCallerContextWithoutChangingSessionBytes()
    {
        DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
        SysRole userRole = new SysRole(3L); userRole.setDataScope("2"); userRole.setPermissions(Set.of("system:user:list"));
        SysRole postRole = new SysRole(4L); postRole.setDataScope("5"); postRole.setPermissions(Set.of("system:post:list"));
        when(navigation.selectActiveRoles(7L)).thenReturn(List.of(userRole, postRole));
        when(permissions.getMenuPermission(current)).thenReturn(Set.of("system:user:list", "system:post:list"));
        service.refresh(session);
        assertEquals("SLAVE", DynamicDataSourceContextHolder.getDataSourceType());
        assertSame(current, session.getUser()); assertEquals(105L, session.getDeptId());
        assertEquals(Set.of("system:user:list", "system:post:list"), session.getPermissions());
        assertEquals("2", session.getUser().getRoles().get(0).getDataScope());
        assertEquals(Set.of("system:post:list"), session.getUser().getRoles().get(1).getPermissions());
        assertEquals("session-token", session.getToken()); assertEquals(123456L, session.getExpireTime());
        assertArrayEquals(new byte[] {1, 2, 3}, session.cacheSnapshot());
        verify(manager).commit(any());
    }

    @Test void noActiveRolesCannotUseUpstreamDeletedRoleFallback()
    {
        service.refresh(session);
        assertTrue(session.getPermissions().isEmpty()); assertTrue(session.getUser().getRoles().isEmpty());
        verifyNoInteractions(permissions);
        assertNull(DynamicDataSourceContextHolder.getDataSourceType());
    }

    @Test void administratorRetainsWildcardWithoutAnAssignedRole()
    {
        current.setUserId(1L); session.setUserId(1L);
        when(users.selectUserById(1L)).thenReturn(current);
        when(navigation.selectActiveRoles(1L)).thenReturn(List.of());
        when(permissions.getMenuPermission(current)).thenReturn(Set.of("*:*:*"));
        service.refresh(session); assertEquals(Set.of("*:*:*"), session.getPermissions());
    }

    @Test void missingDisabledDeletedAndMismatchedIdentityCannotPublishOrRenewAuthority()
    {
        for (int scenario = 0; scenario < 4; scenario++)
        {
            current.setStatus(scenario == 1 ? "1" : "0"); current.setDelFlag(scenario == 2 ? "2" : "0");
            current.setUserId(scenario == 3 ? 8L : 7L);
            when(users.selectUserById(7L)).thenReturn(scenario == 0 ? null : current);
            ApiFailure failure = assertThrows(ApiFailure.class, () -> service.refresh(session));
            assertEquals(401, failure.status()); assertEquals(Set.of("withdrawn"), session.getPermissions());
        }
        verifyNoInteractions(navigation, permissions); verify(manager, times(4)).rollback(any());
    }

    @Test void databaseFailureRestoresContextAndLeavesOriginalSessionUntouched()
    {
        DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
        var raw = new DataAccessResourceFailureException("private SQL credential");
        when(navigation.selectActiveRoles(7L)).thenThrow(raw);
        ApiFailure safe = assertThrows(ApiFailure.class, () -> service.refresh(session));
        assertEquals(503, safe.status()); assertEquals("AUTHORIZATION_UNAVAILABLE", safe.code());
        assertFalse(safe.getMessage().contains("private")); assertSame(raw, safe.getCause());
        assertEquals("SLAVE", DynamicDataSourceContextHolder.getDataSourceType());
        assertEquals(103L, session.getDeptId()); assertEquals(Set.of("withdrawn"), session.getPermissions());
        verify(manager).rollback(any());
    }

    @Test void failedReadTransactionCompletionCannotPublishTheSnapshot()
    {
        doThrow(new TransactionSystemException("private driver endpoint")).when(manager).commit(any());
        ApiFailure safe = assertThrows(ApiFailure.class, () -> service.refresh(session));
        assertEquals(503, safe.status()); assertEquals(Set.of("withdrawn"), session.getPermissions());
        assertEquals(103L, session.getDeptId()); assertNull(DynamicDataSourceContextHolder.getDataSourceType());
    }

    @Test void malformedSessionFailsBeforeDatabaseAccess()
    {
        assertEquals(401, assertThrows(ApiFailure.class, () -> service.refresh(null)).status());
        session.setUserId(null);
        assertEquals(401, assertThrows(ApiFailure.class, () -> service.refresh(session)).status());
        verifyNoInteractions(manager, users, navigation, permissions);
    }

    @Test void loginProofRejectsChangedPasswordOrRenamedIdentityWithoutPublishingCurrentAuthority()
    {
        session.getUser().setPassword("verified-hash");
        current.setPassword("replacement-hash");
        ApiFailure changedPassword = assertThrows(ApiFailure.class, () -> service.confirmLogin(session));
        assertEquals(401, changedPassword.status());
        assertEquals("verified-hash", session.getPassword());
        assertEquals(Set.of("withdrawn"), session.getPermissions());
        current.setPassword("verified-hash"); current.setUserName("renamed-after-verification");
        assertEquals(401, assertThrows(ApiFailure.class, () -> service.confirmLogin(session)).status());
        assertEquals("reader", session.getUsername());
        verify(manager, times(2)).rollback(any());
    }

    @Test void successfulLoginProofPublishesCurrentGrantsOnlyAfterReadCommit()
    {
        session.getUser().setPassword("verified-hash"); current.setPassword("verified-hash");
        doAnswer(invocation -> {
            assertEquals(103L, session.getDeptId());
            assertEquals(Set.of("withdrawn"), session.getPermissions());
            return null;
        }).when(manager).commit(any());
        service.confirmLogin(session);
        assertSame(current, session.getUser()); assertEquals(105L, session.getDeptId());
        assertTrue(session.getPermissions().isEmpty());
        assertEquals("session-token", session.getToken());
        assertArrayEquals(new byte[] {1, 2, 3}, session.cacheSnapshot());
    }

    @Test void failedLoginReadCommitDoesNotPublishCurrentGrants()
    {
        session.getUser().setPassword("verified-hash"); current.setPassword("verified-hash");
        doThrow(new TransactionSystemException("private commit endpoint")).when(manager).commit(any());
        assertEquals(503, assertThrows(ApiFailure.class, () -> service.confirmLogin(session)).status());
        assertEquals(103L, session.getDeptId()); assertEquals(Set.of("withdrawn"), session.getPermissions());
    }
}
