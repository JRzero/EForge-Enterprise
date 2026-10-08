package io.eforge.enterprise.web.controller.api.v1.system;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.SysUserMapper;
import io.eforge.enterprise.system.service.ISysConfigService;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real Spring commit/suspension callbacks; the runtime suite separately checks MySQL and Redis. */
class UserImportSessionTest
{
    private ISysUserService users;
    private ISysDeptService departments;
    private ISysConfigService configuration;
    private SysUserMapper mapper;
    private DepartmentMutationMapper mutations;
    private RoleSessionRefresher sessions;
    private DataSourceTransactionManager transactions;
    private ValidatorFactory validators;
    private UserImportService importer;
    private final List<Connection> connections = new ArrayList<>();
    private final Map<Long, String> committedStatuses = new LinkedHashMap<>();
    private final List<String> events = new ArrayList<>();

    @BeforeEach
    void prepare() throws Exception
    {
        users = mock(ISysUserService.class);
        departments = mock(ISysDeptService.class);
        configuration = mock(ISysConfigService.class);
        mapper = mock(SysUserMapper.class);
        mutations = mock(DepartmentMutationMapper.class);
        sessions = mock(RoleSessionRefresher.class);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenAnswer(call -> {
            Connection connection = mock(Connection.class);
            when(connection.getAutoCommit()).thenReturn(true);
            connections.add(connection);
            return connection;
        });
        transactions = new DataSourceTransactionManager(dataSource);
        validators = Validation.buildDefaultValidatorFactory();
        importer = new UserImportService(users, departments, configuration, mapper, mutations,
                validators.getValidator(), transactions, sessions);
        SysUser actor = new SysUser(1L);
        actor.setUserName("admin");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new LoginUser(1L, 103L, actor, Set.of("*:*:*")), null, List.of()));
        when(mutations.lockRoot()).thenReturn(100L);
        SysDept department = new SysDept();
        department.setDeptId(103L);
        department.setStatus("0");
        when(departments.selectDeptList(any())).thenReturn(List.of(department));
        when(users.checkUserNameUnique(any())).thenReturn(true);
        when(users.checkPhoneUnique(any())).thenReturn(true);
        when(users.checkEmailUnique(any())).thenReturn(true);
        when(configuration.selectConfigByKey(any())).thenReturn("Import12345");
        when(mapper.insertUser(any())).thenReturn(1);
        when(mapper.updateUser(any())).thenAnswer(call -> {
            SysUser patch = call.getArgument(0);
            Long userId = patch.getUserId();
            String status = patch.getStatus();
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization()
            {
                @Override public void afterCommit()
                {
                    committedStatuses.put(userId, status);
                    events.add("committed:" + userId);
                }
            });
            return 1;
        });
        doAnswer(call -> {
            Set<Long> affected = call.getArgument(0);
            assertTrue(committedStatuses.keySet().containsAll(affected), "Only committed account updates may be published");
            events.add("refreshed");
            return null;
        }).when(sessions).refresh(anySet());
    }

    @AfterEach
    void cleanup()
    {
        SecurityContextHolder.clearContext();
        validators.close();
    }

    @Test
    void successfulUpdatesRefreshOnceAfterAllRowsEvenWhenAnotherRowFails() throws Exception
    {
        existing("disabled", 2L);
        existing("enabled", 3L);
        SysUser invalid = source("invalid", "0");
        invalid.setPhonenumber("invalid");

        var result = importer.importUsers(List.of(source("disabled", "1"), invalid,
                source("created", "0"), source("enabled", "0")), true);

        assertEquals(1, result.created());
        assertEquals(2, result.updated());
        assertEquals(1, result.failed());
        assertEquals("VALIDATION_ERROR", result.rows().get(1).code());
        assertEquals(Map.of(2L, "1", 3L, "0"), committedStatuses);
        assertEquals(List.of("committed:2", "committed:3", "refreshed"), events);
        verify(sessions).refresh(Set.of(2L, 3L));
        verify(connections.get(0)).commit();
        verify(connections.get(1)).rollback();
        verify(connections.get(2)).commit();
        verify(connections.get(3)).commit();
    }

    @Test
    void deniedAndRolledBackRowsNeverEnterTheAffectedSet() throws Exception
    {
        existing("denied", 2L);
        existing("rolledback", 3L);
        existing("committed", 4L);
        doThrow(new ServiceException("private scope detail")).when(users).checkUserDataScope(2L);
        doThrow(new DataAccessResourceFailureException("private SQL detail")).when(mapper)
                .updateUser(argThat(user -> user.getUserId().equals(3L)));

        var result = importer.importUsers(List.of(source("denied", "1"),
                source("rolledback", "1"), source("committed", "1")), true);

        assertEquals(1, result.updated());
        assertEquals(2, result.failed());
        assertEquals("ACCESS_DENIED", result.rows().get(0).code());
        assertEquals("USER_IMPORT_FAILED", result.rows().get(1).code());
        assertEquals(Map.of(4L, "1"), committedStatuses);
        verify(sessions).refresh(Set.of(4L));
        verify(connections.get(0)).rollback();
        verify(connections.get(1)).rollback();
        verify(connections.get(2)).commit();
    }

    @Test
    void anUpdateThatWritesNoRowIsRolledBackWithoutPublishing() throws Exception
    {
        existing("missing", 2L);
        doReturn(0).when(mapper).updateUser(any());

        var result = importer.importUsers(List.of(source("missing", "1")), true);

        assertEquals(0, result.updated());
        assertEquals("USER_NOT_FOUND", result.rows().get(0).code());
        assertTrue(committedStatuses.isEmpty());
        verify(connections.get(0)).rollback();
        verifyNoInteractions(sessions);
    }

    @Test
    void aRefreshFailureReportsCommittedSqlSeparatelyFromRowFailures() throws Exception
    {
        existing("committed", 2L);
        RuntimeException unavailable = new DataAccessResourceFailureException("private Redis detail");
        doThrow(unavailable).when(sessions).refresh(Set.of(2L));
        SysUser invalid = source("invalid", "0");
        invalid.setSex("invalid");

        ApiFailure failure = assertThrows(ApiFailure.class,
                () -> importer.importUsers(List.of(source("committed", "1"), invalid), true));

        assertEquals(503, failure.status());
        assertEquals("USER_IMPORT_SESSION_REFRESH_FAILED", failure.code());
        assertTrue(failure.getMessage().contains("have been saved"));
        assertTrue(failure.getMessage().contains("not been rolled back"));
        assertFalse(failure.getMessage().contains("private"));
        assertSame(unavailable, failure.getCause());
        assertEquals(Map.of(2L, "1"), committedStatuses);
        verify(connections.get(0)).commit();
        verify(connections.get(0), never()).rollback();
        verify(connections.get(1)).rollback();
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void aLaterNullRowCannotSkipRefreshOfAnAlreadyCommittedUpdate()
    {
        existing("committed", 2L);

        var result = importer.importUsers(Arrays.asList(source("committed", "1"), null), true);

        assertEquals(1, result.updated());
        assertEquals(1, result.failed());
        assertEquals("VALIDATION_ERROR", result.rows().get(1).code());
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void duplicateSuccessfulUpdatesPublishOneUserAfterItsFinalCommittedState()
    {
        existing("repeated", 2L);

        var result = importer.importUsers(List.of(source("repeated", "1"), source("repeated", "0")), true);

        assertEquals(2, result.updated());
        assertEquals(Map.of(2L, "0"), committedStatuses);
        assertEquals(List.of("committed:2", "committed:2", "refreshed"), events);
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void committedRowsAndRefreshAreNotCancelledByAnOuterTransactionRollback() throws Exception
    {
        existing("independent", 2L);

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var result = importer.importUsers(List.of(source("independent", "1")), true);
            assertEquals(1, result.updated());
            assertEquals(List.of("committed:2", "refreshed"), events);
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive());
            status.setRollbackOnly();
        });

        assertEquals(Map.of(2L, "1"), committedStatuses);
        assertEquals(2, connections.size(), "The imported row must use its own transaction connection");
        verify(connections.get(0)).rollback();
        verify(connections.get(0), never()).commit();
        verify(connections.get(1)).commit();
        verify(connections.get(1), never()).rollback();
        verify(sessions).refresh(Set.of(2L));
    }

    @Test
    void newAccountsDoNotCauseAnExistingSessionScan()
    {
        var result = importer.importUsers(List.of(source("newaccount", "0")), false);
        assertEquals(1, result.created());
        assertEquals(0, result.updated());
        verifyNoInteractions(sessions);
    }

    private void existing(String username, Long userId)
    {
        SysUser user = new SysUser(userId);
        user.setDeptId(105L);
        user.setStatus("0");
        when(users.selectUserByUserName(username)).thenReturn(user);
    }

    private static SysUser source(String username, String status)
    {
        SysUser user = new SysUser();
        user.setUserName(username);
        user.setNickName("Imported profile");
        user.setDeptId(103L);
        user.setStatus(status);
        return user;
    }
}
