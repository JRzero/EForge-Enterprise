package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.core.domain.entity.SysDept;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.service.ISysDeptService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;

/** Canonical DTO boundary around the unchanged RuoYi hierarchy/data-scope service. */
@RestController
@RequestMapping("/api/v1/system/departments")
public class DepartmentController
{
    private final ISysDeptService departments;
    private final DepartmentMutationMapper mutations;
    public DepartmentController(ISysDeptService departments, DepartmentMutationMapper mutations)
    { this.departments = departments; this.mutations = mutations; }

    @GetMapping
    @PreAuthorize("@ss.hasPermi('system:dept:list')")
    @Operation(operationId = "listDepartments")
    public List<DepartmentResponse> list(
            @RequestParam(defaultValue = "") @Size(max = 30) String name,
            @RequestParam(defaultValue = "") @Pattern(regexp = "[01]?") String status,
            @RequestParam(required = false) @Pattern(regexp = "[1-9][0-9]{0,18}") String excludeId)
    {
        Long excluded = excludeId == null ? null : identifier(excludeId);
        if (excluded != null) require(excluded);
        SysDept filter = new SysDept(); filter.setDeptName(name); filter.setStatus(status);
        return departments.selectDeptList(filter).stream()
                .filter(row -> excluded == null || (!excluded.equals(row.getDeptId()) && !descendant(row, excluded)))
                .sorted(Comparator.comparing(SysDept::getParentId).thenComparing(SysDept::getOrderNum).thenComparing(SysDept::getDeptId))
                .map(DepartmentResponse::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @Operation(operationId = "getDepartment")
    public DepartmentResponse get(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id)
    { return DepartmentResponse.from(require(identifier(id))); }

    @PostMapping
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:dept:add')")
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    @Operation(operationId = "createDepartment")
    @ApiResponse(responseCode = "201", description = "Created department", content = @Content(schema = @Schema(implementation = DepartmentResponse.class)))
    public ResponseEntity<DepartmentResponse> create(@Valid @RequestBody DepartmentRequest request)
    {
        Long parentId = identifier(request.parentId());
        if (parentId == 0) throw failure(400, "DEPARTMENT_PARENT_INVALID", "An existing parent department is required.");
        lockHierarchy();
        SysDept parent = require(parentId);
        if (!"0".equals(parent.getStatus())) throw failure(409, "DEPARTMENT_PARENT_DISABLED", "Parent department is disabled.");
        SysDept department = entity(request); unique(department);
        department.setCreateBy(SecurityUtils.getUsername());
        try { departments.insertDept(department); }
        catch (DuplicateKeyException exception) { throw failure(409, "DEPARTMENT_NAME_EXISTS", "Department name already exists under this parent."); }
        return ResponseEntity.created(URI.create("/api/v1/system/departments/" + department.getDeptId()))
                .body(DepartmentResponse.from(department));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    @Operation(operationId = "updateDepartment")
    public DepartmentResponse update(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody DepartmentRequest request)
    {
        Long departmentId = identifier(id);
        lockHierarchy();
        SysDept existing = require(departmentId);
        Long parentId = identifier(request.parentId());
        if (parentId.equals(departmentId)) throw failure(409, "DEPARTMENT_CYCLE", "A department cannot be its own parent.");
        if (!parentId.equals(existing.getParentId()))
        {
            if (parentId == 0) throw failure(400, "DEPARTMENT_PARENT_INVALID", "An existing parent department is required.");
            SysDept parent = require(parentId);
            if (descendant(parent, departmentId)) throw failure(409, "DEPARTMENT_CYCLE", "A descendant cannot become the parent.");
        }
        if ("1".equals(request.status()) && departments.selectNormalChildrenDeptById(departmentId) > 0)
            throw failure(409, "DEPARTMENT_ACTIVE_CHILDREN", "Department has active descendants.");
        SysDept department = entity(request); department.setDeptId(departmentId); unique(department);
        department.setUpdateBy(SecurityUtils.getUsername());
        try
        {
            if (departments.updateDept(department) != 1) throw failure(404, "DEPARTMENT_NOT_FOUND", "Department does not exist.");
        }
        catch (DuplicateKeyException exception) { throw failure(409, "DEPARTMENT_NAME_EXISTS", "Department name already exists under this parent."); }
        return DepartmentResponse.from(require(departmentId));
    }

    @PutMapping("/sort")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "保存部门排序", businessType = BusinessType.UPDATE)
    @Operation(operationId = "sortDepartments")
    @ApiResponse(responseCode = "204", description = "Department order saved", content = @Content)
    public ResponseEntity<Void> sort(@Valid @RequestBody DepartmentSortRequest request)
    {
        lockHierarchy();
        var seen = new HashSet<Long>();
        for (var item : request.items())
        {
            Long id = identifier(item.id());
            if (!seen.add(id)) throw failure(400, "VALIDATION_ERROR", "Department identifiers must be unique.");
            require(id);
        }
        departments.updateDeptSort(request.items().stream().map(DepartmentSortRequest.Item::id).toArray(String[]::new),
                request.items().stream().map(item -> item.sort().toString()).toArray(String[]::new));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:dept:remove')")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    @Operation(operationId = "deleteDepartment")
    @ApiResponse(responseCode = "204", description = "Department deleted", content = @Content)
    public ResponseEntity<Void> delete(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id)
    {
        Long departmentId = identifier(id); lockHierarchy(); SysDept existing = require(departmentId);
        if (existing.getParentId() == 0) throw failure(409, "DEPARTMENT_ROOT_PROTECTED", "Root department cannot be deleted.");
        if (departments.hasChildByDeptId(departmentId)) throw failure(409, "DEPARTMENT_HAS_CHILDREN", "Department has children.");
        if (departments.checkDeptExistUser(departmentId)) throw failure(409, "DEPARTMENT_HAS_USERS", "Department has users.");
        if (departments.deleteDeptById(departmentId) != 1) throw failure(404, "DEPARTMENT_NOT_FOUND", "Department does not exist.");
        return ResponseEntity.noContent().build();
    }

    private void lockHierarchy()
    {
        // Acquire before any consistent read, so a waiting transaction observes
        // its predecessor's committed hierarchy rather than an older snapshot.
        if (mutations.lockRoot() == null) throw failure(409, "DEPARTMENT_ROOT_MISSING", "Root department does not exist.");
    }
    private SysDept require(Long id)
    {
        try { departments.checkDeptDataScope(id); }
        catch (ServiceException exception) { throw new AccessDeniedException("Department is outside the allowed data scope."); }
        SysDept filter = new SysDept(); filter.setDeptId(id);
        return departments.selectDeptList(filter).stream().findFirst()
                .orElseThrow(() -> failure(404, "DEPARTMENT_NOT_FOUND", "Department does not exist."));
    }
    private void unique(SysDept department)
    {
        if (!departments.checkDeptNameUnique(department)) throw failure(409, "DEPARTMENT_NAME_EXISTS", "Department name already exists under this parent.");
    }
    private static boolean descendant(SysDept department, Long ancestor)
    { return department.getAncestors() != null && Arrays.asList(department.getAncestors().split(",")).contains(ancestor.toString()); }
    private static Long identifier(String value)
    {
        try { return Long.valueOf(value); }
        catch (NumberFormatException exception) { throw failure(400, "VALIDATION_ERROR", "The identifier is invalid."); }
    }
    private static ApiFailure failure(int status, String code, String detail) { return new ApiFailure(status, code, detail); }
    private static SysDept entity(DepartmentRequest request)
    {
        SysDept department = new SysDept(); department.setParentId(identifier(request.parentId()));
        department.setDeptName(request.name()); department.setOrderNum(request.sort()); department.setStatus(request.status());
        department.setLeader(request.leader() == null ? "" : request.leader());
        department.setPhone(request.phone() == null ? "" : request.phone()); department.setEmail(request.email() == null ? "" : request.email());
        return department;
    }
}
