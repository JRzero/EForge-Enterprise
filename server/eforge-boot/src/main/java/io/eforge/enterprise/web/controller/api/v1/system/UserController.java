package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;
import io.eforge.enterprise.system.service.*;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.UserContracts.*;

/** Canonical user facade around the original data-scope and association services. */
@RestController
@RequestMapping("/api/v1/system/users")
public class UserController
{
    private final ISysUserService users;
    private final ISysDeptService departments;
    private final ISysRoleService roles;
    private final ISysPostService posts;
    private final ISysConfigService configuration;
    private final DepartmentMutationMapper mutations;
    public UserController(ISysUserService users, ISysDeptService departments, ISysRoleService roles,
            ISysPostService posts, ISysConfigService configuration, DepartmentMutationMapper mutations)
    { this.users = users; this.departments = departments; this.roles = roles; this.posts = posts; this.configuration = configuration; this.mutations = mutations; }

    @GetMapping
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @Operation(operationId = "listUsers")
    public PageResponse<UserResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue = "") @Size(max = 30) String username,
            @RequestParam(defaultValue = "") @Size(max = 11) String phone,
            @RequestParam(defaultValue = "") @Pattern(regexp = "[01]?") String status,
            @RequestParam(required = false) @Pattern(regexp = "[1-9][0-9]{0,18}") String departmentId,
            @RequestParam(defaultValue = "") @Size(max = 10) String beginDate,
            @RequestParam(defaultValue = "") @Size(max = 10) String endDate)
    {
        SysUser filter = filter(username, phone, status, departmentId, beginDate, endDate);
        try
        {
            PageHelper.startPage(page, pageSize, "u.user_id asc");
            List<SysUser> rows = users.selectUserList(filter);
            return new PageResponse<>(rows.stream().map(UserResponse::from).toList(), new PageInfo<>(rows).getTotal(), page, pageSize);
        }
        finally { PageHelper.clearPage(); }
    }

    @GetMapping("/departments")
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @Operation(operationId = "listUserDepartments")
    public List<DepartmentResponse> departments()
    { return departments.selectDeptList(new SysDept()).stream().map(DepartmentResponse::from).toList(); }

    @GetMapping("/options")
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @Operation(operationId = "getUserOptions")
    @Log(title = "用户编辑选项", isSaveRequestData = false, isSaveResponseData = false)
    public ResponseEntity<UserOptionsResponse> options()
    {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(new UserOptionsResponse(departments(), roleOptions(), posts.selectPostAll().stream()
                .map(post -> new UserOption(post.getPostId().toString(), post.getPostName(), post.getStatus())).toList(),
                configuration.selectConfigByKey("sys.user.initPassword")));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @Operation(operationId = "getUser")
    public UserEditorResponse get(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id)
    {
        SysUser user = require(identifier(id));
        return new UserEditorResponse(UserResponse.from(user), roles.selectRoleListByUserId(user.getUserId()).stream().map(Object::toString).toList(),
                posts.selectPostListByUserId(user.getUserId()).stream().map(Object::toString).toList());
    }

    @PostMapping
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @Log(title = "用户管理", businessType = BusinessType.INSERT, isSaveRequestData = false)
    @Operation(operationId = "createUser")
    @ApiResponse(responseCode = "201", description = "User created", content = @Content(schema = @Schema(implementation = UserResponse.class)))
    public ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request)
    {
        lockMutations(); SysUser user = entity(request.user()); validateAssociations(user, null); unique(user);
        user.setPassword(SecurityUtils.encryptPassword(request.password())); user.setCreateBy(SecurityUtils.getUsername());
        try { users.insertUser(user); }
        catch (DuplicateKeyException exception) { throw conflict(); }
        return ResponseEntity.created(URI.create("/api/v1/system/users/" + user.getUserId())).body(UserResponse.from(user));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @Operation(operationId = "updateUser")
    public UserResponse update(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody UserWriteRequest request)
    {
        lockMutations(); SysUser existing = mutable(identifier(id));
        if (!existing.getUserName().equals(request.username())) throw failure(409, "USER_USERNAME_IMMUTABLE", "Login name cannot be changed.");
        SysUser user = entity(request); user.setUserId(existing.getUserId()); validateAssociations(user, existing); unique(user);
        user.setUpdateBy(SecurityUtils.getUsername());
        try { if (users.updateUser(user) != 1) throw missing(); }
        catch (DuplicateKeyException exception) { throw conflict(); }
        return UserResponse.from(require(user.getUserId()));
    }

    @DeleteMapping
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:remove')")
    @Log(title = "用户管理", businessType = BusinessType.DELETE)
    @Operation(operationId = "deleteUsers")
    @ApiResponse(responseCode = "204", description = "Users deleted", content = @Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteUsersRequest request)
    {
        lockMutations(); Long[] ids = identifiers(request.ids());
        for (Long id : ids)
        {
            if (id.equals(SecurityUtils.getUserId())) throw failure(409, "USER_SELF_DELETE", "The current user cannot be deleted.");
            mutable(id);
        }
        users.deleteUserByIds(ids); return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/status")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @Operation(operationId = "setUserStatus")
    @ApiResponse(responseCode = "204", description = "User status changed", content = @Content)
    public ResponseEntity<Void> status(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody UserStatusRequest request)
    {
        lockMutations(); SysUser user = mutable(identifier(id)); user.setStatus(request.status());
        user.setUpdateBy(SecurityUtils.getUsername()); if (users.updateUserStatus(user) != 1) throw missing();
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/password")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:resetPwd')")
    @Log(title = "重置用户密码", businessType = BusinessType.UPDATE, isSaveRequestData = false)
    @Operation(operationId = "resetUserPassword")
    @ApiResponse(responseCode = "204", description = "Password reset", content = @Content)
    public ResponseEntity<Void> password(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody ResetUserPasswordRequest request)
    {
        lockMutations(); SysUser user = mutable(identifier(id)); user.setPassword(SecurityUtils.encryptPassword(request.password()));
        user.setUpdateBy(SecurityUtils.getUsername()); if (users.resetPwd(user) != 1) throw missing();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/roles")
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @Operation(operationId = "getUserRoles")
    public UserEditorResponse userRoles(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id)
    { return get(id); }

    @PutMapping("/{id}/roles")
    @Transactional
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.GRANT)
    @Operation(operationId = "setUserRoles")
    @ApiResponse(responseCode = "204", description = "User roles assigned", content = @Content)
    public ResponseEntity<Void> assignRoles(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody UserRolesRequest request)
    {
        lockMutations(); SysUser user = mutable(identifier(id)); Long[] ids = identifiers(request.roleIds());
        validateRoles(ids, roles.selectRoleListByUserId(user.getUserId()));
        users.insertUserAuth(user.getUserId(), ids); return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/export", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('system:user:export')")
    @Log(title = "用户管理", businessType = BusinessType.EXPORT)
    @Operation(operationId = "exportUsers")
    @ApiResponse(responseCode = "200", description = "Filtered XLSX workbook", content = @Content(mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", schema = @Schema(type = "string", format = "binary")))
    public void export(HttpServletResponse response,
            @RequestParam(defaultValue = "") @Size(max = 30) String username,
            @RequestParam(defaultValue = "") @Size(max = 11) String phone,
            @RequestParam(defaultValue = "") @Pattern(regexp = "[01]?") String status,
            @RequestParam(required = false) @Pattern(regexp = "[1-9][0-9]{0,18}") String departmentId,
            @RequestParam(defaultValue = "") @Size(max = 10) String beginDate,
            @RequestParam(defaultValue = "") @Size(max = 10) String endDate)
    { new ExcelUtil<>(SysUser.class).exportExcel(response, users.selectUserList(filter(username, phone, status, departmentId, beginDate, endDate)), "用户数据"); }

    private List<UserOption> roleOptions()
    { return roles.selectRoleAll().stream().filter(role -> !role.isAdmin()).map(role -> new UserOption(role.getRoleId().toString(), role.getRoleName(), role.getStatus())).toList(); }
    private SysUser require(Long id)
    {
        try { users.checkUserDataScope(id); }
        catch (ServiceException exception) { throw new AccessDeniedException("User is outside the allowed data scope."); }
        SysUser user = users.selectUserById(id);
        if (user == null || !"0".equals(user.getDelFlag())) throw missing();
        return user;
    }
    private SysUser mutable(Long id)
    {
        SysUser user = require(id);
        if (user.isAdmin()) throw failure(409, "USER_ADMIN_PROTECTED", "The super administrator cannot be modified.");
        users.checkUserAllowed(user); return user;
    }
    private void lockMutations()
    {
        // Share the department mutation lock so canonical user assignments cannot
        // race deletion of a department. Acquire before the first snapshot read.
        if (mutations.lockRoot() == null) throw failure(409, "DEPARTMENT_ROOT_MISSING", "Root department does not exist.");
    }
    private void validateAssociations(SysUser user, SysUser existing)
    {
        if (user.getDeptId() == null)
        {
            if (!SecurityUtils.isAdmin()) throw new AccessDeniedException("An allowed department is required.");
        }
        else
        {
            try { departments.checkDeptDataScope(user.getDeptId()); }
            catch (ServiceException exception) { throw new AccessDeniedException("Department is outside the allowed data scope."); }
            SysDept filter = new SysDept(); filter.setDeptId(user.getDeptId());
            SysDept department = departments.selectDeptList(filter).stream().findFirst()
                    .orElseThrow(() -> failure(409, "USER_DEPARTMENT_NOT_FOUND", "Department does not exist."));
            if (!"0".equals(department.getStatus()) && (existing == null || !user.getDeptId().equals(existing.getDeptId())))
                throw failure(409, "USER_DEPARTMENT_DISABLED", "Department is disabled.");
        }
        validateRoles(user.getRoleIds(), existing == null ? List.of() : roles.selectRoleListByUserId(existing.getUserId()));
        List<Long> existingPosts = existing == null ? List.of() : posts.selectPostListByUserId(existing.getUserId());
        for (Long id : user.getPostIds())
        {
            var post = posts.selectPostById(id);
            if (post == null) throw failure(409, "USER_POST_NOT_FOUND", "Post does not exist.");
            if (!"0".equals(post.getStatus()) && !existingPosts.contains(id)) throw failure(409, "USER_POST_DISABLED", "Post is disabled.");
        }
    }
    private void validateRoles(Long[] ids, List<Long> existingIds)
    {
        try { roles.checkRoleDataScope(ids); }
        catch (ServiceException exception) { throw new AccessDeniedException("Role is outside the allowed data scope."); }
        for (Long id : ids)
        {
            SysRole role = roles.selectRoleById(id);
            if (role == null || !"0".equals(role.getDelFlag())) throw failure(409, "USER_ROLE_NOT_FOUND", "Role does not exist.");
            if (role.isAdmin()) throw failure(409, "USER_ADMIN_ROLE_PROTECTED", "Super administrator role cannot be assigned.");
            if (!"0".equals(role.getStatus()) && !existingIds.contains(id)) throw failure(409, "USER_ROLE_DISABLED", "Role is disabled.");
        }
    }
    private void unique(SysUser user)
    {
        if (!users.checkUserNameUnique(user)) throw failure(409, "USER_USERNAME_EXISTS", "Login name already exists.");
        if (!user.getPhonenumber().isEmpty() && !users.checkPhoneUnique(user)) throw failure(409, "USER_PHONE_EXISTS", "Phone already exists.");
        if (!user.getEmail().isEmpty() && !users.checkEmailUnique(user)) throw failure(409, "USER_EMAIL_EXISTS", "Email already exists.");
    }
    private static SysUser entity(UserWriteRequest request)
    {
        SysUser user = new SysUser(); user.setUserName(request.username()); user.setNickName(request.displayName());
        user.setDeptId(request.departmentId() == null ? null : identifier(request.departmentId()));
        user.setEmail(request.email() == null ? "" : request.email()); user.setPhonenumber(request.phone() == null ? "" : request.phone());
        user.setSex(request.sex()); user.setStatus(request.status()); user.setRemark(request.remark() == null ? "" : request.remark());
        user.setRoleIds(identifiers(request.roleIds())); user.setPostIds(identifiers(request.postIds())); return user;
    }
    private static SysUser filter(String username, String phone, String status, String departmentId, String begin, String end)
    {
        SysUser user = new SysUser(); user.setUserName(username); user.setPhonenumber(phone); user.setStatus(status);
        if (departmentId != null) user.setDeptId(identifier(departmentId));
        try
        {
            LocalDate first = begin.isEmpty() ? null : LocalDate.parse(begin);
            LocalDate last = end.isEmpty() ? null : LocalDate.parse(end);
            if (first != null && last != null && first.isAfter(last)) throw failure(400, "VALIDATION_ERROR", "The date range is reversed.");
            if (first != null) user.getParams().put("beginTime", first.toString());
            if (last != null) user.getParams().put("endTime", last.toString());
        }
        catch (DateTimeParseException exception) { throw failure(400, "VALIDATION_ERROR", "The date is invalid."); }
        return user;
    }
    private static Long[] identifiers(List<String> values)
    {
        Long[] ids = values.stream().map(UserController::identifier).toArray(Long[]::new);
        if (new HashSet<>(Arrays.asList(ids)).size() != ids.length) throw failure(400, "VALIDATION_ERROR", "Identifiers must be distinct.");
        return ids;
    }
    private static Long identifier(String value)
    {
        try { return Long.valueOf(value); }
        catch (NumberFormatException exception) { throw failure(400, "VALIDATION_ERROR", "The identifier is invalid."); }
    }
    private static ApiFailure missing() { return failure(404, "USER_NOT_FOUND", "User does not exist."); }
    private static ApiFailure conflict() { return failure(409, "USER_CONFLICT", "Login name, phone or email already exists."); }
    private static ApiFailure failure(int status, String code, String detail) { return new ApiFailure(status, code, detail); }
}
