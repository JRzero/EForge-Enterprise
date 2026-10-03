package io.eforge.enterprise.system.navigation;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.constant.UserConstants;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;
import io.eforge.enterprise.common.utils.StringUtils;

@Service
public class NavigationProjectionService
{
    public List<NavigationNode> project(List<SysMenu> menus)
    {
        List<NavigationNode> result = new ArrayList<>();
        if (menus == null)
        {
            return result;
        }

        for (SysMenu menu : menus)
        {
            result.addAll(projectMenu(menu));
        }

        result.sort(Comparator
                .comparing(NavigationNode::order, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(NavigationNode::key));
        return result;
    }

    private List<NavigationNode> projectMenu(SysMenu menu)
    {
        if (menu == null || !UserConstants.NORMAL.equals(menu.getStatus())
                || !UserConstants.NORMAL.equals(menu.getVisible()))
        {
            return List.of();
        }

        List<NavigationNode> children = project(menu.getChildren());

        // Unmapped upstream rows are migration-only. Promote mapped descendants
        // so one legacy parent cannot hide canonical EForge routes.
        if (StringUtils.isEmpty(menu.getMenuKey()))
        {
            return children;
        }

        if (UserConstants.YES_FRAME.equals(menu.getIsFrame()) && StringUtils.ishttp(menu.getPath()))
        {
            return List.of(new NavigationNode(
                    menu.getMenuKey(),
                    NavigationNodeType.EXTERNAL,
                    null,
                    menu.getMenuName(),
                    menu.getOrderNum(),
                    normalizeIcon(menu.getIcon()),
                    menu.getPath(),
                    List.of()));
        }

        if (UserConstants.TYPE_DIR.equals(menu.getMenuType()))
        {
            if (children.isEmpty())
            {
                return List.of();
            }

            return List.of(new NavigationNode(
                    menu.getMenuKey(),
                    NavigationNodeType.GROUP,
                    null,
                    menu.getMenuName(),
                    menu.getOrderNum(),
                    normalizeIcon(menu.getIcon()),
                    null,
                    children));
        }

        if (UserConstants.TYPE_MENU.equals(menu.getMenuType()) && StringUtils.isNotEmpty(menu.getRouteId()))
        {
            return List.of(new NavigationNode(
                    menu.getMenuKey(),
                    NavigationNodeType.ROUTE,
                    menu.getRouteId(),
                    menu.getMenuName(),
                    menu.getOrderNum(),
                    normalizeIcon(menu.getIcon()),
                    null,
                    children));
        }

        return children;
    }

    private String normalizeIcon(String icon)
    {
        return StringUtils.isEmpty(icon) || "#".equals(icon) ? null : icon;
    }
}
