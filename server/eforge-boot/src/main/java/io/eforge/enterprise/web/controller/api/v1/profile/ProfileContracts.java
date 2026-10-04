package io.eforge.enterprise.web.controller.api.v1.profile;

import java.time.Instant;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.xss.Xss;

public final class ProfileContracts
{
    private ProfileContracts() {}
    public record ProfileResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName,
            String email, String phone, String sex, String avatarUrl, String departmentName,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String roleNames,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String postNames, Instant createdAt) {}
    public record UpdateProfileRequest(@NotBlank @Size(max = 30) @Xss String displayName,
            @NotBlank @Email @Size(max = 50) String email,
            @NotBlank @Pattern(regexp = "1[3-9][0-9]{9}") String phone,
            @NotNull @Pattern(regexp = "[012]") String sex) {}
    public record ChangePasswordRequest(
            @NotBlank @Size(max = 200) @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String oldPassword,
            @NotBlank @Size(min = 6, max = 20) @Pattern(regexp = "[^<>\"'|\\\\]+")
            @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String newPassword)
    { @Override public String toString() { return "ChangePasswordRequest[credentials redacted]"; } }
    public record AvatarResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String avatarUrl) {}
}
