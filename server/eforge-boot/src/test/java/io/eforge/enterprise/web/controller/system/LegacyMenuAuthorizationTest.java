package io.eforge.enterprise.web.controller.system;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.*;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.ISysMenuService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.system.service.impl.SysMenuServiceImpl;
import io.eforge.enterprise.web.controller.api.v1.system.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Both real HTTP/security boundaries and shared menu services; persistence calls are observed. */
@WebMvcTest
@ContextConfiguration(classes = {SysMenuController.class, MenuController.class, MenuService.class,
        SysPermissionService.class, PermissionService.class, ApiExceptionHandler.class, GlobalExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, LegacyMenuAuthorizationTest.Configuration.class})
class LegacyMenuAuthorizationTest
{
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean SysMenuMapper legacyMapper;
    @MockitoBean SysRoleMapper legacyRoles;
    @MockitoBean SysRoleMenuMapper legacyRoleMenus;
    @MockitoBean ISysRoleService roleService;
    @MockitoBean MenuMutationMapper rows;
    @MockitoBean DepartmentMutationMapper mutex;
    @MockitoBean MenuRouteCatalog routes;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean ISysUserService users;
    @MockitoBean NavigationMapper navigation;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;

    @BeforeEach void setup()
    {
        actor(9, Set.of("system:menu:add", "system:menu:edit", "system:menu:remove"));
        when(transactions.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
        when(mutex.lockRoot()).thenReturn(100L);
        when(rows.rows()).thenReturn(List.of(row(1, 0, "parent", ""), row(2, 1, "owned", "system:menu:edit"), row(3, 1, "hidden", "secret:read")));
        when(rows.grantedIds(9L)).thenReturn(List.of(1L, 2L));
        when(users.selectUserById(9L)).thenReturn(user(9));
        when(navigation.selectActiveRoles(9L)).thenReturn(List.of(role("0")));
        when(legacyMapper.selectMenuPermsByRoleId(5L)).thenReturn(List.of("system:menu:edit", "owned:read"));
        when(legacyMapper.checkMenuNameUnique(anyString(), anyLong())).thenReturn(null);
        when(legacyMapper.selectMenusByPathOrRouteName(nullable(String.class), nullable(String.class))).thenReturn(List.of());
        when(legacyMapper.insertMenu(any())).thenReturn(1);
        when(legacyMapper.updateMenu(any())).thenReturn(1);
        when(legacyMapper.deleteMenuById(anyLong())).thenReturn(1);
    }

    @Test void bothHttpBoundariesRejectChangingOwnedMenuToWildcardBeforeAnyWrite() throws Exception
    {
        mvc.perform(put("/api/v1/system/menus/2").contentType(MediaType.APPLICATION_JSON).content(canonical("*:*:*")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, "*:*:*")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"*:*:*", "secret:read", "owned:read,secret:read"})
    void unknownOrMixedPermissionsCannotBeIntroducedOnEitherLegacyWrite(String permission) throws Exception
    {
        mvc.perform(post("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(0, permission)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, permission)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"missing", "disabled"})
    void freshRoleAuthorityCannotBorrowStaleRequestOrDisabledRolePermissions(String state) throws Exception
    {
        // Method permission is intentionally present in the request; write authority is read again under the lock.
        when(navigation.selectActiveRoles(9L)).thenReturn(state.equals("missing") ? List.of() : List.of(role("1")));
        when(legacyMapper.selectMenuPermsByUserId(9L)).thenReturn(List.of("*:*:*"));
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, "owned:read")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        verify(legacyMapper, never()).selectMenuPermsByUserId(anyLong()); noWrites();
    }

    @Test void createCannotBorrowTheUnchangedPermissionAllowanceFromAPayloadIdentity() throws Exception
    {
        when(rows.rows()).thenReturn(List.of(row(1, 0, "parent", ""), row(2, 1, "owned", "secret:read")));
        mvc.perform(post("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, "secret:read")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"omitted", "null", "unchanged", "clear"})
    void optionalAndUnchangedLegacyPermissionSemanticsArePreserved(String mode) throws Exception
    {
        // An existing inactive/otherwise unavailable grant may be kept unchanged, but cannot be newly introduced.
        when(rows.rows()).thenReturn(List.of(row(1, 0, "parent", ""), row(2, 1, "owned", "secret:read")));
        var body = values(2, mode.equals("unchanged") ? "secret:read" : mode.equals("clear") ? "" : null);
        if (mode.equals("omitted")) body.remove("perms");
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.msg").value("操作成功"));
        verify(legacyMapper).updateMenu(argThat(menu -> java.util.Objects.equals(body.get("perms"), menu.getPerms())));
        if (!mode.equals("clear")) verify(legacyMapper, never()).selectMenuPermsByRoleId(anyLong());
    }

    @Test void authorizedChangesAndOriginalLegacyRouteFieldsRemainSupported() throws Exception
    {
        var body = values(2, "owned:read"); body.put("component", "system/user/index"); body.put("routeName", "LegacyOwnedRoute");
        body.put("query", "{\"tab\":\"legacy\"}"); body.put("isCache", "1");
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(legacyMapper).updateMenu(argThat(menu -> "owned:read".equals(menu.getPerms())
                && "system/user/index".equals(menu.getComponent()) && "LegacyOwnedRoute".equals(menu.getRouteName())
                && "{\"tab\":\"legacy\"}".equals(menu.getQuery()) && "1".equals(menu.getIsCache()) && "operator".equals(menu.getUpdateBy())));
        verifyNoInteractions(routes);
        var order = inOrder(mutex, rows, users, navigation, legacyMapper);
        order.verify(mutex).lockRoot(); order.verify(rows).rows();
        order.verify(users).selectUserById(9L); order.verify(navigation).selectActiveRoles(9L);
        order.verify(legacyMapper).selectMenuPermsByRoleId(5L); order.verify(legacyMapper).updateMenu(any());
    }

    @Test void administratorMayWriteAnyPermissionWithoutGrantLookup() throws Exception
    {
        actor(1, Set.of("*:*:*"));
        mvc.perform(post("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(0, "*:*:*")))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, "secret:read")))
                .andExpect(jsonPath("$.code").value(200));
        verify(legacyMapper).insertMenu(any()); verify(legacyMapper).updateMenu(any());
        verifyNoInteractions(users, navigation);
    }

    @ParameterizedTest @ValueSource(strings = {"update", "delete", "sort"})
    void ungrantedTargetIsForbiddenIncludingMixedSortBeforeAnyWrite(String operation) throws Exception
    {
        mvc.perform(request(operation, 3)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites();
    }

    @Test void newInaccessibleParentIsForbiddenButUnchangedParentIsPreserved() throws Exception
    {
        var body = values(2, null); body.put("parentId", 3);
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        mvc.perform(post("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites();
        when(rows.grantedIds(9L)).thenReturn(List.of(2L));
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(2, null)))
                .andExpect(jsonPath("$.code").value(200));
        verify(legacyMapper).updateMenu(any());
    }

    @ParameterizedTest @ValueSource(strings = {"create", "update", "delete", "sort"})
    void allLegacyWritesAcquireRootLockBeforeValidationAndUseTransaction(String operation) throws Exception
    {
        mvc.perform(request(operation, 2)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        var order = inOrder(transactions, mutex, rows, legacyMapper);
        order.verify(transactions).getTransaction(any()); order.verify(mutex).lockRoot();
        order.verify(rows, atLeastOnce()).rows();
        switch (operation)
        {
            case "create" -> order.verify(legacyMapper).insertMenu(any());
            case "update" -> order.verify(legacyMapper).updateMenu(any());
            case "delete" -> order.verify(legacyMapper).deleteMenuById(2L);
            case "sort" -> order.verify(legacyMapper, atLeastOnce()).updateMenuSort(any());
        }
        order.verify(transactions, atLeastOnce()).commit(any());
    }

    @ParameterizedTest @ValueSource(strings = {"create", "update", "delete", "sort"})
    void missingRootHasLegacyConflictAndNoReadsOrWrites(String operation) throws Exception
    {
        when(mutex.lockRoot()).thenReturn(null);
        mvc.perform(request(operation, 2)).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409)).andExpect(jsonPath("$.msg").value("根部门不存在"));
        verifyNoInteractions(rows, legacyMapper); verify(transactions).rollback(any());
    }

    @ParameterizedTest @ValueSource(strings = {"create", "update", "delete", "sort"})
    void originalMethodPermissionsAreStillRequiredBeforeLockOrReads(String operation) throws Exception
    {
        actor(9, Set.of());
        mvc.perform(request(operation, 2)).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        verifyNoInteractions(mutex, rows, legacyMapper);
    }

    @Test void originalDeleteBusinessWarningsRemainCompatible() throws Exception
    {
        when(legacyMapper.hasChildByMenuId(2L)).thenReturn(1);
        mvc.perform(delete("/system/menu/2")).andExpect(jsonPath("$.code").value(601))
                .andExpect(jsonPath("$.msg").value("存在子菜单,不允许删除"));
        when(legacyMapper.hasChildByMenuId(2L)).thenReturn(0);
        when(legacyRoleMenus.checkMenuExistRole(2L)).thenReturn(1);
        mvc.perform(delete("/system/menu/2")).andExpect(jsonPath("$.code").value(601))
                .andExpect(jsonPath("$.msg").value("菜单已分配,不允许删除"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(longs = {2, 3})
    void bothRoutesRejectMovingAnAncestorUnderItsGrantedDescendant(long descendant) throws Exception
    {
        when(rows.rows()).thenReturn(List.of(group(1, 0, "parent"), group(2, 1, "child"), group(3, 2, "grandchild")));
        when(rows.grantedIds(9L)).thenReturn(List.of(1L, 2L, 3L));
        var canonical = new MenuContracts.MenuWriteRequest("parent", "Parent", Long.toString(descendant), 1,
                MenuContracts.Type.GROUP, "0", true, null, null, "", "", "", "parent-path", "", true);
        mvc.perform(put("/api/v1/system/menus/1").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(canonical)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MENU_CYCLE"));
        var input = values(1, ""); input.put("parentId", descendant); input.put("menuType", "M");
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.msg").value("Menu operation conflicts with existing data."));
        noWrites();
    }

    @Test void directSelfParentRetainsTheOriginalLegacyBusinessMessage() throws Exception
    {
        var input = values(2, null); input.put("parentId", 2);
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value("修改菜单'Owned'失败，上级菜单不能选择自己"));
        noWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"null", "omitted"})
    void hierarchyValidationPreservesANullParentAsNoAssignment(String kind) throws Exception
    {
        when(rows.grantedIds(9L)).thenReturn(List.of(2L));
        var input = values(2, null); input.put("parentId", null);
        if (kind.equals("omitted")) input.remove("parentId");
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(legacyMapper).updateMenu(argThat(menu -> menu.getParentId() == null && menu.getPerms() == null));
    }

    @Test void hierarchyValidationAllowsMovingToAnotherGrantedBranch() throws Exception
    {
        when(rows.rows()).thenReturn(List.of(group(1, 0, "parent"), group(2, 1, "child"), group(3, 0, "sibling")));
        when(rows.grantedIds(9L)).thenReturn(List.of(1L, 2L, 3L));
        var input = values(2, null); input.put("parentId", 3); input.put("menuType", "M");
        mvc.perform(put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        verify(legacyMapper).updateMenu(argThat(menu -> Long.valueOf(3).equals(menu.getParentId())));
    }

    private void noWrites()
    {
        verify(legacyMapper, never()).insertMenu(any()); verify(legacyMapper, never()).updateMenu(any());
        verify(legacyMapper, never()).deleteMenuById(anyLong()); verify(legacyMapper, never()).updateMenuSort(any());
        verify(rows, never()).insert(any());
        verify(rows, never()).update(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private MockHttpServletRequestBuilder request(String operation, long id) throws Exception
    {
        return switch (operation)
        {
            case "create" -> post("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(0, "owned:read"));
            case "update" -> put("/system/menu").contentType(MediaType.APPLICATION_JSON).content(body(id, "owned:read"));
            case "delete" -> delete("/system/menu/" + id);
            case "sort" -> put("/system/menu/updateSort").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"menuIds\":\"1," + id + "\",\"orderNums\":\"1,2\"}");
            default -> throw new IllegalArgumentException(operation);
        };
    }

    private String body(long id, String permission) throws Exception { return json.writeValueAsString(values(id, permission)); }
    private static LinkedHashMap<String, Object> values(long id, String permission)
    {
        var body = new LinkedHashMap<String, Object>(); if (id > 0) body.put("menuId", id);
        body.put("parentId", 1); body.put("menuName", "Owned"); body.put("orderNum", 1); body.put("menuType", "F");
        body.put("path", "owned-path"); body.put("isFrame", "1"); body.put("status", "0"); body.put("perms", permission); return body;
    }
    private String canonical(String permission) throws Exception
    {
        return json.writeValueAsString(new MenuContracts.MenuWriteRequest("owned", "Owned", "1", 1,
                MenuContracts.Type.FUNCTION, "0", true, null, null, permission, "", "", null, "", true));
    }
    private void actor(long id, Set<String> grants)
    { when(tokens.getLoginUser(any())).thenAnswer(call -> new LoginUser(id, 103L, user(id), grants)); }
    private static SysUser user(long id) { SysUser user = new SysUser(id); user.setUserName("operator"); return user; }
    private static SysRole role(String status) { SysRole role = new SysRole(5L); role.setStatus(status); role.setDelFlag("0"); return role; }
    private static MenuMutationMapper.Row row(long id, long parent, String key, String permission)
    { return new MenuMutationMapper.Row(id, parent, key, null, key, 1, id == 1 ? "M" : "F", "0", "0", permission, "1", key + "-path", "", "", "", "0", null); }
    private static MenuMutationMapper.Row group(long id, long parent, String key)
    { return new MenuMutationMapper.Row(id, parent, key, null, key, 1, "M", "0", "0", "", "1", key + "-path", "", "", "", "0", null); }

    @TestConfiguration @EnableTransactionManagement
    static class Configuration
    {
        @Bean ISysMenuService legacy() { return new SysMenuServiceImpl(); }
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
