package io.eforge.enterprise.system.domain;

import org.apache.ibatis.annotations.AutomapConstructor;
/** Flat persistence projection; never contains a component path. */
public record NavigationMenu(Long menuId, Long parentId, String menuKey, String routeId,
        String label, Integer orderNum, String menuType, String visible, String status,
        String perms, String isFrame, String path, String icon, String queryText, String isCache)
{
    @AutomapConstructor public NavigationMenu {}
    public NavigationMenu(Long menuId, Long parentId, String menuKey, String routeId,
            String label, Integer orderNum, String menuType, String visible, String status,
            String perms, String isFrame, String path, String icon)
    { this(menuId,parentId,menuKey,routeId,label,orderNum,menuType,visible,status,perms,isFrame,path,icon,null,null); }
}