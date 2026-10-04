package io.eforge.enterprise.web.controller.api.v1;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

public record PageResponse<T>(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<T> items,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize)
{
    public PageResponse { items = List.copyOf(items); }
}
