package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.core.domain.entity.SysUser;

/** Concrete user administration contracts, never serialized service entities. */
public final class UserContracts
{
    private UserContracts() {}
    public record UserWriteRequest(
            @NotBlank @Size(min = 2, max = 20) @io.eforge.enterprise.common.xss.Xss String username,
            @NotBlank @Size(max = 30) @io.eforge.enterprise.common.xss.Xss String displayName,
            @Pattern(regexp = "[1-9][0-9]{0,18}") String departmentId,
            @Email @Size(max = 50) String email,
            @Pattern(regexp = "(?:1[3-9][0-9]{9})?") String phone,
            @NotNull @Pattern(regexp = "[012]") String sex,
            @NotNull @Pattern(regexp = "[01]") String status,
            @Size(max = 500) String remark,
            @NotNull @Size(max = 100) List<@NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") String> roleIds,
            @NotNull @Size(max = 100) List<@NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") String> postIds) {}

    public record CreateUserRequest(@NotNull @Valid UserWriteRequest user,
            @NotBlank @Size(min = 5, max = 20) @Pattern(regexp = "[^<>\"'|\\\\]+")
            @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String password)
    { @Override public String toString() { return "CreateUserRequest[credentials redacted]"; } }

    public record ResetUserPasswordRequest(
            @NotBlank @Size(min = 5, max = 20) @Pattern(regexp = "[^<>\"'|\\\\]+")
            @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String password)
    { @Override public String toString() { return "ResetUserPasswordRequest[credentials redacted]"; } }

    public record UserStatusRequest(@NotNull @Pattern(regexp = "[01]") String status) {}
    public record UserRolesRequest(@NotNull @Size(max = 100)
            List<@NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") String> roleIds) {}
    public record DeleteUsersRequest(@NotNull @Size(min = 1, max = 100)
            List<@NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") String> ids) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName,
            String departmentId, String departmentName, String email, String phone,
            String sex, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
            String remark, Instant createdAt)
    {
        static UserResponse from(SysUser user)
        {
            return new UserResponse(user.getUserId().toString(), user.getUserName(), user.getNickName(),
                    user.getDeptId() == null ? null : user.getDeptId().toString(),
                    user.getDept() == null ? null : user.getDept().getDeptName(), user.getEmail(),
                    user.getPhonenumber(), user.getSex(), user.getStatus(), user.getRemark(),
                    user.getCreateTime() == null ? null : user.getCreateTime().toInstant());
        }
    }
    public record UserOption(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status) {}
    public record UserEditorResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UserResponse user,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roleIds,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> postIds) {}
    public record UserOptionsResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DepartmentResponse> departments,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UserOption> roles,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UserOption> posts,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, accessMode = Schema.AccessMode.READ_ONLY) String initialPassword)
    { @Override public String toString() { return "UserOptionsResponse[initial password redacted]"; } }
}
