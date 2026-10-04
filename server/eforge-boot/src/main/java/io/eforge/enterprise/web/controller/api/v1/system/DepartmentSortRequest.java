package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public record DepartmentSortRequest(
        @NotNull @Size(min = 1, max = 1000) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<@NotNull @Valid Item> items)
{
    public record Item(
            @NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @NotNull @Min(0) @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer sort)
    {}
}
