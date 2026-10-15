package io.eforge.enterprise.web.controller.system;

import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Objects;
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
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.constant.UserConstants;
import io.eforge.enterprise.common.core.controller.BaseController;
import io.eforge.enterprise.common.core.domain.AjaxResult;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.service.ISysDeptService;

/**
 * 部门信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/dept")
public class SysDeptController extends BaseController
{
    @Autowired
    private ISysDeptService deptService;

    @Autowired
    private DepartmentMutationMapper mutations;

    /**
     * 获取部门列表
     */
    @PreAuthorize("@ss.hasPermi('system:dept:list')")
    @GetMapping("/list")
    public AjaxResult list(SysDept dept)
    {
        List<SysDept> depts = deptService.selectDeptList(dept);
        return success(depts);
    }

    /**
     * 查询部门列表（排除节点）
     */
    @PreAuthorize("@ss.hasPermi('system:dept:list')")
    @GetMapping("/list/exclude/{deptId}")
    public AjaxResult excludeChild(@PathVariable(value = "deptId", required = false) Long deptId)
    {
        List<SysDept> depts = deptService.selectDeptList(new SysDept());
        depts.removeIf(d -> d.getDeptId().intValue() == deptId || ArrayUtils.contains(StringUtils.split(d.getAncestors(), ","), deptId + ""));
        return success(depts);
    }

    /**
     * 根据部门编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @GetMapping(value = "/{deptId}")
    public AjaxResult getInfo(@PathVariable Long deptId)
    {
        deptService.checkDeptDataScope(deptId);
        return success(deptService.selectDeptById(deptId));
    }

    /**
     * 新增部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:add')")
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    @PostMapping
    @Transactional
    public AjaxResult add(@Validated @RequestBody SysDept dept)
    {
        lockHierarchy();
        dept = writableFields(dept);
        SysDept parent = requireDepartment(dept.getParentId());
        if (!UserConstants.DEPT_NORMAL.equals(parent.getStatus()))
        {
            throw new ServiceException("部门停用，不允许新增");
        }
        if (!deptService.checkDeptNameUnique(dept))
        {
            return error("新增部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        }
        dept.setCreateBy(getUsername());
        return toAjax(deptService.insertDept(dept));
    }

    /**
     * 修改部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    @PutMapping
    @Transactional
    public AjaxResult edit(@Validated @RequestBody SysDept dept)
    {
        lockHierarchy();
        Long deptId = dept.getDeptId();
        SysDept existing = requireDepartment(deptId);
        dept = writableFields(dept);
        dept.setDeptId(deptId);
        // A retained parent may be outside the current scope, just as on the canonical boundary.
        if (dept.getParentId() == null) dept.setParentId(existing.getParentId());
        if (deptId.equals(dept.getParentId()))
        {
            return error("修改部门'" + dept.getDeptName() + "'失败，上级部门不能是自己");
        }
        if (!Objects.equals(existing.getParentId(), dept.getParentId()))
        {
            SysDept parent = requireDepartment(dept.getParentId());
            if (ArrayUtils.contains(StringUtils.split(parent.getAncestors(), ","), deptId.toString()))
            {
                return error("修改部门'" + dept.getDeptName() + "'失败，上级部门不能是子部门");
            }
        }
        if (!deptService.checkDeptNameUnique(dept))
        {
            return error("修改部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        }
        else if (StringUtils.equals(UserConstants.DEPT_DISABLE, dept.getStatus()) && deptService.selectNormalChildrenDeptById(deptId) > 0)
        {
            return error("该部门包含未停用的子部门！");
        }
        dept.setUpdateBy(getUsername());
        return toAjax(deptService.updateDept(dept));
    }

    /**
     * 保存部门排序
     */
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "保存部门排序", businessType = BusinessType.UPDATE)
    @PutMapping("/updateSort")
    @Transactional
    public AjaxResult updateSort(@RequestBody Map<String, String> params)
    {
        lockHierarchy();
        if (params == null || params.get("deptIds") == null || params.get("orderNums") == null)
            throw invalidSort();
        String[] deptIds = params.get("deptIds").split(",", -1);
        String[] orderNums = params.get("orderNums").split(",", -1);
        if (deptIds.length != orderNums.length) throw invalidSort();
        var ids = new HashSet<Long>();
        // Validate the entire selection before the legacy service starts its write loop.
        for (int i = 0; i < deptIds.length; i++)
        {
            Long id;
            try
            {
                id = Long.valueOf(deptIds[i]);
                Integer.valueOf(orderNums[i]);
                if (id <= 0 || !ids.add(id)) throw invalidSort();
            }
            catch (NumberFormatException exception) { throw invalidSort(); }
            requireDepartment(id);
        }
        deptService.updateDeptSort(deptIds, orderNums);
        return success();
    }

    /**
     * 删除部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:remove')")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{deptId}")
    @Transactional
    public AjaxResult remove(@PathVariable Long deptId)
    {
        lockHierarchy();
        SysDept existing = requireDepartment(deptId);
        if (Long.valueOf(0).equals(existing.getParentId())) return warn("根部门不允许删除");
        if (deptService.hasChildByDeptId(deptId))
        {
            return warn("存在下级部门,不允许删除");
        }
        if (deptService.checkDeptExistUser(deptId))
        {
            return warn("部门存在用户,不允许删除");
        }
        return toAjax(deptService.deleteDeptById(deptId));
    }

    private SysDept requireDepartment(Long id)
    {
        if (id == null || id <= 0) throw new ServiceException("部门不存在", 404);
        deptService.checkDeptDataScope(id);
        SysDept filter = new SysDept(); filter.setDeptId(id);
        return deptService.selectDeptList(filter).stream().filter(row -> id.equals(row.getDeptId())).findFirst()
                .orElseThrow(() -> new ServiceException("部门不存在", 404));
    }

    private static SysDept writableFields(SysDept input)
    {
        // Never forward client identities on create, derived ancestry, or audit/SQL-scope fields.
        SysDept result = new SysDept(); result.setParentId(input.getParentId());
        result.setDeptName(input.getDeptName()); result.setOrderNum(input.getOrderNum());
        result.setLeader(input.getLeader()); result.setPhone(input.getPhone()); result.setEmail(input.getEmail());
        result.setStatus(input.getStatus()); return result;
    }

    private static ServiceException invalidSort()
    {
        return new ServiceException("保存排序异常，请联系管理员");
    }

    private void lockHierarchy()
    {
        // Use the canonical IAM mutex before any consistent read creates an older view.
        if (mutations.lockRoot() == null) throw new ServiceException("根部门不存在", 409);
    }
}
