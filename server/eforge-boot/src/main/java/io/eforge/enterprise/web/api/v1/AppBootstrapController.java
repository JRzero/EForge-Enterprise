package io.eforge.enterprise.web.api.v1;

import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.eforge.enterprise.common.core.domain.entity.SysMenu;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.navigation.NavigationNode;
import io.eforge.enterprise.system.navigation.NavigationProjectionService;
import io.eforge.enterprise.system.service.ISysMenuService;

@RestController
@RequestMapping("/api/v1/app")
public class AppBootstrapController
{
    @Autowired
    private ISysMenuService menuService;

    @Autowired
    private SysPermissionService permissionService;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private NavigationProjectionService navigationProjectionService;

    @GetMapping("/bootstrap")
    public AppBootstrapResponse bootstrap()
    {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        SysUser user = loginUser.getUser();

        Set<String> roles = permissionService.getRolePermission(user);
        Set<String> permissions = permissionService.getMenuPermission(user);
        if (!loginUser.getPermissions().equals(permissions))
        {
            loginUser.setPermissions(permissions);
            tokenService.refreshToken(loginUser);
        }

        List<SysMenu> menus = menuService.selectMenuTreeByUserId(user.getUserId());
        List<NavigationNode> navigation = navigationProjectionService.project(menus);

        return new AppBootstrapResponse(
                new AppUserResponse(
                        String.valueOf(user.getUserId()),
                        user.getUserName(),
                        user.getNickName()),
                roles.stream().sorted().toList(),
                permissions.stream().sorted().toList(),
                navigation);
    }
}
