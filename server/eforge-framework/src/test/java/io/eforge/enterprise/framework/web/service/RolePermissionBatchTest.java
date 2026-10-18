package io.eforge.enterprise.framework.web.service;

import java.util.List;
import java.util.Set;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.system.service.ISysMenuService;
import io.eforge.enterprise.system.service.impl.SysMenuServiceImpl;
import io.eforge.enterprise.system.mapper.SysMenuMapper;
import io.eforge.enterprise.system.domain.RoleMenuPermission;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RolePermissionBatchTest {
    @Test void multipleRolesDoNotIssueOneMenuLookupPerRole() {
        var menus=mock(ISysMenuService.class);
        var service=new SysPermissionService();ReflectionTestUtils.setField(service,"menuService",menus);
        var user=new SysUser(7L);var first=new SysRole(3L);first.setStatus("0");var second=new SysRole(4L);second.setStatus("0");
        user.setRoles(List.of(first,second));
        first.setDataScope("2");second.setDataScope("5");
        when(menus.selectMenuPermsByRoleIds(List.of(3L,4L))).thenReturn(Map.of(3L,Set.of("first","shared"),4L,Set.of("second","shared")));
        assertEquals(Set.of("first","second","shared"),service.getMenuPermission(user));
        assertEquals(Set.of("first","shared"),first.getPermissions());assertEquals(Set.of("second","shared"),second.getPermissions());
        assertEquals("2",first.getDataScope());assertEquals("5",second.getDataScope());
        verify(menus,never()).selectMenuPermsByRoleId(anyLong());
        verify(menus).selectMenuPermsByRoleIds(List.of(3L,4L));
    }
    @Test void batchProjectionPreservesLegacySplittingExactIdsAndIndependentEmptySets() {
        var mapper=mock(SysMenuMapper.class);var service=new SysMenuServiceImpl();ReflectionTestUtils.setField(service,"menuMapper",mapper);
        long exact=9007199254740995L;
        when(mapper.selectMenuPermsByRoleIds(List.of(exact,4L,5L))).thenReturn(List.of(
                new RoleMenuPermission(exact," a, b,,c, "),new RoleMenuPermission(exact,"a"),
                new RoleMenuPermission(4L,null),new RoleMenuPermission(99L,"unexpected")));
        var grants=service.selectMenuPermsByRoleIds(List.of(exact,4L,exact,5L));
        assertEquals(Set.of("a"," b","","c"),grants.get(exact));
        assertEquals(Set.of(),grants.get(4L));assertEquals(Set.of(),grants.get(5L));assertFalse(grants.containsKey(99L));
        grants.get(4L).add("local");assertTrue(grants.get(5L).isEmpty());
        verify(mapper).selectMenuPermsByRoleIds(List.of(exact,4L,5L));
        assertTrue(service.selectMenuPermsByRoleIds(List.of()).isEmpty());verifyNoMoreInteractions(mapper);
    }
    @Test void disabledAndReservedAdminRolesDoNotGrantOrdinaryUsersWildcardOrTriggerFallback() {
        var menus=mock(ISysMenuService.class);var service=new SysPermissionService();ReflectionTestUtils.setField(service,"menuService",menus);
        var reserved=new SysRole(1L);reserved.setStatus("0");var disabled=new SysRole(4L);disabled.setStatus("1");
        var user=new SysUser(7L);user.setRoles(List.of(reserved,disabled));
        assertTrue(service.getMenuPermission(user).isEmpty());verifyNoInteractions(menus);
        assertEquals(Set.of("*:*:*"),service.getMenuPermission(new SysUser(1L)));verifyNoInteractions(menus);
    }
}
