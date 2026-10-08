package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class UserImportServiceTest
{
    ISysUserService users; ISysDeptService departments; ISysConfigService configuration;
    SysUserMapper mapper; DepartmentMutationMapper mutations; PlatformTransactionManager transactions;
    RoleSessionRefresher sessions;
    UserImportService importer; ValidatorFactory validators;
    @BeforeEach void prepare()
    {
        users = mock(ISysUserService.class); departments = mock(ISysDeptService.class); configuration = mock(ISysConfigService.class);
        mapper = mock(SysUserMapper.class); mutations = mock(DepartmentMutationMapper.class); transactions = mock(PlatformTransactionManager.class);
        sessions = mock(RoleSessionRefresher.class);
        validators = Validation.buildDefaultValidatorFactory();
        when(transactions.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        importer = new UserImportService(users, departments, configuration, mapper, mutations, validators.getValidator(), transactions, sessions);
        SysUser admin = new SysUser(1L); admin.setUserName("admin");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new LoginUser(1L, 103L, admin, Set.of("*:*:*")), null, List.of()));
        when(mutations.lockRoot()).thenReturn(100L);
        SysDept department = new SysDept(); department.setDeptId(103L); department.setStatus("0");
        when(departments.selectDeptList(any())).thenReturn(List.of(department));
        when(configuration.selectConfigByKey(any())).thenReturn("Import12345");
        when(users.checkUserNameUnique(any())).thenReturn(true); when(users.checkPhoneUnique(any())).thenReturn(true); when(users.checkEmailUnique(any())).thenReturn(true);
        when(mapper.insertUser(any())).thenReturn(1); when(mapper.updateUser(any())).thenReturn(1);
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); validators.close(); }
    private SysUser source(String name)
    { SysUser user = new SysUser(); user.setUserName(name); user.setNickName("Imported"); user.setDeptId(103L); return user; }
    @Test void createsWithDefaultHashedPasswordAndIgnoresServiceOwnedFields()
    {
        SysUser source = source("imported"); source.setUserId(1L); source.setPassword("forged"); source.setRoleIds(new Long[]{1L}); source.setAvatar("forged"); source.getParams().put("dataScope", " OR 1=1");
        var result = importer.importUsers(List.of(source), false);
        assertEquals(1, result.created()); assertEquals(0, result.failed());
        verify(mapper).insertUser(argThat(user -> user.getUserId() == null && user.getRoleIds() == null && user.getAvatar() == null && user.getParams().isEmpty()
                && SecurityUtils.matchesPassword("Import12345", user.getPassword()) && "admin".equals(user.getCreateBy()) && "0".equals(user.getStatus()) && "2".equals(user.getSex())));
        verify(transactions).commit(any());
    }
    @Test void updateRetainsOriginalDepartmentAndNeverReassignsRolesPostsOrPassword()
    {
        SysUser existing = new SysUser(2L); existing.setDeptId(105L);
        when(users.selectUserByUserName("imported")).thenReturn(existing);
        var result = importer.importUsers(List.of(source("imported")), true);
        assertEquals(1, result.updated());
        verify(departments).checkDeptDataScope(103L);
        verify(users).checkUserDataScope(2L);
        verify(mapper).updateUser(argThat(user -> user.getDeptId().equals(105L) && user.getPassword() == null && user.getRoleIds() == null && user.getPostIds() == null && user.getRemark() == null));
        verify(users, never()).updateUser(any());
    }
    @Test void everyRowHasItsOwnTransactionAndPartialResultsAreExplicit()
    {
        SysUser invalid = source("invalid"); invalid.setPhonenumber("bad");
        var result = importer.importUsers(List.of(source("valid"), invalid), false);
        assertEquals(1, result.created()); assertEquals(1, result.failed()); assertEquals(2, result.total());
        assertEquals("VALIDATION_ERROR", result.rows().get(1).code());
        verify(transactions).commit(any()); verify(transactions).rollback(any()); verify(mapper).insertUser(any());
    }
    @Test void collisionReadCannotRevealAnOutOfScopeAccount()
    {
        when(users.selectUserByUserName("outside")).thenReturn(new SysUser(3L));
        doThrow(new ServiceException("private scope details")).when(users).checkUserDataScope(3L);
        var result = importer.importUsers(List.of(source("outside")), false);
        assertEquals("ACCESS_DENIED", result.rows().get(0).code()); verifyNoInteractions(mapper);
    }
    @Test void overwriteRequiresOptInAndCannotModifyAdmin()
    {
        when(users.selectUserByUserName("existing")).thenReturn(new SysUser(2L));
        assertEquals("USER_USERNAME_EXISTS", importer.importUsers(List.of(source("existing")), false).rows().get(0).code());
        when(users.selectUserByUserName("admin")).thenReturn(new SysUser(1L));
        assertEquals("USER_ADMIN_PROTECTED", importer.importUsers(List.of(source("admin")), true).rows().get(0).code());
        verifyNoInteractions(mapper);
    }
    @Test void invalidDefaultPasswordAndDatabaseErrorsNeverReturnRawDetails()
    {
        when(configuration.selectConfigByKey(any())).thenReturn("");
        assertEquals("USER_INITIAL_PASSWORD_INVALID", importer.importUsers(List.of(source("first")), false).rows().get(0).code());
        when(configuration.selectConfigByKey(any())).thenReturn("Import12345");
        when(mapper.insertUser(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("private SQL"));
        assertEquals("USER_CONFLICT", importer.importUsers(List.of(source("second")), false).rows().get(0).code());
    }
    @Test void scriptAndInvalidSexStatusValuesAreRejected()
    {
        SysUser script = source("script"); script.setNickName("<script>");
        SysUser invalid = source("invalid"); invalid.setSex("8"); invalid.setStatus("x");
        var result = importer.importUsers(List.of(script, invalid), false);
        assertEquals(2, result.failed()); verifyNoInteractions(mapper);
    }
}
