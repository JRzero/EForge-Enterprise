package io.eforge.enterprise.system.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import io.eforge.enterprise.system.domain.NavigationMenu;

/** Canonical role projections; legacy menu/component entities do not cross the API. */
public interface RoleSelectionMapper
{
    @Select("SELECT menu_id,parent_id,menu_key,route_id,menu_name AS label,order_num,menu_type,visible,status,perms,is_frame,path,icon,`query` AS query_text,is_cache FROM sys_menu ORDER BY parent_id,order_num,menu_id")
    List<NavigationMenu> menus();
    /** Grant authority comes from current roles; menu display/status semantics stay unchanged. */
    @Select("""
            SELECT DISTINCT m.menu_id
            FROM sys_menu m
            INNER JOIN sys_role_menu rm ON rm.menu_id = m.menu_id
            INNER JOIN sys_role r ON r.role_id = rm.role_id
            INNER JOIN sys_user_role ur ON ur.role_id = r.role_id
            WHERE ur.user_id = #{userId} AND r.status = '0' AND r.del_flag = '0'
            ORDER BY m.menu_id
            """)
    List<Long> grantableMenuIds(@Param("userId") Long userId);
    @Select("SELECT menu_id FROM sys_role_menu WHERE role_id=#{roleId} ORDER BY menu_id")
    List<Long> menuIds(Long roleId);
    @Select("SELECT dept_id FROM sys_role_dept WHERE role_id=#{roleId} ORDER BY dept_id")
    List<Long> departmentIds(Long roleId);
    @Select("SELECT user_id FROM sys_user_role WHERE role_id=#{roleId} ORDER BY user_id")
    List<Long> userIds(Long roleId);
}
