package io.eforge.enterprise.web.controller.api.v1.system;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.system.service.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Actual Spring propagation/synchronization; JDBC persistence is covered by the native probe. */
class AuthorizationMutationCommitTest
{
    private DataSourceTransactionManager manager;
    private Connection connection;
    private TransactionTemplate outer;
    private RoleService roles;
    private MenuService menus;
    private final List<Set<Long>> published = new ArrayList<>();

    @BeforeEach void setup() throws Exception
    {
        DataSource source = mock(DataSource.class);
        connection = mock(Connection.class);
        when(connection.getAutoCommit()).thenReturn(true);
        when(source.getConnection()).thenReturn(connection);
        manager = new DataSourceTransactionManager(source);
        outer = new TransactionTemplate(manager);
        SysUser admin = new SysUser(1L); admin.setUserName("admin");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new LoginUser(1L,103L,admin,Set.of("*:*:*")),null,List.of()));
        var sessions = new RoleSessionRefresher(null,null,null,null,null,null,manager)
        {
            @Override public void refresh(Set<Long> affected)
            {
                if(affected.isEmpty()) return;
                assertDoesNotThrow(() -> verify(connection).commit(),"JDBC commit must precede session publication");
                published.add(Set.copyOf(affected));
            }
        };
        var mutex = mock(DepartmentMutationMapper.class); when(mutex.lockRoot()).thenReturn(100L);
        var legacyRoles = mock(ISysRoleService.class);
        SysRole role = new SysRole(2L);role.setStatus("0");role.setDelFlag("0");role.setRoleKey("reader");
        when(legacyRoles.selectRoleById(2L)).thenReturn(role);
        when(legacyRoles.updateRoleStatus(any())).thenReturn(1);
        var selections = mock(RoleSelectionMapper.class);when(selections.userIds(2L)).thenReturn(List.of(7L));
        roles = new RoleService(legacyRoles,mock(ISysMenuService.class),mock(ISysDeptService.class),
                mock(ISysUserService.class),selections,mutex,sessions,manager);
        var rows = mock(MenuMutationMapper.class);
        when(rows.rows()).thenReturn(List.of(new MenuMutationMapper.Row(3L,0L,"action",null,"Action",1,
                "F","0","0","system:post:list","1","","","","","0",null)));
        when(rows.affectedUsers(3L)).thenReturn(List.of(7L));
        when(rows.update(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any())).thenReturn(1);
        menus = new MenuService(rows,mock(ISysMenuService.class),mutex,mock(MenuRouteCatalog.class),sessions,
                mock(ISysUserService.class),mock(NavigationMapper.class),mock(io.eforge.enterprise.framework.web.service.SysPermissionService.class),manager);
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest @ValueSource(strings={"role","menu"})
    void participatingMutationCannotPublishUntilOuterCommit(String kind) throws Exception
    {
        outer.executeWithoutResult(status -> {
            mutate(kind);
            assertTrue(published.isEmpty(),"An inner REQUIRED completion is not a committed mutation");
        });
        verify(connection).commit();
        assertEquals(List.of(Set.of(7L)),published);
    }

    @ParameterizedTest @ValueSource(strings={"role","menu"})
    void outerRollbackCannotRefreshOrRevokeSessions(String kind) throws Exception
    {
        outer.executeWithoutResult(status -> { mutate(kind);status.setRollbackOnly(); });
        verify(connection).rollback();verify(connection,never()).commit();
        assertTrue(published.isEmpty(),"An uncommitted authorization must never be published");
    }

    @ParameterizedTest @ValueSource(strings={"role","menu"})
    void ordinaryStandaloneMutationStillRefreshesAfterCommit(String kind) throws Exception
    {
        mutate(kind);verify(connection).commit();assertEquals(List.of(Set.of(7L)),published);
    }

    private void mutate(String kind)
    {
        if(kind.equals("role")) roles.status("2","1");
        else menus.update("3",new MenuContracts.MenuWriteRequest("action","Action","0",1,
                MenuContracts.Type.FUNCTION,"1",true,null,null,"system:post:list","","",null,"",true));
    }
}
