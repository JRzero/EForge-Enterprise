package io.eforge.enterprise.system.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Select;
import io.eforge.enterprise.system.domain.NavigationMenu;

/** Canonical role projections; legacy menu/component entities do not cross the API. */
public interface RoleSelectionMapper
{
    @Select("SELECT menu_id,parent_id,menu_key,route_id,menu_name AS label,order_num,menu_type,visible,status,perms,is_frame,path,icon,`query` AS query_text,is_cache FROM sys_menu ORDER BY parent_id,order_num,menu_id")
    List<NavigationMenu> menus();
    @Select("SELECT menu_id FROM sys_role_menu WHERE role_id=#{roleId} ORDER BY menu_id")
    List<Long> menuIds(Long roleId);
    @Select("SELECT dept_id FROM sys_role_dept WHERE role_id=#{roleId} ORDER BY dept_id")
    List<Long> departmentIds(Long roleId);
    @Select("SELECT user_id FROM sys_user_role WHERE role_id=#{roleId} ORDER BY user_id")
    List<Long> userIds(Long roleId);
}
