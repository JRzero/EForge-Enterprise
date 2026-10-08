package io.eforge.enterprise.web.controller.system;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.system.domain.SysUserRole;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.RoleSelectionMapper;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysMenuService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Compatibility binding and real canonical preflight, without changing data-scope SQL. */
class LegacyManagementBoundaryTest
{
    private ISysRoleService roles;
    private ISysUserService users;
    private ISysDeptService departments;
    private RoleSessionRefresher sessions;
    private SysRoleController roleController;

    @BeforeEach
    void setup()
    {
        roles = mock(ISysRoleService.class);
        users = mock(ISysUserService.class);
        departments = mock(ISysDeptService.class);
        sessions = mock(RoleSessionRefresher.class);
        RoleSelectionMapper selections = mock(RoleSelectionMapper.class);
        DepartmentMutationMapper mutations = mock(DepartmentMutationMapper.class);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mutations.lockRoot()).thenReturn(100L);
        SysRole role = new SysRole(2L);
        role.setStatus("0");
        role.setDelFlag("0");
        when(roles.selectRoleById(2L)).thenReturn(role);
        when(selections.userIds(2L)).thenReturn(List.of(10L, 20L));
        for (Long id : List.of(10L, 20L))
        {
            SysUser user = new SysUser(id);
            user.setStatus("0");
            user.setDelFlag("0");
            when(users.selectUserById(id)).thenReturn(user);
        }
        RoleService canonical = new RoleService(roles, mock(ISysMenuService.class), departments,
                users, selections, mutations, sessions, manager);
        roleController = new SysRoleController();
        ReflectionTestUtils.setField(roleController, "roleService", roles);
        ReflectionTestUtils.setField(roleController, "roleAssignments", canonical);
        SysUser actor = new SysUser(30L);
        actor.setUserName("scoped-editor");
        LoginUser login = new LoginUser(30L, 100L, actor, Set.of("system:user:edit", "system:role:edit"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(login, null, List.of()));
    }

    @AfterEach
    void cleanup() { SecurityContextHolder.clearContext(); }

    @Test
    void legacyHttpEditorCopiesOnlyAllowedFieldsEvenWhenPasswordIsSupplied() throws Exception
    {
        SysUserController controller = new SysUserController();
        ReflectionTestUtils.setField(controller, "userService", users);
        ReflectionTestUtils.setField(controller, "roleService", roles);
        ReflectionTestUtils.setField(controller, "deptService", departments);
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.updateUser(any())).thenReturn(1);
        MockMvcBuilders.standaloneSetup(controller).build().perform(put("/system/user")
                .contentType("application/json").content("""
                {"userId":10,"deptId":100,"userName":"target","nickName":"Edited",
                 "password":"precomputed-password-hash","avatar":"/profile/foreign.png",
                 "loginIp":"forged-ip","createBy":"forged-actor","status":"0",
                 "roleIds":[2],"postIds":[3],"params":{"dataScope":"forged"}}
                """)).andExpect(status().isOk());
        ArgumentCaptor<SysUser> capture = ArgumentCaptor.forClass(SysUser.class);
        verify(users).updateUser(capture.capture());
        SysUser patch = capture.getValue();
        assertNull(patch.getPassword());
        assertNull(patch.getAvatar());
        assertNull(patch.getLoginIp());
        assertNull(patch.getCreateBy());
        assertTrue(patch.getParams().isEmpty());
        assertEquals("Edited", patch.getNickName());
        assertEquals("scoped-editor", patch.getUpdateBy());
        assertArrayEquals(new Long[] {2L}, patch.getRoleIds());
        assertArrayEquals(new Long[] {3L}, patch.getPostIds());
        verify(users, never()).resetPwd(any());
    }

    @Test
    void genericMapperCannotWritePasswordButDedicatedResetStillCan() throws Exception
    {
        Configuration configuration = new Configuration();
        configuration.getTypeAliasRegistry().registerAlias("SysUser", SysUser.class);
        configuration.getTypeAliasRegistry().registerAlias("SysDept", SysDept.class);
        configuration.getTypeAliasRegistry().registerAlias("SysRole", SysRole.class);
        String resource = "mapper/system/SysUserMapper.xml";
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resource))
        {
            assertNotNull(input);
            new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
        }
        SysUser input = new SysUser(10L);
        input.setDeptId(100L);
        input.setNickName("Edited");
        input.setPassword("precomputed-password-hash");
        String prefix = "io.eforge.enterprise.system.mapper.SysUserMapper.";
        var generic = configuration.getMappedStatement(prefix + "updateUser").getBoundSql(input);
        assertFalse(generic.getSql().contains("password"));
        assertTrue(generic.getParameterMappings().stream().noneMatch(p -> p.getProperty().equals("password")));
        var reset = configuration.getMappedStatement(prefix + "resetUserPwd")
                .getBoundSql(Map.of("userId", 10L, "password", "new-hash"));
        assertTrue(reset.getSql().contains("password ="));
        assertTrue(reset.getSql().contains("pwd_update_date"));
    }

    @Test
    void singleCancellationChecksTargetUserScopeBeforeWriting()
    {
        doThrow(new ServiceException("Outside scope")).when(users).checkUserDataScope(10L);
        SysUserRole assignment = new SysUserRole();
        assignment.setRoleId(2L);
        assignment.setUserId(10L);
        assertThrows(AccessDeniedException.class, () -> roleController.cancelAuthUser(assignment));
        verify(roles, never()).deleteAuthUser(any());
        verify(roles, never()).deleteAuthUsers(anyLong(), any());
        verifyNoInteractions(sessions);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void mixedScopeBatchFailsBeforeAnyAssignmentChanges(boolean assign)
    {
        doThrow(new ServiceException("Outside scope")).when(users).checkUserDataScope(20L);
        assertThrows(AccessDeniedException.class, () -> change(assign, 2L, new Long[] {10L, 20L}));
        verify(users).checkUserDataScope(10L);
        verify(users).checkUserDataScope(20L);
        verify(roles, never()).insertAuthUsers(anyLong(), any());
        verify(roles, never()).deleteAuthUsers(anyLong(), any());
        verifyNoInteractions(sessions);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void roleScopeAndProtectedAdministratorAreChecked(boolean assign)
    {
        doThrow(new ServiceException("Outside scope")).when(roles).checkRoleDataScope(2L);
        assertThrows(AccessDeniedException.class, () -> change(assign, 2L, new Long[] {10L}));
        verifyNoInteractions(sessions);
        reset(roles);
        SysRole admin = new SysRole(1L);
        admin.setDelFlag("0");
        when(roles.selectRoleById(1L)).thenReturn(admin);
        assertThrows(ApiFailure.class, () -> change(assign, 1L, new Long[] {10L}));
        verify(roles, never()).insertAuthUsers(anyLong(), any());
        verify(roles, never()).deleteAuthUsers(anyLong(), any());
    }

    @Test
    void successfulCancellationUsesCanonicalMutationAndRefreshesSessions()
    {
        assertEquals(200, roleController.cancelAuthUserAll(2L, new Long[] {10L, 20L}).get("code"));
        verify(roles).deleteAuthUsers(eq(2L), aryEq(new Long[] {10L, 20L}));
        verify(sessions).refresh(Set.of(10L, 20L));
    }

    @Test
    void invalidOrDuplicateBatchCannotReachWrites()
    {
        assertThrows(ApiFailure.class, () -> change(true, null, new Long[] {10L}));
        assertThrows(ApiFailure.class, () -> change(true, 2L, null));
        assertThrows(ApiFailure.class, () -> change(true, 2L, new Long[0]));
        assertThrows(ApiFailure.class, () -> change(true, 2L, new Long[] {null}));
        assertThrows(ApiFailure.class, () -> change(true, 2L, new Long[] {0L}));
        assertThrows(ApiFailure.class, () -> change(true, 2L, new Long[] {10L, 10L}));
        assertThrows(ApiFailure.class, () -> change(true, 2L, new Long[101]));
        verify(roles, never()).insertAuthUsers(anyLong(), any());
        verify(roles, never()).deleteAuthUsers(anyLong(), any());
        verifyNoInteractions(sessions);
    }

    private void change(boolean assign, Long roleId, Long[] ids)
    {
        if (assign) roleController.selectAuthUserAll(roleId, ids);
        else roleController.cancelAuthUserAll(roleId, ids);
    }
}
