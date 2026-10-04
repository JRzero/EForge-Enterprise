package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public record DeletePostsRequest(
        @NotNull @Size(min = 1, max = 100) @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        List<@NotNull @Pattern(regexp = "[1-9][0-9]{0,18}") String> ids)
{}
