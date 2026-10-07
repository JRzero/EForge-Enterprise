package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.system.domain.NavigationMenu;
import static org.junit.jupiter.api.Assertions.*;

class NavigationProjectionTest
{
    private final NavigationProjection projection = new NavigationProjection();
    private NavigationMenu menu(long id, long parent, String key, String route, String type,
            String visible, String status, String permission, String path, String frame)
    {
        return new NavigationMenu(id, parent, key, route, key, (int) id, type, visible, status,
                permission, frame, path, "icon");
    }
    private NavigationMenu group(long id, long parent, String key)
    {
        return menu(id, parent, key, null, "M", "0", "0", "", key, "1");
    }
    private NavigationMenu route(long id, long parent, String key, String permission)
    {
        return menu(id, parent, key, key, "C", "0", "0", permission, "legacy-path", "1");
    }

    @Test void projectsGroupsWithoutFakeRoutesAndSortsChildren()
    {
        var nodes = projection.project(List.of(route(3, 1, "system-roles", "role:list"),
                route(2, 1, "system-users", "user:list"), group(1, 0, "system")), Set.of("*:*:*"));
        assertEquals(NavigationNode.Type.GROUP, nodes.get(0).type());
        assertNull(nodes.get(0).routeId());
        assertEquals(List.of("system-users", "system-roles"), nodes.get(0).children().stream().map(NavigationNode::routeId).toList());
    }
    @Test void prunesUnauthorizedHiddenDisabledAndUnboundRoutes()
    {
        var menus = List.of(group(1, 0, "system"), route(2, 1, "allowed", "user:list"),
                route(3, 1, "denied", "role:list"),
                menu(4, 1, "hidden", "hidden", "C", "1", "0", "", "hidden", "1"),
                menu(5, 1, "disabled", "disabled", "C", "0", "1", "", "disabled", "1"),
                menu(6, 1, "unbound", null, "C", "0", "0", "", "unbound", "1"));
        assertEquals(List.of("allowed"), projection.project(menus, Set.of("user:list")).get(0).children().stream().map(NavigationNode::key).toList());
    }
    @Test void hiddenOrMissingAncestorsCannotPromoteChildren()
    {
        assertTrue(projection.project(List.of(route(2, 99, "orphan", "")), Set.of()).isEmpty());
        assertTrue(projection.project(List.of(menu(1, 0, "hidden", null, "M", "1", "0", "", "system", "1"),
                route(2, 1, "child", "")), Set.of()).isEmpty());
        assertTrue(projection.project(List.of(group(1, 0, "empty")), Set.of()).isEmpty());
    }
    @Test void validatesDisconnectedCyclesAndDuplicateIdentities()
    {
        assertThrows(IllegalStateException.class, () -> projection.project(List.of(group(1, 2, "a"), group(2, 1, "b")), Set.of()));
        assertThrows(IllegalStateException.class, () -> projection.project(List.of(group(1, 0, "same"), group(2, 0, "same")), Set.of()));
        assertThrows(IllegalStateException.class, () -> projection.project(List.of(route(1, 0, "same", ""),
                menu(2, 0, "other", "same", "C", "0", "0", "", "path", "1")), Set.of()));
    }
    @Test void onlyExplicitHttpLinksBecomeExternalLeafNodes()
    {
        var external = menu(1, 0, "docs", null, "M", "0", "0", "", "https://example.com/docs", "0");
        var nodes = projection.project(List.of(external, route(2, 1, "ignored-child", "")), Set.of());
        assertEquals(NavigationNode.Type.EXTERNAL, nodes.get(0).type());
        assertEquals("https://example.com/docs", nodes.get(0).externalUrl());
        assertNull(nodes.get(0).routeId());
        assertTrue(nodes.get(0).children().isEmpty());
        for (String unsafe : List.of("javascript:alert(1)", "//example.com", "https://user:password@example.com", "https://"))
            assertTrue(projection.project(List.of(menu(1, 0, "bad", null, "M", "0", "0", "", unsafe, "0")), Set.of()).isEmpty());
    }
    @Test void rejectsGroupRouteBindingsAndInvalidIdentifiers()
    {
        assertThrows(IllegalStateException.class, () -> projection.project(List.of(menu(1, 0, "system", "fake-route", "M", "0", "0", "", "system", "1")), Set.of()));
        assertTrue(projection.project(List.of(route(1, 0, "Invalid-ID", "")), Set.of()).isEmpty());
        assertThrows(IllegalArgumentException.class, () -> new NavigationNode("system", NavigationNode.Type.GROUP,
                "System", 0, null, "fake", null, List.of()));
    }
    @Test void routeMetadataPreservesOriginalQueryDataAndCacheConventionOnlyAfterAuthorization()
    {
        String query = "{\"id\":\"9007199254740999\",\"__proto__\":\"literal\"}";
        var row = new NavigationMenu(2L,0L,"roles","system-roles","Roles",2,"C","0","0",
                "role:list","1","role","peoples",query,"1");
        assertTrue(projection.project(List.of(row),Set.of()).isEmpty());
        var node = projection.project(List.of(row),Set.of("role:list")).get(0);
        assertEquals(query,node.queryText()); assertEquals(Boolean.FALSE,node.cached());
        assertEquals(Boolean.TRUE,projection.project(List.of(route(3,0,"users","")),Set.of()).get(0).cached());
        var group = projection.project(List.of(group(1,0,"system"),route(3,1,"users","")),Set.of()).get(0);
        assertNull(group.cached()); assertNull(group.queryText());
        assertThrows(IllegalArgumentException.class,()->new NavigationNode("system",NavigationNode.Type.GROUP,
                "System",0,null,null,null,List.of(),true,query));
    }
}
