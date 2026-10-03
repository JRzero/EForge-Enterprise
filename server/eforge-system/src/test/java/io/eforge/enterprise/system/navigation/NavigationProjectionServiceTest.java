package io.eforge.enterprise.system.navigation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.List;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;

class NavigationProjectionServiceTest
{
    private final NavigationProjectionService service = new NavigationProjectionService();

    @Test
    void projectsOnlyCanonicalVisibleNavigation()
    {
        SysMenu users = menu(100L, "Users", "C", "system-users", "system-users", 1);
        SysMenu legacy = menu(101L, "Legacy", "C", null, null, 2);
        SysMenu system = menu(1L, "System", "M", "system", null, 1);
        system.setChildren(List.of(users, legacy));

        List<NavigationNode> navigation = service.project(List.of(system));

        assertEquals(1, navigation.size());
        NavigationNode group = navigation.get(0);
        assertEquals(NavigationNodeType.GROUP, group.type());
        assertEquals("system", group.key());
        assertEquals(1, group.children().size());
        assertEquals("system-users", group.children().get(0).routeId());
    }

    @Test
    void promotesMappedChildrenOfLegacyParentsAndOmitsHiddenRows()
    {
        SysMenu child = menu(500L, "Operation logs", "C", "system-operation-logs",
                "system-operation-logs", 1);
        SysMenu legacyParent = menu(108L, "Legacy logs", "M", null, null, 1);
        legacyParent.setChildren(List.of(child));

        SysMenu hidden = menu(501L, "Hidden", "C", "hidden", "hidden", 2);
        hidden.setVisible("1");

        List<NavigationNode> navigation = service.project(List.of(legacyParent, hidden));

        assertEquals(1, navigation.size());
        assertEquals("system-operation-logs", navigation.get(0).key());
        assertTrue(navigation.get(0).children().isEmpty());
    }

    private SysMenu menu(Long id, String label, String type, String key, String routeId, int order)
    {
        SysMenu menu = new SysMenu();
        menu.setMenuId(id);
        menu.setMenuName(label);
        menu.setMenuType(type);
        menu.setMenuKey(key);
        menu.setRouteId(routeId);
        menu.setOrderNum(order);
        menu.setStatus("0");
        menu.setVisible("0");
        menu.setIsFrame("1");
        menu.setChildren(List.of());
        return menu;
    }
}
