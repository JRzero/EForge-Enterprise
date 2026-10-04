package io.eforge.enterprise.web.controller.api.v1.system;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public record DepartmentRequest(
        @NotNull @Pattern(regexp = "0|[1-9][0-9]{0,18}") @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String parentId,
        @NotBlank @Size(max = 30) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @NotNull @Min(0) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer sort,
        @Size(max = 20) String leader,
        @Size(max = 11) String phone,
        @Email @Size(max = 50) String email,
        @NotNull @Pattern(regexp = "[01]") @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status)
{}
