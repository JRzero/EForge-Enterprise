package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NavigationNode(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String key,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Type type,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int order, String icon,
        @Schema(description = "Present only for ROUTE nodes") String routeId,
        @Schema(description = "Present only for EXTERNAL nodes") String externalUrl,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<NavigationNode> children,
        @Schema(description = "ROUTE cache preference; absent for navigation groups and external links") Boolean cached,
        @Schema(description = "ROUTE default query JSON, retained as data and never interpreted as a component") String queryText)
{
    public NavigationNode(String key, Type type, String label, int order, String icon,
            String routeId, String externalUrl, List<NavigationNode> children)
    { this(key,type,label,order,icon,routeId,externalUrl,children,null,null); }
    public enum Type { GROUP, ROUTE, EXTERNAL }

    public NavigationNode
    {
        children = List.copyOf(children);
        if (type != Type.ROUTE && (cached != null || queryText != null))
            throw new IllegalArgumentException("Only route nodes have query/cache metadata");
        if (type == Type.GROUP && (routeId != null || externalUrl != null)
                || type == Type.ROUTE && (routeId == null || externalUrl != null)
                || type == Type.EXTERNAL && (routeId != null || externalUrl == null || !children.isEmpty()))
            throw new IllegalArgumentException("Invalid navigation node shape");
    }
}
