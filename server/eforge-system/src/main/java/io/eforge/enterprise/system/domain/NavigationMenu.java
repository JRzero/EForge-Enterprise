package io.eforge.enterprise.system.domain;

/** Flat persistence projection; never contains a component path. */
public record NavigationMenu(Long menuId, Long parentId, String menuKey, String routeId,
        String label, Integer orderNum, String menuType, String visible, String status,
        String perms, String isFrame, String path, String icon)
{
}
