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
    private BootstrapService service;
    private SysUser user;
    private LoginUser session;

    @BeforeEach void setup()
    {
        service = new BootstrapService(users, menus, permissions, tokens, new NavigationProjection());
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
}
