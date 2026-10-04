package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.*;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;

@Service
public class BootstrapService
{
    private final ISysUserService users;
    private final NavigationMapper menus;
    private final SysPermissionService permissionService;
    private final TokenService tokens;
    private final NavigationProjection projection;

    public BootstrapService(ISysUserService users, NavigationMapper menus, SysPermissionService permissionService,
            TokenService tokens, NavigationProjection projection)
    {
        this.users = users;
        this.menus = menus;
        this.permissionService = permissionService;
        this.tokens = tokens;
        this.projection = projection;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public BootstrapResponse bootstrap(LoginUser session)
    {
        SysUser user = users.selectUserById(session.getUserId());
        if (user == null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
        {
            tokens.delLoginUser(session.getToken());
            throw new CredentialsExpiredException("Account is no longer active");
        }
        List<SysRole> activeRoles = menus.selectActiveRoles(user.getUserId());
        user.setRoles(activeRoles);
        Set<String> permissions = new TreeSet<>(user.isAdmin() || !activeRoles.isEmpty()
                ? permissionService.getMenuPermission(user) : Set.of());
        Set<String> roles = new TreeSet<>();
        if (user.isAdmin()) roles.add("admin");
        else activeRoles.stream().map(SysRole::getRoleKey).filter(Objects::nonNull).forEach(roles::add);
        var navigation = projection.project(menus.selectGrantedMenus(user.getUserId(), user.isAdmin()), permissions);
        // Refresh the existing session with exactly the authorization snapshot returned.
        // Data-scope generation itself remains unchanged.
        session.setUser(user);
        session.setDeptId(user.getDeptId());
        session.setPermissions(permissions);
        tokens.setLoginUser(session);
        String displayName = user.getNickName() == null || user.getNickName().isBlank() ? user.getUserName() : user.getNickName();
        return new BootstrapResponse(new BootstrapResponse.UserSummary(user.getUserId().toString(),
                user.getUserName(), displayName), Collections.unmodifiableSet(roles),
                Collections.unmodifiableSet(permissions), navigation);
    }
}
