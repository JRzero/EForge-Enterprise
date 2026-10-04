package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.util.List;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.RoleContracts.*;

@RestController @RequestMapping("/api/v1/system/roles")
public class RoleController
{
    private final RoleService roles;
    public RoleController(RoleService roles) { this.roles=roles; }
    @GetMapping @PreAuthorize("@ss.hasPermi('system:role:list')") @Operation(operationId="listRoles")
    public PageResponse<RoleResponse> list(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=30) String name,@RequestParam(defaultValue="") @Size(max=100) String key,
            @RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status,
            @RequestParam(defaultValue="") @Size(max=10) String beginDate,@RequestParam(defaultValue="") @Size(max=10) String endDate)
    { return roles.list(page,pageSize,name,key,status,beginDate,endDate); }
    @GetMapping("/options") @PreAuthorize("@ss.hasPermi('system:role:query')") @Operation(operationId="getRoleOptions")
    public List<RoleResponse> options() { return roles.options(); }
    @GetMapping("/menus") @PreAuthorize("@ss.hasPermi('system:role:query')") @Operation(operationId="getRoleMenuOptions")
    public List<RoleMenuOption> menus() { return roles.menuOptions(); }
    @GetMapping("/departments") @PreAuthorize("@ss.hasPermi('system:role:query')") @Operation(operationId="getRoleDepartmentOptions")
    public List<DepartmentResponse> departments() { return roles.departmentOptions(); }
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:role:query')") @Operation(operationId="getRole")
    public RoleEditorResponse get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) { return roles.get(id); }
    @PostMapping @PreAuthorize("@ss.hasPermi('system:role:add')") @Operation(operationId="createRole")
    @Log(title="角色管理",businessType=BusinessType.INSERT)
    public ResponseEntity<RoleResponse> create(@Valid @RequestBody RoleWriteRequest request)
    { var role=roles.create(request);return ResponseEntity.created(URI.create("/api/v1/system/roles/"+role.id())).body(role); }
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:role:edit')") @Operation(operationId="updateRole")
    @Log(title="角色管理",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> update(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody RoleWriteRequest request)
    { roles.update(id,request);return ResponseEntity.noContent().build(); }
    @PutMapping("/{id}/status") @PreAuthorize("@ss.hasPermi('system:role:edit')") @Operation(operationId="setRoleStatus")
    @Log(title="角色管理",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> status(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody RoleStatusRequest request)
    { roles.status(id,request.status());return ResponseEntity.noContent().build(); }
    @GetMapping("/{id}/data-scope") @PreAuthorize("@ss.hasPermi('system:role:query')") @Operation(operationId="getRoleDataScope")
    public RoleScopeResponse scope(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) { return roles.scope(id); }
    @PutMapping("/{id}/data-scope") @PreAuthorize("@ss.hasPermi('system:role:edit')") @Operation(operationId="setRoleDataScope")
    @Log(title="角色数据范围",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> scope(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody RoleScopeRequest request)
    { roles.scope(id,request);return ResponseEntity.noContent().build(); }
    @DeleteMapping @PreAuthorize("@ss.hasPermi('system:role:remove')") @Operation(operationId="deleteRoles")
    @Log(title="角色管理",businessType=BusinessType.DELETE)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteRolesRequest request) { roles.delete(request);return ResponseEntity.noContent().build(); }
    @GetMapping("/{id}/users") @PreAuthorize("@ss.hasPermi('system:role:list')") @Operation(operationId="listRoleUsers")
    public PageResponse<UserContracts.UserResponse> users(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,
            @RequestParam(defaultValue="true") boolean assigned,@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=30) String username,@RequestParam(defaultValue="") @Size(max=11) String phone)
    { return roles.users(id,assigned,page,pageSize,username,phone); }
    @PutMapping("/{id}/users") @PreAuthorize("@ss.hasPermi('system:role:edit')") @Operation(operationId="assignRoleUsers")
    @Log(title="角色用户授权",businessType=BusinessType.GRANT)
    public ResponseEntity<Void> assign(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody RoleUsersRequest request)
    { roles.users(id,request,true);return ResponseEntity.noContent().build(); }
    @DeleteMapping("/{id}/users") @PreAuthorize("@ss.hasPermi('system:role:edit')") @Operation(operationId="cancelRoleUsers")
    @Log(title="角色用户授权",businessType=BusinessType.GRANT)
    public ResponseEntity<Void> cancel(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody RoleUsersRequest request)
    { roles.users(id,request,false);return ResponseEntity.noContent().build(); }
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('system:role:export')") @Operation(operationId="exportRoles")
    @ApiResponse(responseCode="200",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    @Log(title="角色管理",businessType=BusinessType.EXPORT)
    public void export(HttpServletResponse response,@RequestParam(defaultValue="") @Size(max=30) String name,
            @RequestParam(defaultValue="") @Size(max=100) String key,@RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status,
            @RequestParam(defaultValue="") @Size(max=10) String beginDate,@RequestParam(defaultValue="") @Size(max=10) String endDate)
    { new ExcelUtil<>(SysRole.class).exportExcel(response,roles.export(name,key,status,beginDate,endDate),"角色数据"); }
}
