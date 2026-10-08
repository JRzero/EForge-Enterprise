package io.eforge.enterprise.web.controller.system;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.ApiSecurityProblemHandler;
import io.eforge.enterprise.framework.security.handle.AuthenticationEntryPointImpl;
import io.eforge.enterprise.framework.security.handle.LogoutSuccessHandlerImpl;
import io.eforge.enterprise.framework.web.exception.ApiExceptionHandler;
import io.eforge.enterprise.framework.web.exception.ApiRoutingExceptionResolver;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.domain.NavigationMenu;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.RoleSelectionMapper;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysMenuService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleController;
import io.eforge.enterprise.web.controller.api.v1.system.RoleService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP/security/grant orchestration and Spring commit callbacks; persistence is observed. */
@WebMvcTest
@ContextConfiguration(classes = {SysRoleController.class, RoleController.class, RoleService.class,
        PermissionService.class, GlobalExceptionHandler.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class,
        ApiSecurityProblemHandler.class, AuthenticationEntryPointImpl.class,
        JwtAuthenticationTokenFilter.class, LegacyRoleMenuSecurityTest.Configuration.class})
class LegacyRoleMenuSecurityTest
{
    private static final String LEGACY = "/system/role";
    private static final String CANONICAL = "/api/v1/system/roles";
    private static final Map<Long, String> KEYS = Map.of(10L, "available", 11L, "available-action",
            20L, "previous-hidden", 21L, "hidden-child", 30L, "restricted-new");
    @Autowired MockMvc mvc;
    @Autowired RecordingTransactions transactions;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysMenuService menus;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysUserService users;
    @MockitoBean RoleSelectionMapper selections;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    private Map<Long, List<Long>> stored;
    private List<Long> insertIdentities;

    @BeforeEach void prepare()
    {
        transactions.events.clear();
        stored = new HashMap<>(); stored.put(2L, List.of(10L, 20L));
        insertIdentities = new ArrayList<>();
        actor(Set.of("system:role:add", "system:role:edit"));
        when(mutations.lockRoot()).thenAnswer(call -> {active(); transactions.events.add("lock"); return 100L;});
        doAnswer(call -> {active(); transactions.events.add("scope"); return null;}).when(roles).checkRoleDataScope(any(Long[].class));
        when(roles.selectRoleById(anyLong())).thenAnswer(call -> {
            active(); transactions.events.add("target"); return row(call.getArgument(0));
        });
        when(selections.menus()).thenAnswer(call -> {
            active(); transactions.events.add("menus");
            return List.of(menu(10, 0, "0"), menu(11, 10, "0"), menu(20, 0, "1"),
                    menu(21, 20, "1"), menu(30, 0, "1"));
        });
        when(selections.grantableMenuIds(9L)).thenAnswer(call -> {
            active(); transactions.events.add("available");
            return List.of(10L, 11L);
        });
        when(selections.menuIds(anyLong())).thenAnswer(call -> {
            active(); transactions.events.add("previous"); return stored.getOrDefault(call.getArgument(0), List.of());
        });
        when(selections.userIds(anyLong())).thenReturn(List.of(12L, 13L));
        when(roles.checkRoleNameUnique(any())).thenReturn(true);
        when(roles.checkRoleKeyUnique(any())).thenReturn(true);
        when(roles.insertRole(any())).thenAnswer(call -> {
            active(); transactions.events.add("insert"); SysRole role = call.getArgument(0);
            insertIdentities.add(role.getRoleId()); role.setRoleId(40L);
            stored.put(role.getRoleId(), List.copyOf(Arrays.asList(role.getMenuIds()))); return 1;
        });
        when(roles.updateRole(any())).thenAnswer(call -> {
            active(); transactions.events.add("update"); SysRole role = call.getArgument(0);
            stored.put(role.getRoleId(), List.copyOf(Arrays.asList(role.getMenuIds()))); return 1;
        });
        // Exercise the real synchronization registration without opening a Redis connection.
        doCallRealMethod().when(sessions).refreshAfterCommit(anySet());
        doAnswer(call -> {transactions.events.add("refresh"); return null;}).when(sessions).refresh(anySet());
    }

    private static void active()
    {
        assertTrue(TransactionSynchronizationManager.isActualTransactionActive(), "Grant reads/writes require the mutation transaction");
    }

    private void actor(Set<String> permissions)
    {
        actor(9L, permissions);
    }

    private void actor(long id, Set<String> permissions)
    {
        SysUser actor = new SysUser(id); actor.setUserName("operator");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(id, 103L, actor, permissions));
    }

    private static SysRole row(long id)
    {
        SysRole role = new SysRole(id); role.setRoleName("Role"); role.setRoleKey("role_key");
        role.setRoleSort(1); role.setDataScope("2"); role.setStatus("0"); role.setDelFlag("0");
        role.setMenuCheckStrictly(true); role.setDeptCheckStrictly(true); return role;
    }

    private static NavigationMenu menu(long id, long parent, String visible)
    {
        return new NavigationMenu(id, parent, KEYS.get(id), null, KEYS.get(id), 1,
                parent == 0 ? "M" : "F", visible, "0", "menu:" + id, "1", "", "");
    }

    @ParameterizedTest @ValueSource(strings = {"create", "edit"})
    void operationPermissionIsRequiredBeforeGrantReads(String operation) throws Exception
    {
        actor(Set.of());
        legacy(operation, "2", "[10]").andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        noWrites(); verifyNoInteractions(mutations, menus, selections, sessions);
        assertTrue(transactions.events.isEmpty());
    }

    @ParameterizedTest @ValueSource(strings = {"create", "edit"})
    void allowedLegacyWritesKeepExactMenusAndActor(String operation) throws Exception
    {
        legacy(operation, "2", "[10,11]").andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        if ("create".equals(operation))
        {
            assertEquals(List.of(10L, 11L), stored.get(40L));
            assertEquals(1, insertIdentities.size()); assertNull(insertIdentities.get(0));
            verify(roles).insertRole(argThat(role -> "operator".equals(role.getCreateBy())));
            verify(selections, never()).menuIds(anyLong()); verifyNoInteractions(sessions);
        }
        else
        {
            assertEquals(List.of(10L, 11L), stored.get(2L));
            verify(roles).updateRole(argThat(role -> "operator".equals(role.getUpdateBy())));
            verify(sessions).refreshAfterCommit(Set.of(12L, 13L));
            verify(sessions).refresh(Set.of(12L, 13L));
            assertBefore("lock", "scope"); assertBefore("scope", "target");
            assertBefore("target", "previous"); assertBefore("previous", "update");
            assertBefore("update", "commit"); assertBefore("commit", "refresh");
        }
        assertFalse(transactions.events.contains("rollback"));
    }

    @ParameterizedTest @MethodSource("writeEntrances")
    void mixedMenuSetCannotAddAnUnavailableGrantOrPartiallyWrite(String boundary, String operation) throws Exception
    {
        expectFailure(write(boundary, operation, 10L, 30L), boundary, 403);
        noWrites(); verifyNoInteractions(sessions);
        assertEquals(List.of(10L, 20L), stored.get(2L));
        assertTrue(transactions.events.contains("rollback"));
        assertFalse(transactions.events.contains("commit"));
    }

    static Stream<Arguments> writeEntrances()
    {
        return Stream.of("legacy", "canonical").flatMap(boundary ->
                Stream.of("create", "edit").map(operation -> Arguments.of(boundary, operation)));
    }

    @ParameterizedTest @MethodSource("broaderDisplayGrants")
    void displayMenusOutsideTheEffectiveRoleSourceCannotSupplyNewGrants(String boundary, String operation, long menuId) throws Exception
    {
        // The legacy display query can expose inactive-role links. Only the dedicated
        // effective-role query supplies grant authority; its SQL is tested separately.
        List<SysMenu> displayed = Stream.of(10L, 11L, 21L, 30L).map(id -> {
            SysMenu menu = new SysMenu(); menu.setMenuId(id); return menu;
        }).toList();
        when(menus.selectMenuList(any(SysMenu.class), eq(9L))).thenReturn(displayed);

        expectFailure(write(boundary, operation, 10L, menuId), boundary, 403);

        verify(selections).grantableMenuIds(9L);
        verify(menus, never()).selectMenuList(any(SysMenu.class), anyLong());
        noWrites(); verifyNoInteractions(sessions);
        assertEquals(List.of(10L, 20L), stored.get(2L));
        assertTrue(transactions.events.contains("rollback"));
    }

    static Stream<Arguments> broaderDisplayGrants()
    {
        return Stream.of("legacy", "canonical").flatMap(boundary ->
                Stream.of("create", "edit").flatMap(operation ->
                        Stream.of(21L, 30L).map(menuId -> Arguments.of(boundary, operation, menuId))));
    }

    @ParameterizedTest @MethodSource("writeEntrances")
    void administratorRetainsTheAllKnownMenusBypass(String boundary, String operation) throws Exception
    {
        actor(1L, Set.of("*:*:*"));

        expectSuccess(write(boundary, operation, 10L, 21L, 30L), boundary, operation);

        assertEquals(List.of(10L, 21L, 30L), stored.get("create".equals(operation) ? 40L : 2L));
        verify(selections, never()).grantableMenuIds(anyLong());
        verify(menus, never()).selectMenuList(any(SysMenu.class), anyLong());
    }

    @ParameterizedTest @ValueSource(strings = {"legacy", "canonical"})
    void hiddenGrantCanBeRetainedOrRemovedButCannotBeAddedAgain(String boundary) throws Exception
    {
        expectSuccess(write(boundary, "edit", 10L, 20L), boundary, "edit");
        assertEquals(List.of(10L, 20L), stored.get(2L), "Linked selection must not expand a hidden parent's descendants");
        expectSuccess(write(boundary, "edit", 10L), boundary, "edit");
        assertEquals(List.of(10L), stored.get(2L));
        expectFailure(write(boundary, "edit", 10L, 20L), boundary, 403);
        assertEquals(List.of(10L), stored.get(2L));
        verify(roles, times(2)).updateRole(any());
        verify(sessions, times(2)).refresh(Set.of(12L, 13L));
    }

    @ParameterizedTest @ValueSource(longs = {1, 2, 999})
    void createCannotBorrowAnExistingRoleGrantUsingTheRequestIdentity(long borrowedId) throws Exception
    {
        stored.put(borrowedId, List.of(20L));
        legacy("create", Long.toString(borrowedId), "[20]").andExpect(jsonPath("$.code").value(403));
        verify(selections, never()).menuIds(anyLong());
        verify(roles, never()).selectRoleById(anyLong());
        noWrites(); verifyNoInteractions(sessions);
    }

    @Test void createDiscardsProtectedClientIdentityAndKeepsDatabaseGeneratedIdentity() throws Exception
    {
        legacy("create", "1", "[10]").andExpect(jsonPath("$.code").value(200));
        assertEquals(1, insertIdentities.size()); assertNull(insertIdentities.get(0));
        assertTrue(stored.containsKey(40L)); assertFalse(stored.containsKey(1L));
    }

    @ParameterizedTest @MethodSource("invalidMenuTargets")
    void invalidOrMissingMenuSetsNeverReachTheWrite(String operation, String ids) throws Exception
    {
        legacy(operation, "2", ids).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(400));
        noWrites(); verifyNoInteractions(sessions);
        assertTrue(transactions.events.contains("rollback"));
    }

    static Stream<Arguments> invalidMenuTargets()
    {
        String oversized = IntStream.rangeClosed(1, 2001).mapToObj(Integer::toString)
                .collect(java.util.stream.Collectors.joining(",", "[", "]"));
        return Stream.of("create", "edit").flatMap(operation ->
                Stream.of("missing", "null", "[null]", "[0]", "[-1]", "[10,10]", oversized)
                        .map(ids -> Arguments.of(operation, ids)));
    }

    @ParameterizedTest @ValueSource(strings = {"create", "edit"})
    void nonexistentMenuCannotBeRetainedEvenIfAnOldLinkReferencesIt(String operation) throws Exception
    {
        stored.put(2L, List.of(10L, 999L));
        legacy(operation, "2", "[10,999]").andExpect(jsonPath("$.code").value(404));
        noWrites(); verifyNoInteractions(sessions);
    }

    @Test void editChecksProtectedMissingAndOutOfScopeRoleBeforeReadingPriorGrants() throws Exception
    {
        legacy("edit", "1", "[10,20]").andExpect(jsonPath("$.code").value(409));
        doReturn(null).when(roles).selectRoleById(999L);
        legacy("edit", "999", "[10,20]").andExpect(jsonPath("$.code").value(404));
        SysRole deleted = row(3L); deleted.setDelFlag("2"); doReturn(deleted).when(roles).selectRoleById(3L);
        legacy("edit", "3", "[10,20]").andExpect(jsonPath("$.code").value(404));
        doThrow(new ServiceException("private scope detail")).when(roles).checkRoleDataScope(4L);
        legacy("edit", "4", "[10,20]").andExpect(jsonPath("$.code").value(403));
        legacy("edit", "null", "[10]").andExpect(jsonPath("$.code").value(400));
        legacy("edit", "0", "[10]").andExpect(jsonPath("$.code").value(400));
        verifyNoInteractions(menus, selections, sessions); noWrites();
    }

    @Test void explicitEmptyMenuSetRevokesAllGrants() throws Exception
    {
        legacy("edit", "2", "[]").andExpect(jsonPath("$.code").value(200));
        assertTrue(stored.get(2L).isEmpty()); verify(sessions).refresh(Set.of(12L, 13L));
    }

    @ParameterizedTest @ValueSource(strings = {"create", "edit"})
    void persistenceFailureRollsBackAndDoesNotRefreshSessions(String operation) throws Exception
    {
        var failure = new DataAccessResourceFailureException("private database details");
        if ("create".equals(operation)) doThrow(failure).when(roles).insertRole(any());
        else doThrow(failure).when(roles).updateRole(any());
        legacy(operation, "2", "[10]").andExpect(jsonPath("$.code").value(500));
        assertTrue(transactions.events.contains("rollback"));
        assertFalse(transactions.events.contains("commit")); verifyNoInteractions(sessions);
    }

    @Test void aPostCommitRefreshFailureDoesNotPretendTheRoleWriteRolledBack() throws Exception
    {
        doAnswer(call -> {transactions.events.add("refresh"); throw new IllegalStateException("cache unavailable");})
                .when(sessions).refresh(anySet());
        legacy("edit", "2", "[10]").andExpect(jsonPath("$.code").value(500));
        assertEquals(List.of(10L), stored.get(2L));
        assertBefore("commit", "refresh"); assertFalse(transactions.events.contains("rollback"));
    }

    private ResultActions legacy(String operation, String roleId, String ids) throws Exception
    {
        String body = "{\"roleId\":" + roleId + ",\"roleName\":\"Role\",\"roleKey\":\"role_key\",\"roleSort\":1,\"status\":\"0\",\"menuCheckStrictly\":true"
                + ("missing".equals(ids) ? "" : ",\"menuIds\":" + ids) + "}";
        return mvc.perform(("create".equals(operation) ? post(LEGACY) : put(LEGACY))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions write(String boundary, String operation, Long... ids) throws Exception
    {
        if ("legacy".equals(boundary)) return legacy(operation, "2", Arrays.toString(ids));
        String keys = Arrays.stream(ids).map(id -> "\"" + KEYS.get(id) + "\"")
                .collect(java.util.stream.Collectors.joining(",", "[", "]"));
        String body = "{\"name\":\"Role\",\"key\":\"role_key\",\"sort\":1,\"status\":\"0\",\"menuLinked\":true,\"menuKeys\":" + keys + "}";
        return mvc.perform(("create".equals(operation) ? post(CANONICAL) : put(CANONICAL + "/2"))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static void expectFailure(ResultActions result, String boundary, int code) throws Exception
    {
        if ("legacy".equals(boundary)) result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(code));
        else result.andExpect(status().is(code));
    }

    private static void expectSuccess(ResultActions result, String boundary, String operation) throws Exception
    {
        if ("legacy".equals(boundary)) result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        else result.andExpect("create".equals(operation) ? status().isCreated() : status().isNoContent());
    }

    private void noWrites()
    {
        verify(roles, never()).insertRole(any()); verify(roles, never()).updateRole(any());
    }

    private void assertBefore(String first, String second)
    {
        assertTrue(transactions.events.contains(first) && transactions.events.contains(second)
                && transactions.events.indexOf(first) < transactions.events.indexOf(second), transactions.events.toString());
    }

    /** Spring owns synchronization/afterCommit; these hooks record the persistence boundary. */
    static class RecordingTransactions extends AbstractPlatformTransactionManager
    {
        final List<String> events = new ArrayList<>();
        @Override protected Object doGetTransaction() { return new Object(); }
        @Override protected void doBegin(Object transaction, TransactionDefinition definition) { events.add("begin"); }
        @Override protected void doCommit(DefaultTransactionStatus status) { events.add("commit"); }
        @Override protected void doRollback(DefaultTransactionStatus status) { events.add("rollback"); }
    }

    @TestConfiguration
    @EnableTransactionManagement
    static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
        @Bean RecordingTransactions transactionManager() { return new RecordingTransactions(); }
    }
}
