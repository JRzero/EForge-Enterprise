package io.eforge.enterprise.system.navigation;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NavigationNode(
        String key,
        NavigationNodeType type,
        String routeId,
        String label,
        Integer order,
        String icon,
        String externalUrl,
        List<NavigationNode> children)
{
}
