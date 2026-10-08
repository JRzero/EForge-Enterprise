package io.eforge.enterprise.web.controller.system;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
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
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.RoleSelectionMapper;
import io.eforge.enterprise.system.service.*;
import io.eforge.enterprise.web.controller.api.v1.system.RoleController;
import io.eforge.enterprise.web.controller.api.v1.system.RoleService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import io.eforge.enterprise.web.controller.api.v1.system.UserController;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportService;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportFileReader;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual HTTP binding/security plus the shared role use case, with persistence effects observed. */
@WebMvcTest
@ContextConfiguration(classes = {SysUserController.class, SysRoleController.class, SysProfileController.class,
        UserController.class, RoleController.class, RoleService.class, PermissionService.class,
        GlobalExceptionHandler.class, ApiExceptionHandler.class, ApiRoutingExceptionResolver.class,
        SpringUtils.class, SecurityConfig.class, ApiSecurityProblemHandler.class,
        AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class, LegacyIdentitySecurityTest.Configuration.class})
class LegacyIdentitySecurityTest
{
    private static final String LEGACY_USER = "{\"userId\":2,\"userName\":\"member\",\"nickName\":\"Member\",\"deptId\":103,\"sex\":\"2\",\"status\":\"0\",\"roleIds\":[],\"postIds\":[]}";
    private static final String CANONICAL_USER = "{\"username\":\"member\",\"displayName\":\"Member\",\"departmentId\":\"103\",\"sex\":\"2\",\"status\":\"0\",\"roleIds\":[],\"postIds\":[]}";
    @Autowired MockMvc mvc;
    @MockitoBean ISysUserService users;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysPostService posts;
    @MockitoBean ISysMenuService menus;
    @MockitoBean ISysConfigService configuration;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean RoleSelectionMapper selections;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean UserImportService userImporter;
    @MockitoBean UserImportFileReader importFiles;
    @MockitoBean PlatformTransactionManager transactions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;

    @BeforeEach void prepare()
    {
        actor(Set.of("*:*:*"));
        when(transactions.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(100L);
        when(users.selectUserById(anyLong())).thenAnswer(call -> user(call.getArgument(0)));
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.checkPhoneUnique(any())).thenReturn(true);
        when(users.checkEmailUnique(any())).thenReturn(true);
        when(users.updateUser(any())).thenReturn(1);
        when(users.updateUserStatus(any())).thenReturn(1);
        when(users.deleteUserByIds(any())).thenReturn(1);
        when(users.resetPwd(any())).thenReturn(1);
        when(users.resetUserPwd(anyLong(), anyString())).thenReturn(1);
        when(roles.selectRoleById(anyLong())).thenAnswer(call -> role(call.getArgument(0)));
        when(roles.selectRoleListByUserId(anyLong())).thenReturn(List.of(2L));
        when(roles.checkRoleNameUnique(any())).thenReturn(true);
        when(roles.checkRoleKeyUnique(any())).thenReturn(true);
        when(roles.updateRole(any())).thenReturn(1);
        when(roles.authDataScope(any())).thenReturn(1);
        when(roles.updateRoleStatus(any())).thenReturn(1);
        when(roles.deleteRoleByIds(any())).thenReturn(1);
        when(posts.selectPostListByUserId(anyLong())).thenReturn(List.of());
        when(selections.userIds(anyLong())).thenReturn(List.of(2L));
        SysDept department = new SysDept(); department.setDeptId(103L); department.setStatus("0");
        when(departments.selectDeptList(any())).thenReturn(List.of(department));
    }

    private void actor(Set<String> permissions)
    {
        SysUser actor = user(9L); actor.setUserName("operator");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(9L, 103L, actor, permissions));
    }

    private static SysUser user(long id)
    {
        SysUser user = new SysUser(id); user.setUserName("member"); user.setNickName("Member");
        user.setDeptId(103L); user.setStatus("0"); user.setDelFlag("0");
        return user;
    }

    private static SysRole role(long id)
    {
        SysRole role = new SysRole(id); role.setRoleName("Role"); role.setRoleKey("role_key");
        role.setRoleSort(1); role.setStatus("0"); role.setDelFlag("0"); role.setDataScope("1");
        return role;
    }

    @Test void editPermissionCannotWritePasswordThroughEitherEditor() throws Exception
    {
        actor(Set.of("system:user:edit"));
        String credential = ",\"password\":\"" + SecurityUtils.encryptPassword("Injected123") + "\"}";
        mvc.perform(put("/system/user").contentType(MediaType.APPLICATION_JSON)
                .content(LEGACY_USER.substring(0, LEGACY_USER.length() - 1) + credential))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        mvc.perform(put("/api/v1/system/users/2").contentType(MediaType.APPLICATION_JSON)
                .content(CANONICAL_USER.substring(0, CANONICAL_USER.length() - 1) + credential))
                .andExpect(status().isOk());
        verify(users, times(2)).updateUser(argThat(patch -> patch.getPassword() == null));
        verify(users, never()).resetPwd(any());
        verify(users, never()).resetUserPwd(anyLong(), anyString());
    }

    @Test void editPermissionDoesNotAuthorizeDedicatedResetEndpoints() throws Exception
    {
        actor(Set.of("system:user:edit"));
        mvc.perform(put("/system/user/resetPwd").contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":2,\"password\":\"Changed123\"}"))
                .andExpect(jsonPath("$.code").value(403));
        mvc.perform(put("/api/v1/system/users/2/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Changed123\"}"))
                .andExpect(status().isForbidden());
        verify(users, never()).resetPwd(any());
    }

    @Test void explicitlyAuthorizedPasswordEndpointsStillHashAndUseCredentialService() throws Exception
    {
        actor(Set.of("system:user:resetPwd"));
        mvc.perform(put("/system/user/resetPwd").contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":2,\"password\":\"Changed123\"}"))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(put("/api/v1/system/users/2/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Changed123\"}"))
                .andExpect(status().isNoContent());
        verify(users, times(2)).resetPwd(argThat(patch -> SecurityUtils.matchesPassword("Changed123", patch.getPassword())));
        verify(users, never()).updateUser(any());
    }

    @Test void selfServicePasswordChangeStillUsesFreshDatabaseCredentialAndDedicatedWrite() throws Exception
    {
        actor(Set.of());
        SysUser fresh = user(9L); fresh.setPassword(SecurityUtils.encryptPassword("Previous123"));
        when(users.selectUserById(9L)).thenReturn(fresh);
        mvc.perform(put("/system/user/profile/updatePwd").contentType(MediaType.APPLICATION_JSON)
                .content("{\"oldPassword\":\"Previous123\",\"newPassword\":\"Changed123\"}"))
                .andExpect(jsonPath("$.code").value(200));
        verify(users).resetUserPwd(eq(9L), argThat(hash -> SecurityUtils.matchesPassword("Changed123", hash)));
        verify(users, never()).updateUserProfile(any());
    }

    @ParameterizedTest @ValueSource(strings = {"cancel", "cancelAll", "selectAll"})
    void everyLegacyRoleAllocationChecksRoleScope(String operation) throws Exception
    {
        actor(Set.of("system:role:edit"));
        doThrow(new ServiceException("outside role scope")).when(roles).checkRoleDataScope(4L);
        mvc.perform(allocation(operation, "4", "2")).andExpect(jsonPath("$.code").value(403));
        noRoleWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"cancel", "cancelAll", "selectAll"})
    void everyLegacyRoleAllocationChecksUserScope(String operation) throws Exception
    {
        actor(Set.of("system:role:edit"));
        doThrow(new ServiceException("outside user scope")).when(users).checkUserDataScope(3L);
        mvc.perform(allocation(operation, "2", "3")).andExpect(jsonPath("$.code").value(403));
        noRoleWrites();
    }

    @ParameterizedTest @ValueSource(strings = {"cancel", "cancelAll", "selectAll"})
    void everyLegacyRoleAllocationProtectsAdministratorObjects(String operation) throws Exception
    {
        mvc.perform(allocation(operation, "1", "2")).andExpect(jsonPath("$.code").value(409));
        mvc.perform(allocation(operation, "2", "1")).andExpect(jsonPath("$.code").value(409));
        noRoleWrites();
    }

    @Test void mixedScopeBatchesMakeNoChangesOnLegacyAndCanonicalRoutes() throws Exception
    {
        doThrow(new ServiceException("outside user scope")).when(users).checkUserDataScope(3L);
        for (String operation : List.of("cancelAll", "selectAll"))
            mvc.perform(allocation(operation, "2", "2,3")).andExpect(jsonPath("$.code").value(403));
        for (var request : List.of(put("/api/v1/system/roles/2/users"), delete("/api/v1/system/roles/2/users")))
            mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[\"2\",\"3\"]}"))
                    .andExpect(status().isForbidden());
        noRoleWrites();
        verify(transactions, times(4)).rollback(any());
        verifyNoInteractions(sessions);
    }

    @Test void allocationRequiresOperationPermissionBeforeAnyObjectRead() throws Exception
    {
        actor(Set.of());
        for (String operation : List.of("cancel", "cancelAll", "selectAll"))
            mvc.perform(allocation(operation, "2", "2")).andExpect(jsonPath("$.code").value(403));
        mvc.perform(put("/system/user/authRole").param("userId", "2").param("roleIds", "2"))
                .andExpect(jsonPath("$.code").value(403));
        verifyNoInteractions(users, roles, selections, mutations, sessions);
    }

    @Test void malformedAndDuplicateAllocationTargetsNeverMutate() throws Exception
    {
        mvc.perform(put("/system/role/authUser/selectAll").param("roleId", "2"))
                .andExpect(jsonPath("$.code").value(400));
        mvc.perform(allocation("cancel", "2", "0")).andExpect(jsonPath("$.code").value(400));
        mvc.perform(allocation("selectAll", "2", "2,2")).andExpect(jsonPath("$.code").value(400));
        noRoleWrites();
    }

    @Test void validLegacyAllocationUsesSharedTransactionAndPostCommitSessionRefresh() throws Exception
    {
        mvc.perform(allocation("selectAll", "2", "3,4")).andExpect(jsonPath("$.code").value(200));
        verify(roles).insertAuthUsers(eq(2L), aryEq(new Long[] {3L, 4L}));
        var order = inOrder(transactions, sessions);
        order.verify(transactions).commit(any());
        order.verify(sessions).refresh(Set.of(3L, 4L));
        mvc.perform(allocation("cancel", "2", "2")).andExpect(jsonPath("$.code").value(200));
        verify(roles).deleteAuthUsers(eq(2L), aryEq(new Long[] {2L}));
        verify(roles, never()).deleteAuthUser(any());
    }

    @Test void databaseFailureRollsBackAllocationAndNeverRefreshesSessions() throws Exception
    {
        when(roles.insertAuthUsers(anyLong(), any())).thenThrow(new DataAccessResourceFailureException("unavailable"));
        mvc.perform(allocation("selectAll", "2", "3,4")).andExpect(jsonPath("$.code").value(500));
        verify(transactions).rollback(any());
        verifyNoInteractions(sessions);
    }

    @Test void userCentricAllocationRejectsProtectedAndMixedInvalidObjectsBeforeReplacingLinks() throws Exception
    {
        mvc.perform(put("/system/user/authRole").param("userId", "1").param("roleIds", "2"))
                .andExpect(jsonPath("$.code").value(409));
        mvc.perform(put("/system/user/authRole").param("userId", "2").param("roleIds", "2,1"))
                .andExpect(jsonPath("$.code").value(409));
        doThrow(new ServiceException("outside role scope")).when(roles).checkRoleDataScope(2L, 3L);
        mvc.perform(put("/system/user/authRole").param("userId", "2").param("roleIds", "2,3"))
                .andExpect(jsonPath("$.code").value(500));
        verify(users, never()).insertUserAuth(anyLong(), any());
        verifyNoInteractions(sessions);
    }

    @Test void legacyAddAndEditCannotUseRoleFieldsToBypassAdministratorRoleProtection() throws Exception
    {
        String body = LEGACY_USER.replace("\"roleIds\":[]", "\"roleIds\":[1]");
        mvc.perform(post("/system/user").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.code").value(409));
        mvc.perform(put("/system/user").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.code").value(409));
        verify(users, never()).insertUser(any());
        verify(users, never()).updateUser(any());
    }

    @Test void successfulLegacyIdentityMutationsScheduleOnlyAffectedSessions() throws Exception
    {
        mvc.perform(put("/system/user").contentType(MediaType.APPLICATION_JSON).content(LEGACY_USER))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(put("/system/user/changeStatus").contentType(MediaType.APPLICATION_JSON).content("{\"userId\":2,\"status\":\"1\"}"))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(put("/system/user/authRole").param("userId", "2").param("roleIds", "2"))
                .andExpect(jsonPath("$.code").value(200));
        mvc.perform(delete("/system/user/2")).andExpect(jsonPath("$.code").value(200));
        for (String route : List.of("/system/role/changeStatus", "/system/role/dataScope"))
            mvc.perform(put(route).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"roleId\":2,\"status\":\"1\",\"dataScope\":\"3\",\"deptIds\":[]}"))
                    .andExpect(jsonPath("$.code").value(200));
        verify(sessions, times(6)).refreshAfterCommit(Set.of(2L));
    }

    @Test void failedLegacyIdentityWriteNeverSchedulesSessionRefresh() throws Exception
    {
        when(users.updateUser(any())).thenThrow(new DataAccessResourceFailureException("unavailable"));
        mvc.perform(put("/system/user").contentType(MediaType.APPLICATION_JSON).content(LEGACY_USER))
                .andExpect(jsonPath("$.code").value(500));
        verify(transactions).rollback(any());
        verifyNoInteractions(sessions);
    }

    private MockHttpServletRequestBuilder allocation(String operation, String roleId, String userIds)
    {
        var request = put("/system/role/authUser/" + operation);
        if ("cancel".equals(operation))
            return request.contentType(MediaType.APPLICATION_JSON).content("{\"roleId\":" + roleId + ",\"userId\":" + userIds + "}");
        return request.param("roleId", roleId).param("userIds", userIds);
    }

    private void noRoleWrites()
    {
        verify(roles, never()).insertAuthUsers(anyLong(), any());
        verify(roles, never()).deleteAuthUsers(anyLong(), any());
        verify(roles, never()).deleteAuthUser(any());
    }

    @TestConfiguration
    @EnableTransactionManagement
    static class Configuration
    {
        @Bean PermitAllUrlProperties permitAllUrlProperties() { return new PermitAllUrlProperties(); }
        @Bean CorsFilter corsFilter() { return new CorsFilter(new UrlBasedCorsConfigurationSource()); }
    }
}
