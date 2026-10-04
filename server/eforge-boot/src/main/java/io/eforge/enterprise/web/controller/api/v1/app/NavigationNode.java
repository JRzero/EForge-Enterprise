package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NavigationNode(String key, Type type, String label, int order, String icon,
        @Schema(description = "Present only for ROUTE nodes") String routeId,
        @Schema(description = "Present only for EXTERNAL nodes") String externalUrl,
        List<NavigationNode> children)
{
    public enum Type { GROUP, ROUTE, EXTERNAL }

    public NavigationNode
    {
        children = List.copyOf(children);
        if (type == Type.GROUP && (routeId != null || externalUrl != null)
                || type == Type.ROUTE && (routeId == null || externalUrl != null)
                || type == Type.EXTERNAL && (routeId != null || externalUrl == null || !children.isEmpty()))
            throw new IllegalArgumentException("Invalid navigation node shape");
    }
}
