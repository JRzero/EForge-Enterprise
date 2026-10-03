package com.ruoyi.framework.aspectj;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.Signature;
import org.aspectj.lang.reflect.SourceLocation;
import org.junit.jupiter.api.Test;

import com.ruoyi.common.constant.Constants;
import com.ruoyi.common.constant.UserConstants;
import com.ruoyi.common.core.domain.BaseEntity;
import com.ruoyi.common.core.domain.entity.SysRole;
import com.ruoyi.common.core.domain.entity.SysUser;

/**
 * Locks the imported RuoYi data-scope SQL behavior before package and
 * authorization refactors. These tests are intentionally sensitive to semantic
 * changes because data scope is a backend security boundary.
 */
class DataScopeAspectParityTest
{
    private static final String PERMISSION = "system:user:list";

    @Test
    void allScopeAddsNoRestriction()
    {
        assertEquals("", filter(user(role(1L, Constants.Dept.DATA_SCOPE_ALL)), "u", "d", PERMISSION));
    }

    @Test
    void customScopeUsesRoleDepartmentMapping()
    {
        assertEquals(
                " AND (d.dept_id IN ( SELECT dept_id FROM sys_role_dept WHERE role_id = 7 ) )",
                filter(user(role(7L, Constants.Dept.DATA_SCOPE_CUSTOM)), "u", "d", PERMISSION));
    }

    @Test
    void multipleCustomRolesAreCollapsedIntoSingleInQuery()
    {
        assertEquals(
                " AND (d.dept_id IN ( SELECT dept_id FROM sys_role_dept WHERE role_id in (7,8) ) )",
                filter(
                        user(
                                role(7L, Constants.Dept.DATA_SCOPE_CUSTOM),
                                role(8L, Constants.Dept.DATA_SCOPE_CUSTOM)),
                        "u",
                        "d",
                        PERMISSION));
    }

    @Test
    void departmentScopeRestrictsToCurrentDepartment()
    {
        assertEquals(
                " AND (d.dept_id = 20 )",
                filter(user(role(3L, Constants.Dept.DATA_SCOPE_DEPT)), "u", "d", PERMISSION));
    }

    @Test
    void departmentAndChildScopePreservesAncestorLookup()
    {
        String sql = filter(user(role(4L, Constants.Dept.DATA_SCOPE_DEPT_AND_CHILD)), "u", "d", PERMISSION);

        assertEquals(
                " AND (d.dept_id IN ( SELECT dept_id FROM sys_dept WHERE dept_id = 20 or find_in_set( 20 , ancestors ) ))",
                sql);
        assertTrue(sql.contains("find_in_set"), "MySQL ancestor lookup is part of the imported parity contract");
    }

    @Test
    void selfScopeUsesCurrentUserWhenAliasExists()
    {
        assertEquals(
                " AND (u.user_id = 42 )",
                filter(user(role(5L, Constants.Dept.DATA_SCOPE_SELF)), "u", "d", PERMISSION));
    }

    @Test
    void selfScopeFailsClosedWhenUserAliasIsMissing()
    {
        assertEquals(
                " AND (d.dept_id = 0 )",
                filter(user(role(5L, Constants.Dept.DATA_SCOPE_SELF)), "", "d", PERMISSION));
    }

    @Test
    void rolesWithoutRequestedPermissionFailClosed()
    {
        SysRole role = role(3L, Constants.Dept.DATA_SCOPE_DEPT);
        role.setPermissions(Set.of("system:role:list"));

        assertEquals(
                " AND (d.dept_id = 0 )",
                filter(user(role), "u", "d", PERMISSION));
    }

    @Test
    void disabledRolesAreIgnoredAndFailClosed()
    {
        SysRole role = role(3L, Constants.Dept.DATA_SCOPE_DEPT);
        role.setStatus(UserConstants.ROLE_DISABLE);

        assertEquals(
                " AND (d.dept_id = 0 )",
                filter(user(role), "u", "d", PERMISSION));
    }

    @Test
    void differentScopeRolesAreCombinedWithOr()
    {
        assertEquals(
                " AND (d.dept_id = 20  OR u.user_id = 42 )",
                filter(
                        user(
                                role(3L, Constants.Dept.DATA_SCOPE_DEPT),
                                role(5L, Constants.Dept.DATA_SCOPE_SELF)),
                        "u",
                        "d",
                        PERMISSION));
    }

    private static String filter(SysUser currentUser, String userAlias, String deptAlias, String permission)
    {
        BaseEntity query = new BaseEntity();
        query.getParams().put(DataScopeAspect.DATA_SCOPE, "");

        DataScopeAspect.dataScopeFilter(
                joinPoint(query),
                currentUser,
                userAlias,
                deptAlias,
                "user_id",
                "dept_id",
                permission);

        return String.valueOf(query.getParams().get(DataScopeAspect.DATA_SCOPE));
    }

    private static SysUser user(SysRole... roles)
    {
        SysUser user = new SysUser();
        user.setUserId(42L);
        user.setDeptId(20L);
        user.setRoles(List.of(roles));
        return user;
    }

    private static SysRole role(Long id, String dataScope)
    {
        SysRole role = new SysRole();
        role.setRoleId(id);
        role.setDataScope(dataScope);
        role.setStatus(UserConstants.ROLE_NORMAL);
        role.setPermissions(Set.of(PERMISSION));
        return role;
    }

    private static JoinPoint joinPoint(Object firstArgument)
    {
        return new JoinPoint()
        {
            @Override
            public String toShortString()
            {
                return "DataScopeParity";
            }

            @Override
            public String toLongString()
            {
                return "DataScopeParity";
            }

            @Override
            public Object getThis()
            {
                return null;
            }

            @Override
            public Object getTarget()
            {
                return null;
            }

            @Override
            public Object[] getArgs()
            {
                return new Object[] { firstArgument };
            }

            @Override
            public Signature getSignature()
            {
                return null;
            }

            @Override
            public SourceLocation getSourceLocation()
            {
                return null;
            }

            @Override
            public String getKind()
            {
                return "method-execution";
            }

            @Override
            public StaticPart getStaticPart()
            {
                return null;
            }
        };
    }
}
