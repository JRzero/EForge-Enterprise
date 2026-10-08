package io.eforge.enterprise.web.controller.system;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.core.controller.BaseController;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.page.TableDataInfo;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;
import io.eforge.enterprise.system.domain.SysUserRole;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.RoleSelectionMapper;
import io.eforge.enterprise.web.controller.api.v1.system.RoleService;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import io.eforge.enterprise.web.controller.api.v1.system.RoleContracts.RoleUsersRequest;

/**
 * 角色信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/role")
public class SysRoleController extends BaseController
{
    @Autowired
    private ISysRoleService roleService;

    @Autowired
    private RoleSessionRefresher sessions;

    @Autowired
    private RoleSelectionMapper selections;

    @Autowired
    private DepartmentMutationMapper mutations;

    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysDeptService deptService;

    @Autowired
    private RoleService roleAssignments;

    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/list")
    public TableDataInfo list(SysRole role)
    {
        startPage();
        List<SysRole> list = roleService.selectRoleList(role);
        return getDataTable(list);
    }

    @Log(title = "角色管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@ss.hasPermi('system:role:export')")
    @PostMapping("/export")
    public void export(HttpServletResponse response, SysRole role)
    {
        List<SysRole> list = roleService.selectRoleList(role);
        ExcelUtil<SysRole> util = new ExcelUtil<SysRole>(SysRole.class);
        util.exportExcel(response, list, "角色数据");
    }

    /**
     * 根据角色编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping(value = "/{roleId}")
    public AjaxResult getInfo(@PathVariable Long roleId)
    {
        roleService.checkRoleDataScope(roleId);
        return success(roleService.selectRoleById(roleId));
    }

    /**
     * 新增角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:add')")
    @Log(title = "角色管理", businessType = BusinessType.INSERT)
    @PostMapping
    @Transactional
    public AjaxResult add(@Validated @RequestBody SysRole role)
    {
        lockIdentityMutations();
        // Create never accepts another role's identity or existing grant allowance.
        role.setRoleId(null);
        role.setMenuIds(validateMenuGrants(role.getMenuIds(), null));
        if (!roleService.checkRoleNameUnique(role))
        {
            return error("新增角色'" + role.getRoleName() + "'失败，角色名称已存在");
        }
        else if (!roleService.checkRoleKeyUnique(role))
        {
            return error("新增角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }
        role.setCreateBy(getUsername());
        return toAjax(roleService.insertRole(role));

    }

    /**
     * 修改保存角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping
    @Transactional
    public AjaxResult edit(@Validated @RequestBody SysRole role)
    {
        lockIdentityMutations();
        if (role.getRoleId() == null || role.getRoleId() < 1) throw new ServiceException("角色编号无效", 400);
        role.setMenuIds(validateMenuGrants(role.getMenuIds(), role.getRoleId()));
        if (!roleService.checkRoleNameUnique(role))
        {
            return error("修改角色'" + role.getRoleName() + "'失败，角色名称已存在");
        }
        else if (!roleService.checkRoleKeyUnique(role))
        {
            return error("修改角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }
        role.setUpdateBy(getUsername());
        
        if (roleService.updateRole(role) > 0)
        {
            // 刷新所有持有该角色的在线用户权限
            sessions.refreshAfterCommit(Set.copyOf(selections.userIds(role.getRoleId())));
            return success();
        }
        return error("修改角色'" + role.getRoleName() + "'失败，请联系管理员");
    }

    /**
     * 修改保存数据权限
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping("/dataScope")
    @Transactional
    public AjaxResult dataScope(@RequestBody SysRole role)
    {
        lockIdentityMutations();
        roleService.checkRoleAllowed(role);
        roleService.checkRoleDataScope(role.getRoleId());
        int rows = roleService.authDataScope(role);
        if (rows > 0) sessions.refreshAfterCommit(Set.copyOf(selections.userIds(role.getRoleId())));
        return toAjax(rows);
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    @Transactional
    public AjaxResult changeStatus(@RequestBody SysRole role)
    {
        lockIdentityMutations();
        roleService.checkRoleAllowed(role);
        roleService.checkRoleDataScope(role.getRoleId());
        role.setUpdateBy(getUsername());
        int rows = roleService.updateRoleStatus(role);
        if (rows > 0) sessions.refreshAfterCommit(Set.copyOf(selections.userIds(role.getRoleId())));
        return toAjax(rows);
    }

    /**
     * 删除角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:remove')")
    @Log(title = "角色管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{roleIds}")
    @Transactional
    public AjaxResult remove(@PathVariable Long[] roleIds)
    {
        lockIdentityMutations();
        Set<Long> affected = new HashSet<>();
        for (Long roleId : roleIds) affected.addAll(selections.userIds(roleId));
        int rows = roleService.deleteRoleByIds(roleIds);
        if (rows > 0) sessions.refreshAfterCommit(affected);
        return toAjax(rows);
    }

    /**
     * 获取角色选择框列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping("/optionselect")
    public AjaxResult optionselect()
    {
        return success(roleService.selectRoleAll());
    }

    /**
     * 查询已分配用户角色列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/authUser/allocatedList")
    public TableDataInfo allocatedList(SysUser user)
    {
        startPage();
        List<SysUser> list = userService.selectAllocatedList(user);
        return getDataTable(list);
    }

    /**
     * 查询未分配用户角色列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/authUser/unallocatedList")
    public TableDataInfo unallocatedList(SysUser user)
    {
        startPage();
        List<SysUser> list = userService.selectUnallocatedList(user);
        return getDataTable(list);
    }

    /**
     * 取消授权用户
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/cancel")
    public AjaxResult cancelAuthUser(@RequestBody SysUserRole userRole)
    {
        if (userRole == null) return AjaxResult.error(400, "用户和角色编号无效");
        return changeAssignedUsers(userRole.getRoleId(), new Long[] { userRole.getUserId() }, false);
    }

    /**
     * 批量取消授权用户
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/cancelAll")
    public AjaxResult cancelAuthUserAll(Long roleId, Long[] userIds)
    {
        return changeAssignedUsers(roleId, userIds, false);
    }

    /**
     * 批量选择用户授权
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/selectAll")
    public AjaxResult selectAuthUserAll(Long roleId, Long[] userIds)
    {
        return changeAssignedUsers(roleId, userIds, true);
    }

    /** Keep all compatibility allocation writes behind the canonical object/transaction boundary. */
    private AjaxResult changeAssignedUsers(Long roleId, Long[] userIds, boolean assign)
    {
        if (roleId == null || roleId < 1 || userIds == null || userIds.length == 0 || userIds.length > 100
                || Arrays.stream(userIds).anyMatch(id -> id == null || id < 1))
            return AjaxResult.error(400, "用户和角色编号无效");
        try
        {
            roleAssignments.users(roleId.toString(), new RoleUsersRequest(Arrays.stream(userIds).map(Object::toString).toList()), assign);
            return success();
        }
        catch (ApiFailure failure)
        {
            // Preserve the legacy envelope while retaining the canonical safe error status.
            return AjaxResult.error(failure.status(), failure.getMessage());
        }
    }

    private void lockIdentityMutations()
    {
        if (mutations.lockRoot() == null) throw new ServiceException("根部门不存在", 409);
    }

    private Long[] validateMenuGrants(Long[] menuIds, Long roleId)
    {
        try
        {
            return roleAssignments.validateLegacyMenuGrants(menuIds, roleId);
        }
        catch (ApiFailure failure)
        {
            // Preserve the legacy response envelope without swallowing transaction failure.
            throw new ServiceException(failure.getMessage(), failure.status());
        }
    }

    /**
     * 获取对应角色部门树列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping(value = "/deptTree/{roleId}")
    public AjaxResult deptTree(@PathVariable("roleId") Long roleId)
    {
        AjaxResult ajax = AjaxResult.success();
        ajax.put("checkedKeys", deptService.selectDeptListByRoleId(roleId));
        ajax.put("depts", deptService.selectDeptTreeList(new SysDept()));
        return ajax;
    }
}
