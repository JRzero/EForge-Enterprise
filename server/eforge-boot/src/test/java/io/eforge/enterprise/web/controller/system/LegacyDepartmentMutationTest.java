package io.eforge.enterprise.web.controller.system;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.exception.GlobalExceptionHandler;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.SysDeptMapper;
import io.eforge.enterprise.system.mapper.SysRoleMapper;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.impl.SysDeptServiceImpl;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real Spring transaction proxies and JDBC commit/rollback; SQL row behavior has a native MySQL probe. */
class LegacyDepartmentMutationTest
{
    private static final String BODY = "{\"deptId\":110,\"parentId\":200,\"deptName\":\"Team\",\"orderNum\":1,\"status\":\"0\"}";
    private AnnotationConfigApplicationContext context;
    private MockMvc mvc;
    private SysDeptMapper mapper;
    private DepartmentMutationMapper mutex;
    private Connection connection;
    private ISysDeptService service;
    private final List<String> events = new ArrayList<>();
    private final List<Boolean> transactions = new ArrayList<>();

    @BeforeEach void setup()
    {
        context = new AnnotationConfigApplicationContext(Config.class);
        mapper = context.getBean(SysDeptMapper.class);
        mutex = context.getBean(DepartmentMutationMapper.class);
        connection = context.getBean(Connection.class);
        service = context.getBean(ISysDeptService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(SysDeptController.class))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        SysUser user = new SysUser(1L); user.setUserName("admin");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new LoginUser(1L, 100L, user, Set.of("*:*:*")), null, List.of()));
        when(mutex.lockRoot()).thenAnswer(call -> observed("lock", 100L));
        when(mapper.checkDeptNameUnique(anyString(), anyLong())).thenAnswer(call -> observed("unique", null));
        when(mapper.selectDeptById(anyLong())).thenAnswer(call -> {
            long id = call.getArgument(0);
            return observed("read-" + id, id == 110 ? row(110, 100, "0,100") : row(200, 100, "0,100"));
        });
        when(mapper.selectDeptList(any())).thenAnswer(call -> {
            SysDept filter = call.getArgument(0); long id = filter.getDeptId();
            return observed("read-scoped-" + id, List.of(row(id, 100, "0,100")));
        });
        when(mapper.selectChildrenDeptById(110L)).thenAnswer(call -> observed("children", List.of(row(111, 110, "0,100,110"))));
        when(mapper.insertDept(any())).thenAnswer(call -> observed("insert", 1));
        when(mapper.updateDeptChildren(anyList())).thenAnswer(call -> observed("write-children", 1));
        when(mapper.updateDept(any())).thenAnswer(call -> observed("write-node", 1));
        doAnswer(call -> observed("write-parents", null)).when(mapper).updateDeptStatusNormal(any());
        doAnswer(call -> observed("write-sort", null)).when(mapper).updateDeptSort(any());
        when(mapper.hasChildByDeptId(anyLong())).thenAnswer(call -> observed("has-children", 0));
        when(mapper.checkDeptExistUser(anyLong())).thenAnswer(call -> observed("has-users", 0));
        when(mapper.deleteDeptById(anyLong())).thenAnswer(call -> observed("delete", 1));
    }

    @AfterEach void cleanup()
    {
        SecurityContextHolder.clearContext();
        context.close();
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
        assertTrue(TransactionSynchronizationManager.getResourceMap().isEmpty());
    }

    @ParameterizedTest @ValueSource(strings = {"create", "update", "delete", "sort"})
    void everyLegacyWriteLocksBeforeAnyHierarchyReadAndCommitsOneTransaction(String operation) throws Exception
    {
        mvc.perform(request(operation)).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.msg").value("操作成功"));
        assertEquals("lock", events.get(0), "The root mutex must precede all hierarchy validation reads");
        assertTrue(transactions.stream().allMatch(Boolean::booleanValue), "No validation or mapper write may escape the transaction");
        verify(mutex).lockRoot(); verify(connection).commit(); verify(connection, never()).rollback();
        if (operation.equals("update"))
        {
            verify(mapper).updateDeptChildren(argThat(rows -> rows.size() == 1 && "0,100,200,110".equals(rows.get(0).getAncestors())));
            verify(mapper).updateDept(argThat(dept -> "0,100,200".equals(dept.getAncestors()) && "admin".equals(dept.getUpdateBy())));
            verify(mapper).updateDeptStatusNormal(new Long[] {0L, 100L, 200L});
        }
    }

    @ParameterizedTest @ValueSource(strings = {"create", "update", "delete", "sort"})
    void missingRootRejectsBeforeReadsOrWritesAndKeepsLegacyErrorEnvelope(String operation) throws Exception
    {
        doReturn(null).when(mutex).lockRoot();
        mvc.perform(request(operation)).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409)).andExpect(jsonPath("$.msg").value("根部门不存在"));
        verifyNoInteractions(mapper); verify(connection).rollback(); verify(connection, never()).commit();
    }

    @ParameterizedTest @CsvSource({"service,node", "service,parents", "controller,node", "controller,parents"})
    void failureAfterDescendantWriteRollsBackTheWholeUpdate(String entry, String phase) throws Exception
    {
        var failure = new DataAccessResourceFailureException("Owned test failure");
        if (phase.equals("node")) doAnswer(call -> { observed("failure-node", null); throw failure; }).when(mapper).updateDept(any());
        else doAnswer(call -> { observed("failure-parents", null); throw failure; }).when(mapper).updateDeptStatusNormal(any());
        if (entry.equals("service")) assertSame(failure, assertThrows(DataAccessResourceFailureException.class, () -> service.updateDept(patch())));
        else mvc.perform(request("update")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500));
        assertTrue(events.contains("write-children"), "Failure must occur after the first real service write");
        assertTrue(transactions.stream().allMatch(Boolean::booleanValue), "The update must be atomic even without an HTTP caller");
        verify(connection).rollback(); verify(connection, never()).commit();
    }

    @Test void directServiceSuccessPreservesTheOriginalUpdateAlgorithmWithinOneTransaction() throws Exception
    {
        assertEquals(1, service.updateDept(patch()));
        assertEquals(List.of("read-200", "read-110", "children", "write-children", "write-node", "write-parents"), events);
        assertTrue(transactions.stream().allMatch(Boolean::booleanValue));
        verify(connection).commit(); verifyNoInteractions(mutex);
    }

    @Test void serviceJoinsOuterTransactionAndDoesNotPublishPartialCommit() throws Exception
    {
        new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).executeWithoutResult(status -> {
            service.updateDept(patch());
            try { verify(connection, never()).commit(); } catch (Exception e) { throw new AssertionError(e); }
            status.setRollbackOnly();
        });
        verify(connection).rollback(); verify(connection, never()).commit();
    }

    @Test void duplicateNameKeepsLegacyBusinessMessageAndDoesNotWrite() throws Exception
    {
        doAnswer(call -> observed("unique", row(112, 200, "0,100,200"))).when(mapper).checkDeptNameUnique("Team", 200L);
        mvc.perform(request("update")).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.msg").value("修改部门'Team'失败，部门名称已存在"));
        assertEquals(List.of("lock", "read-scoped-110", "read-scoped-200", "unique"), events);
        verify(mapper, never()).updateDept(any()); verify(connection).commit();
    }

    private <T> T observed(String event, T value)
    {
        events.add(event);
        transactions.add(TransactionSynchronizationManager.isActualTransactionActive());
        return value;
    }

    private static MockHttpServletRequestBuilder request(String operation)
    {
        return switch (operation)
        {
            case "create" -> post("/system/dept").contentType(MediaType.APPLICATION_JSON).content(BODY);
            case "update" -> put("/system/dept").contentType(MediaType.APPLICATION_JSON).content(BODY);
            case "delete" -> delete("/system/dept/110");
            case "sort" -> put("/system/dept/updateSort").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"deptIds\":\"110,111\",\"orderNums\":\"1,2\"}");
            default -> throw new IllegalArgumentException(operation);
        };
    }

    private static SysDept patch()
    {
        SysDept dept = row(110, 200, null); dept.setDeptName("Team"); return dept;
    }

    private static SysDept row(long id, long parent, String ancestors)
    {
        SysDept dept = new SysDept(); dept.setDeptId(id); dept.setParentId(parent); dept.setAncestors(ancestors);
        dept.setDeptName("Owned department"); dept.setOrderNum(1); dept.setStatus("0"); dept.setDelFlag("0"); return dept;
    }

    @Configuration(proxyBeanMethods = false) @EnableTransactionManagement
    static class Config
    {
        @Bean Connection connection() throws Exception
        { var connection = mock(Connection.class); when(connection.getAutoCommit()).thenReturn(true); return connection; }
        @Bean DataSource source(Connection connection) throws Exception
        { var source = mock(DataSource.class); when(source.getConnection()).thenReturn(connection); return source; }
        @Bean PlatformTransactionManager manager(DataSource source) { return new DataSourceTransactionManager(source); }
        @Bean SysDeptMapper mapper() { return mock(SysDeptMapper.class); }
        @Bean SysRoleMapper roles() { return mock(SysRoleMapper.class); }
        @Bean DepartmentMutationMapper mutex() { return mock(DepartmentMutationMapper.class); }
        @Bean ISysDeptService service() { return new SysDeptServiceImpl(); }
        @Bean SysDeptController controller() { return new SysDeptController(); }
    }
}
