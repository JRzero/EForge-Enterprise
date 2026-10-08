package io.eforge.enterprise.web.controller.system;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.ArrayUtils;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.HtmlUtils;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.core.controller.BaseController;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.page.TableDataInfo;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.service.ISysPostService;
import io.eforge.enterprise.system.service.ISysRoleService;
import io.eforge.enterprise.system.service.ISysUserService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.web.controller.api.v1.system.RoleSessionRefresher;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportService;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportFileReader;
import io.eforge.enterprise.web.controller.api.v1.system.UserImportController.UserImportResponse;

/**
 * 用户信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/user")
public class SysUserController extends BaseController
{
    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysRoleService roleService;

    @Autowired
    private ISysDeptService deptService;

    @Autowired
    private ISysPostService postService;

    @Autowired
    private DepartmentMutationMapper mutations;

    @Autowired
    private RoleSessionRefresher sessions;

    @Autowired
    private UserImportService userImporter;

    @Autowired
    private UserImportFileReader importFiles;

    /**
     * 获取用户列表
     */
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/list")
    public TableDataInfo list(SysUser user)
    {
        startPage();
        List<SysUser> list = userService.selectUserList(user);
        return getDataTable(list);
    }

    @Log(title = "用户管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@ss.hasPermi('system:user:export')")
    @PostMapping("/export")
    public void export(HttpServletResponse response, SysUser user)
    {
        List<SysUser> list = userService.selectUserList(user);
        ExcelUtil<SysUser> util = new ExcelUtil<SysUser>(SysUser.class);
        util.exportExcel(response, list, "用户数据");
    }

    @Log(title = "用户管理", businessType = BusinessType.IMPORT)
    @PreAuthorize("@ss.hasPermi('system:user:import')")
    @PostMapping("/importData")
    public AjaxResult importData(MultipartFile file, boolean updateSupport) throws Exception
    {
        UserImportResponse result;
        try
        {
            // Both HTTP contracts share committed-row accounting and session propagation.
            result = userImporter.importUsers(importFiles.read(file), updateSupport);
        }
        catch (ApiFailure failure)
        {
            if ("USER_IMPORT_EMPTY".equals(failure.code()))
                throw new ServiceException("导入用户数据不能为空！");
            if ("USER_IMPORT_TOO_LARGE".equals(failure.code()))
                throw new ServiceException("用户工作簿最多包含 1000 行数据。", 400);
            if ("USER_IMPORT_FILE_INVALID".equals(failure.code()))
                throw new ServiceException("请上传有效的 XLS 或 XLSX 用户工作簿。", 400);
            if ("USER_IMPORT_SESSION_REFRESH_FAILED".equals(failure.code()))
            {
                ServiceException unavailable = new ServiceException("成功条目已保存，但登录会话同步失败；已提交的数据未回滚，请联系管理员处理。", 503);
                unavailable.initCause(failure);
                throw unavailable;
            }
            throw failure;
        }
        String message = importMessage(result);
        if (result.failed() > 0)
        {
            throw new ServiceException(message);
        }
        return success(message);
    }

    private static String importMessage(UserImportResponse result)
    {
        StringBuilder message = new StringBuilder("导入完成：新增 ").append(result.created())
                .append(" 条，更新 ").append(result.updated()).append(" 条，失败 ").append(result.failed()).append(" 条。");
        if (result.failed() > 0)
        {
            message.append("成功条目已保存，请核对失败条目后重试。");
        }
        for (var row : result.rows())
        {
            message.append("<br/>").append(row.row()).append("、账号 ").append(HtmlUtils.htmlEscape(row.username()));
            switch (row.outcome())
            {
                case "CREATED" -> message.append(" 导入成功");
                case "UPDATED" -> message.append(" 更新成功");
                default -> message.append(" 导入失败（").append(HtmlUtils.htmlEscape(
                        row.code() == null ? "USER_IMPORT_FAILED" : row.code())).append("）");
            }
        }
        return message.toString();
    }

    @PostMapping("/importTemplate")
    public void importTemplate(HttpServletResponse response)
    {
        ExcelUtil<SysUser> util = new ExcelUtil<SysUser>(SysUser.class);
        util.importTemplateExcel(response, "用户数据");
    }

    /**
     * 根据用户编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping(value = { "/", "/{userId}" })
    public AjaxResult getInfo(@PathVariable(value = "userId", required = false) Long userId)
    {
        AjaxResult ajax = AjaxResult.success();
        if (StringUtils.isNotNull(userId))
        {
            userService.checkUserDataScope(userId);
            SysUser sysUser = userService.selectUserById(userId);
            ajax.put(AjaxResult.DATA_TAG, sysUser);
            ajax.put("postIds", postService.selectPostListByUserId(userId));
            ajax.put("roleIds", sysUser.getRoles().stream().map(SysRole::getRoleId).collect(Collectors.toList()));
        }
        List<SysRole> roles = roleService.selectRoleAll();
        ajax.put("roles", SecurityUtils.isAdmin(userId) ? roles : roles.stream().filter(r -> !r.isAdmin()).collect(Collectors.toList()));
        ajax.put("posts", postService.selectPostAll());
        return ajax;
    }

    /**
     * 新增用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @Log(title = "用户管理", businessType = BusinessType.INSERT)
    @PostMapping
    @Transactional
    public AjaxResult add(@Validated @RequestBody SysUser user)
    {
        lockIdentityMutations();
        deptService.checkDeptDataScope(user.getDeptId());
        checkAssignableRoles(user.getRoleIds(), List.of());
        if (!userService.checkUserNameUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，登录账号已存在");
        }
        else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !userService.checkPhoneUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，手机号码已存在");
        }
        else if (StringUtils.isNotEmpty(user.getEmail()) && !userService.checkEmailUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        user.setCreateBy(getUsername());
        user.setPassword(SecurityUtils.encryptPassword(user.getPassword()));
        return toAjax(userService.insertUser(user));
    }

    /**
     * 修改用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping
    @Transactional
    public AjaxResult edit(@Validated @RequestBody SysUser user)
    {
        // The compatibility editor has no credential-write authority.
        // The shared mapper independently excludes this column for every editor/profile caller.
        user.setPassword(null);
        lockIdentityMutations();
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        deptService.checkDeptDataScope(user.getDeptId());
        checkAssignableRoles(user.getRoleIds(), roleService.selectRoleListByUserId(user.getUserId()));
        if (!userService.checkUserNameUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，登录账号已存在");
        }
        else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !userService.checkPhoneUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，手机号码已存在");
        }
        else if (StringUtils.isNotEmpty(user.getEmail()) && !userService.checkEmailUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        user.setUpdateBy(getUsername());
        int rows = userService.updateUser(user);
        if (rows > 0) sessions.refreshAfterCommit(Set.of(user.getUserId()));
        return toAjax(rows);
    }

    /**
     * 删除用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:remove')")
    @Log(title = "用户管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{userIds}")
    @Transactional
    public AjaxResult remove(@PathVariable Long[] userIds)
    {
        if (ArrayUtils.contains(userIds, getUserId()))
        {
            return error("当前用户不能删除");
        }
        lockIdentityMutations();
        int rows = userService.deleteUserByIds(userIds);
        if (rows > 0) sessions.refreshAfterCommit(Set.copyOf(Arrays.asList(userIds)));
        return toAjax(rows);
    }

    /**
     * 重置密码
     */
    @PreAuthorize("@ss.hasPermi('system:user:resetPwd')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping("/resetPwd")
    public AjaxResult resetPwd(@RequestBody SysUser user)
    {
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        user.setPassword(SecurityUtils.encryptPassword(user.getPassword()));
        user.setUpdateBy(getUsername());
        return toAjax(userService.resetPwd(user));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    @Transactional
    public AjaxResult changeStatus(@RequestBody SysUser user)
    {
        lockIdentityMutations();
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        user.setUpdateBy(getUsername());
        int rows = userService.updateUserStatus(user);
        if (rows > 0) sessions.refreshAfterCommit(Set.of(user.getUserId()));
        return toAjax(rows);
    }

    /**
     * 根据用户编号获取授权角色
     */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/authRole/{userId}")
    public AjaxResult authRole(@PathVariable("userId") Long userId)
    {
        userService.checkUserDataScope(userId);
        AjaxResult ajax = AjaxResult.success();
        SysUser user = userService.selectUserById(userId);
        List<SysRole> roles = roleService.selectRolesByUserId(userId);
        ajax.put("user", user);
        ajax.put("roles", SecurityUtils.isAdmin(userId) ? roles : roles.stream().filter(r -> !r.isAdmin()).collect(Collectors.toList()));
        return ajax;
    }

    /**
     * 用户授权角色
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.GRANT)
    @PutMapping("/authRole")
    @Transactional
    public AjaxResult insertAuthRole(Long userId, Long[] roleIds)
    {
        if (userId == null || userId < 1 || roleIds == null || roleIds.length > 100
                || Arrays.stream(roleIds).anyMatch(id -> id == null || id < 1)
                || new HashSet<>(Arrays.asList(roleIds)).size() != roleIds.length)
        {
            throw new ServiceException("用户和角色编号无效", 400);
        }
        // Keep the same mutation ordering as canonical user-role assignment.
        lockIdentityMutations();
        userService.checkUserDataScope(userId);
        SysUser target = userService.selectUserById(userId);
        if (target == null || !"0".equals(target.getDelFlag())) throw new ServiceException("用户不存在", 404);
        if (target.isAdmin()) throw new ServiceException("不允许操作超级管理员用户", 409);
        userService.checkUserAllowed(target);
        checkAssignableRoles(roleIds, roleService.selectRoleListByUserId(userId));
        userService.insertUserAuth(userId, roleIds);
        sessions.refreshAfterCommit(Set.of(userId));
        return success();
    }

    private void checkAssignableRoles(Long[] roleIds, List<Long> existingRoleIds)
    {
        // Legacy add/edit can also replace role links; none may bypass the allocation guard.
        if (roleIds == null) return;
        if (roleIds.length > 100 || Arrays.stream(roleIds).anyMatch(id -> id == null || id < 1)
                || new HashSet<>(Arrays.asList(roleIds)).size() != roleIds.length)
            throw new ServiceException("角色编号无效", 400);
        roleService.checkRoleDataScope(roleIds);
        // Check the complete set before deleting or inserting any association.
        for (Long roleId : roleIds)
        {
            SysRole role = roleService.selectRoleById(roleId);
            if (role == null || !"0".equals(role.getDelFlag())) throw new ServiceException("角色不存在", 404);
            if (role.isAdmin()) throw new ServiceException("不允许分配超级管理员角色", 409);
            roleService.checkRoleAllowed(role);
            if (!"0".equals(role.getStatus()) && !existingRoleIds.contains(roleId))
                throw new ServiceException("不能分配已停用的角色", 409);
        }
    }

    private void lockIdentityMutations()
    {
        if (mutations.lockRoot() == null) throw new ServiceException("根部门不存在", 409);
    }

    /**
     * 获取部门树列表
     */
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/deptTree")
    public AjaxResult deptTree(SysDept dept)
    {
        return success(deptService.selectDeptTreeList(dept));
    }
}
