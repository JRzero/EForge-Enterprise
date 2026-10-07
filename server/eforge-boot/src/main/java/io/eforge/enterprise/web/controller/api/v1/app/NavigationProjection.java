package io.eforge.enterprise.web.controller.api.v1.app;

import java.net.URI;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.system.domain.NavigationMenu;

/** Projects only granted rows, without interpreting database component strings. */
@Component
public class NavigationProjection
{
    private static final Logger log = LoggerFactory.getLogger(NavigationProjection.class);
    private static final String ID_PATTERN = "[a-z][a-z0-9]*(-[a-z0-9]+)*";

    public List<NavigationNode> project(List<NavigationMenu> menus, Set<String> permissions)
    {
        Map<Long, NavigationMenu> byId = new HashMap<>();
        Set<String> keys = new HashSet<>();
        Set<String> routes = new HashSet<>();
        for (NavigationMenu menu : menus)
        {
            if (menu.menuId() == null || byId.put(menu.menuId(), menu) != null
                    || menu.menuKey() != null && !keys.add(menu.menuKey())
                    || menu.routeId() != null && !routes.add(menu.routeId()))
                throw new IllegalStateException("Duplicate navigation identity");
        }
        // Validate disconnected cycles too; never recurse into an unbounded graph.
        for (NavigationMenu menu : menus)
        {
            Set<Long> ancestors = new HashSet<>();
            NavigationMenu cursor = menu;
            while (cursor != null)
            {
                if (!ancestors.add(cursor.menuId()) || ancestors.size() > 64)
                    throw new IllegalStateException("Invalid navigation hierarchy");
                cursor = byId.get(cursor.parentId());
            }
        }
        Map<Long, List<NavigationMenu>> children = new HashMap<>();
        for (NavigationMenu menu : menus)
            children.computeIfAbsent(menu.parentId(), ignored -> new ArrayList<>()).add(menu);
        children.values().forEach(list -> list.sort(Comparator.comparing(NavigationMenu::orderNum,
                Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(NavigationMenu::menuId)));
        return build(0L, children, permissions);
    }

    private List<NavigationNode> build(Long parent, Map<Long, List<NavigationMenu>> children, Set<String> permissions)
    {
        List<NavigationNode> result = new ArrayList<>();
        for (NavigationMenu menu : children.getOrDefault(parent, List.of()))
        {
            if (!"0".equals(menu.status()) || !"0".equals(menu.visible()) || !validId(menu.menuKey())
                    || !hasPermission(menu.perms(), permissions))
                continue;
            NavigationNode.Type type;
            String route = null;
            String external = null;
            List<NavigationNode> descendants;
            if ("0".equals(menu.isFrame()) || isHttp(menu.path()))
            {
                if (!safeExternal(menu.path()) || menu.routeId() != null)
                {
                    log.warn("Omitting invalid external navigation node {}", menu.menuKey());
                    continue;
                }
                type = NavigationNode.Type.EXTERNAL;
                external = menu.path();
                descendants = List.of();
            }
            else if ("M".equals(menu.menuType()))
            {
                if (menu.routeId() != null)
                    throw new IllegalStateException("Group cannot bind a route");
                type = NavigationNode.Type.GROUP;
                descendants = build(menu.menuId(), children, permissions);
                if (descendants.isEmpty()) continue;
            }
            else if ("C".equals(menu.menuType()))
            {
                if (!validId(menu.routeId()))
                {
                    log.debug("Omitting unbound navigation node {}", menu.menuKey());
                    continue;
                }
                type = NavigationNode.Type.ROUTE;
                route = menu.routeId();
                descendants = build(menu.menuId(), children, permissions);
            }
            else continue;
            result.add(new NavigationNode(menu.menuKey(), type, menu.label(),
                    menu.orderNum() == null ? 0 : menu.orderNum(), menu.icon(), route, external, descendants,
                    type == NavigationNode.Type.ROUTE ? !"1".equals(menu.isCache()) : null,
                    type == NavigationNode.Type.ROUTE ? menu.queryText() : null));
        }
        return List.copyOf(result);
    }

    private boolean validId(String value) { return value != null && value.length() <= 100 && value.matches(ID_PATTERN); }
    private boolean hasPermission(String required, Set<String> permissions)
    {
        return required == null || required.isBlank() || permissions.contains("*:*:*")
                || Arrays.stream(required.split(",")).map(String::trim).filter(value -> !value.isEmpty()).anyMatch(permissions::contains);
    }
    private boolean isHttp(String path)
    {
        return path != null && (path.startsWith("https://") || path.startsWith("http://"));
    }
    private boolean safeExternal(String path)
    {
        try
        {
            URI uri = URI.create(path);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        }
        catch (IllegalArgumentException | NullPointerException exception) { return false; }
    }
}
