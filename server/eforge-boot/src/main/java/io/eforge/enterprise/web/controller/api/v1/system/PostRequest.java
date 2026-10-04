package io.eforge.enterprise.web.controller.api.v1.system;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public record PostRequest(
        @NotBlank @Size(max = 64) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String code,
        @NotBlank @Size(max = 50) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @NotNull @Min(0) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer sort,
        @NotNull @Pattern(regexp = "[01]") @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
        @Size(max = 500) String remark)
{}
