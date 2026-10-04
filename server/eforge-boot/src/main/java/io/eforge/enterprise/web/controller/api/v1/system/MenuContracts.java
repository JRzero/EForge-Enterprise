package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public final class MenuContracts
{
    private MenuContracts() {}
    public enum Type { GROUP, ROUTE, EXTERNAL, FUNCTION }
    public record MenuWriteRequest(@NotBlank @Size(max=100) @Pattern(regexp="[a-z][a-z0-9]*(-[a-z0-9]+)*") String key,
            @NotBlank @Size(max=50) String name,@NotNull @Pattern(regexp="0|[1-9][0-9]{0,18}") String parentId,
            @NotNull @Min(0) @Max(9999) Integer sort,@NotNull Type type,
            @NotNull @Pattern(regexp="[01]") String status,@NotNull Boolean visible,
            @Size(max=100) String routeId,@Size(max=200) String externalUrl,
            @Size(max=100) String permission,@Size(max=100) String icon,@Size(max=500) String remark,
            @Size(max=200) String groupPath,@Size(max=255) String queryText,@NotNull Boolean cached) {}
    public record MenuResponse(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String parentId,String key,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String name,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int sort,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Type type,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String status,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean visible,
            String routeId,String externalUrl,String permission,String icon,String remark,String groupPath,
            String queryText,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean cached,Instant createdAt) {}
    public record MenuRouteOption(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String id,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String path,String permission) {}
    public record MenuSortItem(@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String id,@NotNull @Min(0) @Max(9999) Integer sort) {}
    public record MenuSortRequest(@NotNull @Size(min=1,max=2000) List<@NotNull @jakarta.validation.Valid MenuSortItem> items) {}
}
