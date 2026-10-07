package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.CredentialsExpiredException;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BootstrapServiceTest
{
    @Mock private ISysUserService users;
    @Mock private NavigationMapper menus;
    @Mock private SysPermissionService permissions;
    @Mock private TokenService tokens;
    @Mock private PasswordStatusService passwords;
    @Mock private org.springframework.transaction.PlatformTransactionManager transactions;
    private BootstrapService service;
    private SysUser user;
    private LoginUser session;

    @BeforeEach void setup()
    {
        when(transactions.getTransaction(any())).thenAnswer(invocation -> new org.springframework.transaction.support.SimpleTransactionStatus());
        service = new BootstrapService(users, menus, permissions, tokens, new NavigationProjection(), passwords, transactions);
        user = new SysUser();
        user.setUserId(2L); user.setDeptId(105L); user.setUserName("ry"); user.setNickName("Display name");
        user.setStatus("0"); user.setDelFlag("0");
        session = new LoginUser(2L, 103L, new SysUser(), Set.of("stale:permission"));
        session.setToken("session-id");
        when(users.selectUserById(2L)).thenReturn(user);
    }
    @Test void snapshotRefreshesPermissionsRolesAndDepartmentUsingFreshUser()
    {
        SysRole role = new SysRole(2L); role.setRoleKey("common"); role.setStatus("0"); role.setDataScope("2");
        when(menus.selectActiveRoles(2L)).thenReturn(List.of(role));
        when(permissions.getMenuPermission(user)).thenReturn(Set.of("system:user:list"));
        when(menus.selectGrantedMenus(2L, false)).thenReturn(List.of());
        var response = service.bootstrap(session);
        assertEquals("2", response.user().id()); assertEquals("Display name", response.user().displayName());
        assertEquals(Set.of("common"), response.roles());
        assertEquals(Set.of("system:user:list"), session.getPermissions());
        assertEquals(response.permissions(), session.getPermissions());
        assertSame(user, session.getUser()); assertEquals(105L, session.getDeptId());
        assertEquals("2", session.getUser().getRoles().get(0).getDataScope());
        verify(tokens).setLoginUser(session);
    }
    @Test void noActiveRolesCannotFallBackToDeletedRolePermissions()
    {
        when(menus.selectActiveRoles(2L)).thenReturn(List.of());
        when(menus.selectGrantedMenus(2L, false)).thenReturn(List.of());
        var response = service.bootstrap(session);
        assertTrue(response.roles().isEmpty()); assertTrue(response.permissions().isEmpty());
        assertTrue(session.getPermissions().isEmpty()); verifyNoInteractions(permissions);
    }
    @Test void inactiveAccountsInvalidateSessionBeforeReturningAnySnapshot()
    {
        for (String status : List.of("1", "0"))
        {
            user.setStatus(status); user.setDelFlag(status.equals("0") ? "2" : "0");
            assertThrows(CredentialsExpiredException.class, () -> service.bootstrap(session));
        }
        verify(tokens, times(2)).delLoginUser("session-id");
        verifyNoInteractions(menus, permissions); verify(tokens, never()).setLoginUser(any());
    }
    @Test void missingAccountInvalidatesSession()
    {
        when(users.selectUserById(2L)).thenReturn(null);
        assertThrows(CredentialsExpiredException.class, () -> service.bootstrap(session));
        verify(tokens).delLoginUser("session-id");
    }
    @Test void administratorKeepsUpstreamWildcardAndDisplayNameFallback()
    {
        user.setUserId(1L); user.setNickName("");
        when(menus.selectActiveRoles(1L)).thenReturn(List.of());
        when(menus.selectGrantedMenus(1L, true)).thenReturn(List.of());
        when(permissions.getMenuPermission(user)).thenReturn(Set.of("*:*:*"));
        var response = service.bootstrap(session);
        assertEquals(Set.of("admin"), response.roles()); assertEquals(Set.of("*:*:*"), response.permissions());
        assertEquals("ry", response.user().displayName());
    }
    @Test void consoleSnapshotsRefreshAuthorizationWithoutRevivingOrExtendingRedisSessions()
    {
        when(menus.selectActiveRoles(2L)).thenReturn(List.of());
        when(menus.selectGrantedMenus(2L,false)).thenReturn(List.of());
        var response=service.refreshConsoleAuthorization(session);
        assertTrue(response.permissions().isEmpty());assertTrue(session.getPermissions().isEmpty());
        assertSame(user,session.getUser());verifyNoInteractions(tokens,permissions);
    }
    @Test void consoleReadsStillInvalidateDisabledAccountsWithoutRecreatingSessions()
    {
        user.setStatus("1");assertThrows(CredentialsExpiredException.class,()->service.refreshConsoleAuthorization(session));
        verify(tokens).delLoginUser("session-id");verify(tokens,never()).setLoginUser(any());verifyNoInteractions(menus,permissions);
    }
    @Test void avatarUsesFreshAccountAndRejectsUnsafeStoredPaths()
    {
        when(menus.selectActiveRoles(2L)).thenReturn(List.of());
        when(menus.selectGrantedMenus(2L,false)).thenReturn(List.of());
        user.setAvatar("/profile/avatar/2026/10/avatar_2.png");
        assertEquals(user.getAvatar(),service.bootstrap(session).user().avatarUrl());
        for(String unsafe:List.of("https://example.com/tracker.png","javascript:alert(1)","/profile/../secrets.png","//example.com/x.png","/profile/a.png?token=secret")) {
            user.setAvatar(unsafe);assertNull(service.bootstrap(session).user().avatarUrl());
        }
        assertTrue(session.getPermissions().isEmpty());verifyNoInteractions(permissions);
    }
    @Test void passwordStatusPreservesOriginalConfigurationAndDateBoundaries()
    {
        java.util.Date now = new java.util.Date(1_800_000_000_000L);
        assertTrue(BootstrapResponse.PasswordStatus.from("3",1,30,null,now).initialChangeRecommended());
        assertTrue(BootstrapResponse.PasswordStatus.from("3",1,30,null,now).expired());
        assertFalse(BootstrapResponse.PasswordStatus.from("0",null,null,null,now).expired());
        assertFalse(BootstrapResponse.PasswordStatus.from("0",0,-1,null,now).initialChangeRecommended());
        for(long offset:List.of(30L*86_400_000,31L*86_400_000-1))
            assertFalse(BootstrapResponse.PasswordStatus.from("0",1,30,new java.util.Date(now.getTime()-offset),now).expired());
        assertTrue(BootstrapResponse.PasswordStatus.from("0",1,30,new java.util.Date(now.getTime()-31L*86_400_000),now).expired());
        assertTrue(BootstrapResponse.PasswordStatus.from("0",1,30,new java.util.Date(now.getTime()+31L*86_400_000),now).expired());
        when(menus.selectActiveRoles(2L)).thenReturn(List.of());when(menus.selectGrantedMenus(2L,false)).thenReturn(List.of());
        when(passwords.read(null)).thenReturn(new BootstrapResponse.PasswordStatus("3",true,true));
        var response=service.bootstrap(session);assertEquals("3",response.passwordStatus().characterType());
        assertTrue(response.passwordStatus().initialChangeRecommended());assertTrue(response.passwordStatus().expired());
        clearInvocations(passwords);assertNull(service.refreshConsoleAuthorization(session).passwordStatus());verifyNoInteractions(passwords);
    }
    @Test void releasesReadonlySnapshotBeforeGuardedPolicyReadsAndRestoresConsoleBehavior()
    {
        when(menus.selectActiveRoles(2L)).thenReturn(List.of());when(menus.selectGrantedMenus(2L,false)).thenReturn(List.of());
        service.bootstrap(session);
        var sequence=inOrder(transactions,passwords);
        sequence.verify(transactions).getTransaction(argThat(definition->definition.isReadOnly() && definition.getIsolationLevel()==org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ));
        sequence.verify(transactions).commit(any());sequence.verify(passwords).read(null);
        clearInvocations(passwords);service.refreshConsoleAuthorization(session);verifyNoInteractions(passwords);
    }
}