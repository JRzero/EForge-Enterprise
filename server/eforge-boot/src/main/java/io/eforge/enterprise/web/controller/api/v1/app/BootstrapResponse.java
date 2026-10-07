package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import java.util.Set;
import io.swagger.v3.oas.annotations.media.Schema;

public record BootstrapResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UserSummary user,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Set<String> roles,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Set<String> permissions,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<NavigationNode> navigation)
{
    public record UserSummary(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName, String avatarUrl) { }
}
