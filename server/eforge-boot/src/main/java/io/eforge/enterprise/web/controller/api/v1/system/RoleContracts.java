package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.core.domain.entity.SysRole;

public final class RoleContracts
{
    private RoleContracts() {}
    public record RoleWriteRequest(@NotBlank @Size(max=30) String name,
            @NotBlank @Size(max=100) String key, @NotNull @Min(0) @Max(9999) Integer sort,
            @NotNull @Pattern(regexp="[01]") String status, @Size(max=500) String remark,
            @NotNull Boolean menuLinked,
            @NotNull @Size(max=2000) List<@NotBlank @Size(max=128) String> menuKeys) {}
    public record RoleScopeRequest(@NotNull @Pattern(regexp="[1-5]") String mode,
            @NotNull Boolean departmentLinked,
            @NotNull @Size(max=1000) List<@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String> departmentIds) {}
    public record RoleStatusRequest(@NotNull @Pattern(regexp="[01]") String status) {}
    public record RoleUsersRequest(@NotNull @Size(min=1,max=100)
            List<@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String> userIds) {}
    public record DeleteRolesRequest(@NotNull @Size(min=1,max=100)
            List<@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record RoleResponse(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String key,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int sort,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String status,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String dataScope,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean menuLinked,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean departmentLinked, String remark, Instant createdAt)
    {
        static RoleResponse from(SysRole role)
        { return new RoleResponse(role.getRoleId().toString(),role.getRoleName(),role.getRoleKey(),role.getRoleSort(),role.getStatus(),role.getDataScope(),role.isMenuCheckStrictly(),role.isDeptCheckStrictly(),role.getRemark(),role.getCreateTime()==null ? null : role.getCreateTime().toInstant()); }
    }
    public record RoleMenuOption(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String key,
            String parentKey, @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String label,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED,allowableValues={"M","C","F"}) String type,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int sort,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String status, String permission) {}
    public record RoleEditorResponse(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) RoleResponse role,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<String> menuKeys,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<String> checkedMenuKeys) {}
    public record RoleScopeResponse(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String mode,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean departmentLinked,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<String> departmentIds,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<String> checkedDepartmentIds,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<DepartmentResponse> departments) {}
}
