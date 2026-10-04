package io.eforge.enterprise.system.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.system.domain.NavigationMenu;

public interface NavigationMapper
{
    List<NavigationMenu> selectGrantedMenus(@Param("userId") Long userId, @Param("administrator") boolean administrator);
    List<SysRole> selectActiveRoles(Long userId);
}
