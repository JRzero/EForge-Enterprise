package io.eforge.enterprise.web.api.v1;

import java.util.List;
import io.eforge.enterprise.system.navigation.NavigationNode;

public record AppBootstrapResponse(
        AppUserResponse user,
        List<String> roles,
        List<String> permissions,
        List<NavigationNode> navigation)
{
}
