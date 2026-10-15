package io.eforge.enterprise.web.controller.system;

import java.util.*;
import java.util.stream.Stream;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.framework.config.SecurityConfig;
import io.eforge.enterprise.framework.security.filter.JwtAuthenticationTokenFilter;
import io.eforge.enterprise.framework.security.handle.*;
import io.eforge.enterprise.framework.web.exception.*;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.domain.NavigationMenu;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import io.eforge.enterprise.web.controller.api.v1.system.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual controllers/security/orchestration; native probes verify the resulting SQL and relations. */
@WebMvcTest
@ContextConfiguration(classes = {SysRoleController.class, RoleController.class, RoleService.class,
        PermissionService.class, GlobalExceptionHandler.class, ApiExceptionHandler.class,
        ApiRoutingExceptionResolver.class, SpringUtils.class, SecurityConfig.class,
        ApiSecurityProblemHandler.class, AuthenticationEntryPointImpl.class, JwtAuthenticationTokenFilter.class,
        LegacyRoleMenuSecurityTest.Configuration.class})
class LegacyRoleOperationBoundaryTest
{
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired LegacyRoleMenuSecurityTest.RecordingTransactions transactions;
    @MockitoBean ISysRoleService roles;
    @MockitoBean ISysMenuService menus;
    @MockitoBean ISysDeptService departments;
    @MockitoBean ISysUserService users;
    @MockitoBean RoleSelectionMapper selections;
    @MockitoBean DepartmentMutationMapper mutations;
    @MockitoBean RoleSessionRefresher sessions;
    @MockitoBean TokenService tokens;
    @MockitoBean LogoutSuccessHandlerImpl logout;
    private final List<SysRole> written = new ArrayList<>();

    @BeforeEach void setup()
    {
        written.clear(); transactions.events.clear(); actor(Set.of("system:role:add", "system:role:edit"));
        when(mutations.lockRoot()).thenAnswer(call -> { active(); transactions.events.add("lock"); return 100L; });
        when(roles.selectRoleById(2L)).thenAnswer(call -> { active(); return existing(); });
        when(roles.checkRoleNameUnique(any())).thenReturn(true); when(roles.checkRoleKeyUnique(any())).thenReturn(true);
        when(selections.menus()).thenReturn(List.of(new NavigationMenu(10L, 0L, "available", null, "Available", 1, "F", "0", "0", "allowed:action", "1", "", "")));
        when(selections.grantableMenuIds(9L)).thenReturn(List.of(10L)); when(selections.menuIds(2L)).thenReturn(List.of(10L));
        when(selections.userIds(2L)).thenReturn(List.of(12L));
        doThrow(new ServiceException("没有权限访问部门数据！")).when(departments).checkDeptDataScope(400L);
        when(departments.selectDeptList(any())).thenAnswer(call -> {
            active(); SysDept filter=call.getArgument(0);
            if (!Long.valueOf(210L).equals(filter.getDeptId())) return List.of();
            SysDept row=new SysDept();row.setDeptId(210L);return List.of(row);
        });
        when(roles.insertRole(any())).thenAnswer(call -> { record(call.getArgument(0)); written.get(0).setRoleId(40L); return 1; });
        when(roles.updateRole(any())).thenAnswer(call -> { record(call.getArgument(0)); return 1; });
        when(roles.updateRoleStatus(any())).thenAnswer(call -> { record(call.getArgument(0)); return 1; });
        when(roles.authDataScope(any())).thenAnswer(call -> { record(call.getArgument(0)); return 1; });
        doCallRealMethod().when(sessions).refreshAfterCommit(anySet());
        doAnswer(call -> { transactions.events.add("refresh"); return null; }).when(sessions).refresh(anySet());
    }

    private void record(SysRole value) { active(); transactions.events.add("write"); written.add(value); }
    private static void active() { assertTrue(TransactionSynchronizationManager.isActualTransactionActive()); }
    private void actor(Set<String> permissions)
    {
        SysUser user=new SysUser(9L);user.setUserName("operator");
        when(tokens.getLoginUser(any())).thenReturn(new LoginUser(9L, 210L, user, permissions));
    }
    private static SysRole existing()
    {
        SysRole row=new SysRole(2L);row.setRoleName("Existing");row.setRoleKey("existing");row.setRoleSort(3);
        row.setDataScope("2");row.setMenuCheckStrictly(true);row.setDeptCheckStrictly(true);row.setStatus("0");row.setDelFlag("0");return row;
    }
    private Map<String,Object> hostile()
    {
        var input=new LinkedHashMap<String,Object>();input.put("roleId",2);input.put("roleName","Changed");input.put("roleKey","changed");
        input.put("roleSort",9);input.put("status","1");input.put("remark","Changed remark");input.put("dataScope","1");
        input.put("menuIds",List.of(10));input.put("deptIds",List.of(400,999999));input.put("menuCheckStrictly",false);input.put("deptCheckStrictly",false);
        input.put("createBy","forged-create");input.put("updateBy","forged-update");input.put("delFlag","2");return input;
    }

    @Test void editPreservesStoredScopeAndDepartmentFlagsDespiteExtraDtoFields() throws Exception
    {
        legacy("",hostile()).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        SysRole patch=onlyWrite();assertEquals("2",patch.getDataScope());assertTrue(patch.isDeptCheckStrictly());assertNull(patch.getDeptIds());
        assertEquals("Changed",patch.getRoleName());assertEquals("changed",patch.getRoleKey());assertArrayEquals(new Long[]{10L},patch.getMenuIds());
        assertFalse(patch.isMenuCheckStrictly());assertEquals("operator",patch.getUpdateBy());assertNull(patch.getCreateBy());assertNull(patch.getDelFlag());
        assertCommittedRefresh();
    }

    @Test void createUsesCanonicalDefaultScopeAndCannotBorrowAnotherRolesDepartmentSelection() throws Exception
    {
        var input=hostile();input.put("dataScope","2");
        mvc.perform(post("/system/role").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        SysRole patch=onlyWrite();assertEquals("1",patch.getDataScope());assertTrue(patch.isDeptCheckStrictly());assertNull(patch.getDeptIds());
        assertEquals("operator",patch.getCreateBy());assertNull(patch.getUpdateBy());assertNull(patch.getDelFlag());verifyNoInteractions(sessions);
    }

    @Test void statusOnlyUpdatesStatusAndTrustedAuditPreservingBothPrimitiveFlags() throws Exception
    {
        legacy("/changeStatus",hostile()).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        SysRole patch=onlyWrite();assertEquals(2L,patch.getRoleId());assertEquals("1",patch.getStatus());assertEquals("operator",patch.getUpdateBy());
        assertNull(patch.getRoleName());assertNull(patch.getRoleKey());assertNull(patch.getRoleSort());assertNull(patch.getDataScope());
        assertNull(patch.getRemark());assertNull(patch.getDeptIds());assertNull(patch.getMenuIds());assertNull(patch.getCreateBy());assertNull(patch.getDelFlag());
        assertTrue(patch.isMenuCheckStrictly());assertTrue(patch.isDeptCheckStrictly());assertCommittedRefresh();
    }

    @Test void dataScopeOnlyWritesValidatedScopeAndDepartmentsWithTrustedAudit() throws Exception
    {
        var input=hostile();input.put("dataScope","2");input.put("deptIds",List.of(210));
        legacy("/dataScope",input).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        SysRole patch=onlyWrite();assertEquals("2",patch.getDataScope());assertArrayEquals(new Long[]{210L},patch.getDeptIds());
        assertFalse(patch.isDeptCheckStrictly());assertTrue(patch.isMenuCheckStrictly());assertEquals("operator",patch.getUpdateBy());
        assertNull(patch.getRoleName());assertNull(patch.getRoleKey());assertNull(patch.getRoleSort());assertNull(patch.getStatus());
        assertNull(patch.getRemark());assertNull(patch.getMenuIds());assertNull(patch.getCreateBy());assertNull(patch.getDelFlag());assertCommittedRefresh();
    }

    static Stream<Arguments> invalidScopes()
    {
        return Stream.of("legacy","canonical").flatMap(boundary -> Stream.of(
                Arguments.of(boundary,"2",List.of(210L,400L),403),
                Arguments.of(boundary,"2",List.of(210L,999999L),404),
                Arguments.of(boundary,"1",List.of(210L),400),
                Arguments.of(boundary,"6",List.of(),400),
                Arguments.of(boundary,"2",List.of(210L,210L),400),
                Arguments.of(boundary,"2",List.of(0L),400),
                Arguments.of(boundary,"2",null,400),
                Arguments.of(boundary,null,List.of(),400)));
    }
    @ParameterizedTest @MethodSource("invalidScopes")
    void bothBoundariesValidateEntireScopeBeforeAnyWrite(String boundary,String mode,List<Long> ids,int code) throws Exception
    {
        ResultActions result=scope(boundary,mode,ids);
        if (boundary.equals("legacy")) result.andExpect(status().isOk()).andExpect(jsonPath("$.code").value(code));
        else result.andExpect(status().is(code));
        noWrites();verifyNoInteractions(sessions);
    }

    @ParameterizedTest @ValueSource(strings={"1","2","3","4","5"})
    void validLegacyModesRetainCanonicalPolicyIncludingAllData(String mode) throws Exception
    {
        scope("legacy",mode,mode.equals("2")?List.of(210L):List.of()).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        SysRole patch=onlyWrite();assertEquals(mode,patch.getDataScope());assertCommittedRefresh();
    }

    @ParameterizedTest @ValueSource(strings={"/dataScope","/changeStatus"})
    void scopedMutableRoleMustExistBeforeNarrowWrites(String path) throws Exception
    {
        var input=hostile();input.put("roleId",999999);input.put("dataScope","2");input.put("deptIds",List.of(210));
        legacy(path,input).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(404));noWrites();verifyNoInteractions(sessions);
    }

    @ParameterizedTest @ValueSource(strings={"", "/dataScope", "/changeStatus"})
    void permissionDenialPrecedesLockAndAllScopeReads(String path) throws Exception
    {
        actor(Set.of());legacy(path,hostile()).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(403));
        verifyNoInteractions(mutations,selections,departments,sessions);noWrites();
    }

    @ParameterizedTest @ValueSource(strings={"", "2", "disabled"})
    void legacyStatusCannotPersistUnknownValues(String value) throws Exception
    {
        var input=hostile();input.put("status",value);
        legacy("/changeStatus",input).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(400));noWrites();
    }

    private ResultActions legacy(String path,Map<String,Object> input) throws Exception
    { return mvc.perform(put("/system/role"+path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))); }
    private ResultActions scope(String boundary,String mode,List<Long> ids) throws Exception
    {
        var input=new LinkedHashMap<String,Object>();
        if (boundary.equals("legacy")) {
            input.put("roleId",2);input.put("dataScope",mode);input.put("deptIds",ids);input.put("deptCheckStrictly",true);
            return legacy("/dataScope",input);
        }
        input.put("mode",mode);input.put("departmentLinked",true);input.put("departmentIds",ids==null?null:ids.stream().map(Object::toString).toList());
        return mvc.perform(put("/api/v1/system/roles/2/data-scope").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)));
    }
    private SysRole onlyWrite() { assertEquals(1,written.size());assertTrue(transactions.events.indexOf("lock")<transactions.events.indexOf("write"));return written.get(0); }
    private void assertCommittedRefresh()
    {
        verify(sessions).refresh(Set.of(12L));
        assertTrue(transactions.events.indexOf("write")<transactions.events.indexOf("commit"));
        assertTrue(transactions.events.indexOf("commit")<transactions.events.indexOf("refresh"));
    }
    private void noWrites()
    {
        assertTrue(written.isEmpty());verify(roles,never()).insertRole(any());verify(roles,never()).updateRole(any());
        verify(roles,never()).authDataScope(any());verify(roles,never()).updateRoleStatus(any());
    }
}
