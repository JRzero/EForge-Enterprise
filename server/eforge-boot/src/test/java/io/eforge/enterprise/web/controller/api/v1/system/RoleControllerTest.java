package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import org.junit.jupiter.api.*;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.config.properties.PermitAllUrlProperties;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.domain.NavigationMenu;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest
@ContextConfiguration(classes={RoleController.class,RoleService.class,PermissionService.class,ApiExceptionHandler.class,ApiRoutingExceptionResolver.class,SpringUtils.class,SecurityConfig.class,ApiSecurityProblemHandler.class,AuthenticationEntryPointImpl.class,JwtAuthenticationTokenFilter.class,RoleControllerTest.Configuration.class})
class RoleControllerTest
{
    static final String PATH="/api/v1/system/roles";
    static final String BODY="{\"name\":\"Role\",\"key\":\"role_key\",\"sort\":1,\"status\":\"0\",\"remark\":\"\",\"menuLinked\":true,\"menuKeys\":[\"system\"]}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysMenuService menus;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysUserService users;
    @MockitoBean RoleSelectionMapper selections;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    @BeforeEach void prepare()
    {
        SysUser admin=new SysUser(1L);admin.setUserName("admin");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(1L,103L,admin,Set.of("*:*:*")));
        when(transactions.getTransaction(any())).thenAnswer(call->new SimpleTransactionStatus());when(mutations.lockRoot()).thenReturn(100L);
        when(roles.selectRoleById(anyLong())).thenAnswer(call->call.<Long>getArgument(0)==999L ? null : row(call.getArgument(0)));
        when(roles.selectRoleList(any())).thenReturn(List.of(row(2)));when(roles.selectRoleAll()).thenReturn(List.of(row(2)));
        when(roles.checkRoleNameUnique(any())).thenReturn(true);when(roles.checkRoleKeyUnique(any())).thenReturn(true);
        when(roles.insertRole(any())).thenAnswer(call->{SysRole role=call.getArgument(0);role.setRoleId(9007199254740993L);return 1;});
        when(roles.updateRole(any())).thenReturn(1);when(roles.updateRoleStatus(any())).thenReturn(1);when(roles.authDataScope(any())).thenReturn(1);
        when(selections.menus()).thenReturn(List.of(new NavigationMenu(1L,0L,"system",null,"System",1,"M","0","0","","1","system","system"),new NavigationMenu(2L,1L,"restricted",null,"Restricted",2,"F","0","0","secret:action","1","","")));
        SysMenu option=new SysMenu();option.setMenuId(1L);when(menus.selectMenuList(any(SysMenu.class),anyLong())).thenReturn(List.of(option));
        when(selections.menuIds(anyLong())).thenReturn(List.of(1L));when(menus.selectMenuListByRoleId(anyLong())).thenReturn(List.of(1L));
        when(selections.userIds(anyLong())).thenReturn(List.of(2L));when(selections.departmentIds(anyLong())).thenReturn(List.of(103L));when(departments.selectDeptListByRoleId(anyLong())).thenReturn(List.of(103L));
        SysDept department=new SysDept();department.setDeptId(103L);department.setParentId(100L);department.setDeptName("Engineering");department.setOrderNum(1);department.setStatus("0");when(departments.selectDeptList(any())).thenReturn(List.of(department));
        when(users.selectUserById(anyLong())).thenAnswer(call->{long id=call.getArgument(0);SysUser user=new SysUser(id);user.setDelFlag("0");user.setUserName("User"+id);user.setStatus("0");user.setPassword("never-return");return user;});
        when(users.selectAllocatedList(any())).thenReturn(List.of());when(users.selectUnallocatedList(any())).thenReturn(List.of());
    }
    static SysRole row(long id) { SysRole role=new SysRole(id);role.setRoleName("Role");role.setRoleKey("role_key");role.setRoleSort(1);role.setStatus("0");role.setDelFlag("0");role.setDataScope("2");role.setMenuCheckStrictly(true);role.setDeptCheckStrictly(true);return role; }
    @Test void safeReadsUseStableMenuKeysAndNeverExposeServiceInternals() throws Exception
    {
        mvc.perform(get(PATH)).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value("2")).andExpect(jsonPath("$.items[0].params").doesNotExist());
        mvc.perform(get(PATH+"/2")).andExpect(status().isOk()).andExpect(jsonPath("$.menuKeys[0]").value("system"));
        mvc.perform(get(PATH+"/menus")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].key").value("system")).andExpect(jsonPath("$[0].component").doesNotExist());
        mvc.perform(get(PATH+"/2/data-scope")).andExpect(status().isOk()).andExpect(jsonPath("$.departmentIds[0]").value("103"));
    }
    @Test void createReturnsExactStringIdentityAndLocationWithSanitizedDefaults() throws Exception
    {
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isCreated()).andExpect(header().string("Location",PATH+"/9007199254740993")).andExpect(jsonPath("$.id").value("9007199254740993"));
        verify(roles).insertRole(argThat(role->"1".equals(role.getDataScope()) && role.getMenuIds()[0].equals(1L) && "admin".equals(role.getCreateBy()) && role.isDeptCheckStrictly()));
    }
    @ParameterizedTest @ValueSource(strings={"page=0","pageSize=101","beginDate=2026-02-30","beginDate=2026-10-04&endDate=2026-01-01"})
    void invalidPagingOrDatesNeverReachList(String query) throws Exception { mvc.perform(get(PATH+"?"+query)).andExpect(status().isBadRequest());verify(roles,never()).selectRoleList(any()); }
    @ParameterizedTest @ValueSource(strings={"{}","null","{\"name\":\"Role\",\"key\":\"role\",\"sort\":-1,\"status\":\"0\",\"menuLinked\":true,\"menuKeys\":[]}"})
    void invalidWritesNeverMutate(String body) throws Exception { mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verify(roles,never()).insertRole(any()); }
    @Test void nonexistentOversizedAdminAndScopeDeniedTargetsReturnSafeFailures() throws Exception
    {
        mvc.perform(get(PATH+"/999")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ROLE_NOT_FOUND"));
        mvc.perform(get(PATH+"/9223372036854775808")).andExpect(status().isBadRequest());
        mvc.perform(put(PATH+"/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"1\"}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ROLE_ADMIN_PROTECTED"));
        doThrow(new ServiceException("private-scope")).when(roles).checkRoleDataScope(2L);
        mvc.perform(get(PATH+"/2")).andExpect(status().isForbidden()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-scope"))));
        mvc.perform(get(PATH+"/2/users")).andExpect(status().isForbidden());mvc.perform(get(PATH+"/2/data-scope")).andExpect(status().isForbidden());
    }
    @Test void updatePreservesScopeAndFlagsAndRefreshesOnlyAfterCommit() throws Exception
    {
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isNoContent());
        verify(roles).updateRole(argThat(role->"2".equals(role.getDataScope()) && role.isDeptCheckStrictly() && "".equals(role.getRemark())));
        var order=inOrder(transactions,sessions);order.verify(transactions).commit(any());order.verify(sessions).refresh(Set.of(2L));
        mvc.perform(put(PATH+"/2/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"1\"}")).andExpect(status().isNoContent());
        verify(roles).updateRoleStatus(argThat(role->role.isMenuCheckStrictly() && role.isDeptCheckStrictly()));
    }
    @Test void menuKeysCannotNewlyGrantUnavailableMenusButRetainExistingAssignments() throws Exception
    {
        String requested=BODY.replace("system","restricted");mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(requested)).andExpect(status().isForbidden());verify(roles,never()).insertRole(any());
        when(selections.menuIds(2L)).thenReturn(List.of(2L));mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(requested)).andExpect(status().isNoContent());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("system","missing"))).andExpect(status().isNotFound());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY.replace("[\"system\"]","[\"system\",\"system\"]"))).andExpect(status().isBadRequest());
    }
    @Test void contactlessDuplicateFailureNeverRefreshesSessionsOrLeaksSql() throws Exception
    {
        when(roles.updateRole(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("private sql"));
        mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ROLE_CONFLICT"));verify(sessions,never()).refresh(any());verify(transactions).rollback(any());
    }
    @Test void scopeMutationChecksEveryDepartmentAndPreservesMenuFlag() throws Exception
    {
        mvc.perform(put(PATH+"/2/data-scope").contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"2\",\"departmentLinked\":false,\"departmentIds\":[\"103\"]}")).andExpect(status().isNoContent());
        verify(roles).authDataScope(argThat(role->role.isMenuCheckStrictly() && !role.isDeptCheckStrictly() && role.getDeptIds()[0].equals(103L)));
        doThrow(new ServiceException("secret")).when(departments).checkDeptDataScope(104L);
        mvc.perform(put(PATH+"/2/data-scope").contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"2\",\"departmentLinked\":true,\"departmentIds\":[\"103\",\"104\"]}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/2/data-scope").contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"1\",\"departmentLinked\":true,\"departmentIds\":[\"103\"]}")).andExpect(status().isBadRequest());
    }
    @Test void mixedUserScopeAndAdminPrechecksMakeBatchAllOrNothing() throws Exception
    {
        doThrow(new ServiceException("private")).when(users).checkUserDataScope(3L);
        mvc.perform(put(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\",\"3\"]}")).andExpect(status().isForbidden());
        mvc.perform(delete(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\",\"3\"]}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"1\"]}")).andExpect(status().isConflict());verify(roles,never()).insertAuthUsers(anyLong(),any());verify(roles,never()).deleteAuthUsers(anyLong(),any());
    }
    @Test void userAssignmentsAreIdempotentAndDisabledRolesCannotReceiveNewUsers() throws Exception
    {
        mvc.perform(put(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\"]}")).andExpect(status().isNoContent());verify(roles,never()).insertAuthUsers(anyLong(),any());
        SysRole disabled=row(2);disabled.setStatus("1");when(roles.selectRoleById(2L)).thenReturn(disabled);
        mvc.perform(put(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"3\"]}")).andExpect(status().isConflict());
        mvc.perform(delete(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\"]}")).andExpect(status().isNoContent());verify(roles).deleteAuthUsers(eq(2L),aryEq(new Long[]{2L}));
    }
    @Test void deletionPrechecksAllRolesAndAssignedMembers() throws Exception
    {
        when(roles.countUserRoleByRoleId(3L)).thenReturn(1);
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\",\"3\"]}")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ROLE_IN_USE"));verify(roles,never()).deleteRoleByIds(any());
        mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\",\"2\"]}")).andExpect(status().isBadRequest());
    }
    @Test void allOperationPermissionsAreEnforced() throws Exception
    {
        SysUser user=new SysUser(2L);when(tokens.getLoginUser(any())).thenReturn(new LoginUser(2L,103L,user,Set.of()));
        for(String path:List.of("","/options","/menus","/departments","/2","/2/data-scope","/2/users")) mvc.perform(get(PATH+path)).andExpect(status().isForbidden());
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());mvc.perform(put(PATH+"/2").contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/2/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"0\"}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/2/data-scope").contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"1\",\"departmentLinked\":true,\"departmentIds\":[]}")).andExpect(status().isForbidden());
        mvc.perform(put(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\"]}")).andExpect(status().isForbidden());
        mvc.perform(delete(PATH+"/2/users").contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\"]}")).andExpect(status().isForbidden());mvc.perform(delete(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[\"2\"]}")).andExpect(status().isForbidden());mvc.perform(post(PATH+"/export")).andExpect(status().isForbidden());
        when(tokens.getLoginUser(any())).thenReturn(null);mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
    }
    @TestConfiguration static class Configuration
    { @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); } @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); } }
}
