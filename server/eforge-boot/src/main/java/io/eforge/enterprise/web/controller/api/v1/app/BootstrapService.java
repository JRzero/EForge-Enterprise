package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.*;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.AuthorizationSnapshotService;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.NavigationMapper;

@Service
public class BootstrapService
{
    private final AuthorizationSnapshotService authorization;
    private final NavigationMapper menus;
    private final TokenService tokens;
    private final NavigationProjection projection;
    private final PasswordStatusService passwords;
    public BootstrapService(AuthorizationSnapshotService authorization, NavigationMapper menus,
            TokenService tokens, NavigationProjection projection, PasswordStatusService passwords)
    {
        this.authorization=authorization;this.menus=menus;this.tokens=tokens;
        this.projection=projection;this.passwords=passwords;
    }
    public BootstrapResponse bootstrap(LoginUser session)
    {
        var result=load(session,true);var response=result.response();
        return new BootstrapResponse(response.user(),response.roles(),response.permissions(),response.navigation(),
                passwords.read(result.passwordUpdated()==null ? null : new Date(result.passwordUpdated())));
    }
    /** Diagnostic resources do not revive/extend sessions or load password configuration. */
    public BootstrapResponse refreshConsoleAuthorization(LoginUser session)
    {return load(session,false).response();}
    private ReadSnapshot load(LoginUser session, boolean persistSession)
    {
        ReadSnapshot result;
        try { result=authorization.read(session.getUserId(),this::project); }
        catch(ApiFailure failure) {
            if(failure.status()==401) tokens.delLoginUser(session.getToken());
            throw failure;
        }
        // The complete primary read has ended; no Redis I/O holds a SQL connection.
        result.authorization().applyTo(session);
        if(persistSession) tokens.setLoginUser(session);
        return result;
    }
    private ReadSnapshot project(AuthorizationSnapshotService.Snapshot snapshot)
    {
        SysUser user=snapshot.user();var activeRoles=user.getRoles();
        Set<String> permissions=new TreeSet<>(snapshot.permissions());
        Set<String> roles=new TreeSet<>();
        if(user.isAdmin())roles.add("admin");
        else activeRoles.stream().map(role->role.getRoleKey()).filter(Objects::nonNull).forEach(roles::add);
        var navigation=projection.project(menus.selectGrantedMenus(user.getUserId(),user.isAdmin()),permissions);
        String displayName=user.getNickName()==null || user.getNickName().isBlank() ? user.getUserName() : user.getNickName();
        return new ReadSnapshot(new BootstrapResponse(new BootstrapResponse.UserSummary(user.getUserId().toString(),
                user.getUserName(),displayName,safeAvatar(user.getAvatar())),Collections.unmodifiableSet(roles),
                Collections.unmodifiableSet(permissions),navigation,null),user.getPwdUpdateDate()==null ? null : user.getPwdUpdateDate().getTime(),snapshot);
    }
    private static String safeAvatar(String url)
    {return url!=null && url.matches("/profile/[A-Za-z0-9/_-]+\\.[A-Za-z0-9]+") ? url : null;}
    private record ReadSnapshot(BootstrapResponse response, Long passwordUpdated, AuthorizationSnapshotService.Snapshot authorization) {}
}
