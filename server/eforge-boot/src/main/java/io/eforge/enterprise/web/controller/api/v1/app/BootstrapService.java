package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.*;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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
    private final PasswordStatusService passwords;
    private final TransactionTemplate transaction;
    public BootstrapService(ISysUserService users, NavigationMapper menus, SysPermissionService permissionService,
            TokenService tokens, NavigationProjection projection, PasswordStatusService passwords, PlatformTransactionManager manager)
    {
        this.users=users;this.menus=menus;this.permissionService=permissionService;this.tokens=tokens;
        this.projection=projection;this.passwords=passwords;
        transaction=new TransactionTemplate(manager);transaction.setReadOnly(true);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }
    public BootstrapResponse bootstrap(LoginUser session)
    {
        var result=transaction.execute(status->snapshot(session,true));var response=result.response();
        return new BootstrapResponse(response.user(),response.roles(),response.permissions(),response.navigation(),
                passwords.read(result.passwordUpdated()==null ? null : new Date(result.passwordUpdated())));
    }
    /** Diagnostic resources do not revive/extend sessions or load password configuration. */
    public BootstrapResponse refreshConsoleAuthorization(LoginUser session)
    {return transaction.execute(status->snapshot(session,false)).response();}
    private ReadSnapshot snapshot(LoginUser session, boolean persistSession)
    {
        SysUser user=users.selectUserById(session.getUserId());
        if(user==null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
        {tokens.delLoginUser(session.getToken());throw new CredentialsExpiredException("Account is no longer active");}
        var activeRoles=menus.selectActiveRoles(user.getUserId());user.setRoles(activeRoles);
        Set<String> permissions=new TreeSet<>(user.isAdmin() || !activeRoles.isEmpty()
                ? permissionService.getMenuPermission(user) : Set.of());
        Set<String> roles=new TreeSet<>();
        if(user.isAdmin())roles.add("admin");
        else activeRoles.stream().map(role->role.getRoleKey()).filter(Objects::nonNull).forEach(roles::add);
        var navigation=projection.project(menus.selectGrantedMenus(user.getUserId(),user.isAdmin()),permissions);
        // Same authoritative SQL authorization snapshot; data-scope generation stays unchanged.
        session.setUser(user);session.setDeptId(user.getDeptId());session.setPermissions(permissions);
        if(persistSession)tokens.setLoginUser(session);
        String displayName=user.getNickName()==null || user.getNickName().isBlank() ? user.getUserName() : user.getNickName();
        return new ReadSnapshot(new BootstrapResponse(new BootstrapResponse.UserSummary(user.getUserId().toString(),
                user.getUserName(),displayName,safeAvatar(user.getAvatar())),Collections.unmodifiableSet(roles),
                Collections.unmodifiableSet(permissions),navigation,null),user.getPwdUpdateDate()==null ? null : user.getPwdUpdateDate().getTime());
    }
    private static String safeAvatar(String url)
    {return url!=null && url.matches("/profile/[A-Za-z0-9/_-]+\\.[A-Za-z0-9]+") ? url : null;}
    private record ReadSnapshot(BootstrapResponse response, Long passwordUpdated) {}
}