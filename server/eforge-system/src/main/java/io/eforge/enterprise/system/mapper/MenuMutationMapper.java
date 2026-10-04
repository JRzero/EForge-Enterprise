package io.eforge.enterprise.system.mapper;

import java.util.List;
import java.util.Date;
import org.apache.ibatis.annotations.*;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;

/** Canonical navigation persistence; legacy component expressions never cross this boundary. */
public interface MenuMutationMapper
{
    record Row(Long id, Long parentId, String key, String routeId, String name, Integer sort,
            String menuType, String visible, String status, String permission, String isFrame,
            String path, String icon, String remark, String queryText, String isCache, Date createdAt) {}
    @Select("SELECT menu_id AS id,parent_id,menu_key AS `key`,route_id,menu_name AS name,order_num AS sort,menu_type,visible,status,perms AS permission,is_frame,path,icon,remark,`query` AS query_text,is_cache,create_time AS created_at FROM sys_menu ORDER BY parent_id,order_num,menu_id")
    List<Row> rows();
    @Select("""
        <script>SELECT menu_id FROM sys_menu
        <where>
          <if test="name != null and name != ''">AND menu_name LIKE CONCAT('%',#{name},'%')</if>
          <if test="status != null and status != ''">AND status=#{status}</if>
          <if test="visible != null">AND visible=#{visible}</if>
        </where></script>
        """)
    List<Long> filteredIds(@Param("name") String name,@Param("status") String status,@Param("visible") String visible);
    @Select("SELECT DISTINCT rm.menu_id FROM sys_role_menu rm JOIN sys_user_role ur ON ur.role_id=rm.role_id JOIN sys_role r ON r.role_id=rm.role_id WHERE ur.user_id=#{userId} AND r.status='0' AND r.del_flag='0'")
    List<Long> grantedIds(Long userId);
    @Select("SELECT DISTINCT ur.user_id FROM sys_user_role ur JOIN sys_role_menu rm ON rm.role_id=ur.role_id WHERE rm.menu_id=#{menuId}")
    List<Long> affectedUsers(Long menuId);
    @Select("SELECT count(*) FROM sys_role_menu WHERE menu_id=#{menuId}")
    int roleCount(Long menuId);
    @Insert("INSERT INTO sys_menu(parent_id,menu_name,order_num,menu_type,visible,status,perms,is_frame,path,icon,remark,`query`,is_cache,create_by,create_time) VALUES(#{parentId},#{menuName},#{orderNum},#{menuType},#{visible},#{status},#{perms},#{isFrame},#{path},#{icon},#{remark},#{query},#{isCache},#{createBy},sysdate())")
    @Options(useGeneratedKeys=true,keyProperty="menuId",keyColumn="menu_id")
    int insert(SysMenu menu);
    @Update("UPDATE sys_menu SET menu_key=#{key},route_id=#{routeId},menu_name=#{name},parent_id=#{parentId},order_num=#{sort},menu_type=#{menuType},visible=#{visible},status=#{status},perms=#{permission},is_frame=#{isFrame},path=#{path},icon=#{icon},remark=#{remark},`query`=#{queryText},is_cache=#{isCache},update_by=#{actor},update_time=sysdate() WHERE menu_id=#{id}")
    int update(@Param("id") Long id,@Param("parentId") Long parentId,@Param("key") String key,@Param("routeId") String routeId,
            @Param("name") String name,@Param("sort") Integer sort,@Param("menuType") String menuType,@Param("visible") String visible,
            @Param("status") String status,@Param("permission") String permission,@Param("isFrame") String isFrame,@Param("path") String path,
            @Param("icon") String icon,@Param("remark") String remark,@Param("queryText") String queryText,@Param("isCache") String isCache,@Param("actor") String actor);
}
