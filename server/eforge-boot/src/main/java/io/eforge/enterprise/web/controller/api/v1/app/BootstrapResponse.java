package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import java.util.Set;

public record BootstrapResponse(UserSummary user, Set<String> roles, Set<String> permissions,
        List<NavigationNode> navigation)
{
    public record UserSummary(String id, String username, String displayName) { }
}
