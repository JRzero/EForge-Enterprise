package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.service.SysPermissionService;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;

/** Refresh only committed canonical changes, without recreating a logged-out token. */
@Service
public class RoleSessionRefresher
{
    private final RedisCache cache;
    private final ISysUserService users;
    private final NavigationMapper navigation;
    private final SysPermissionService permissions;
    private final TokenService tokens;
    private final DepartmentMutationMapper mutations;
    private final TransactionTemplate transaction;
    public RoleSessionRefresher(RedisCache cache, ISysUserService users,
            NavigationMapper navigation, SysPermissionService permissions, TokenService tokens,
            DepartmentMutationMapper mutations, PlatformTransactionManager manager)
    { this.cache=cache;this.users=users;this.navigation=navigation;this.permissions=permissions;this.tokens=tokens;this.mutations=mutations;transaction=new TransactionTemplate(manager);transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW); }
    public void refresh(Set<Long> userIds)
    {
        if (userIds.isEmpty()) return;
        transaction.executeWithoutResult(status -> {
            // Fresh snapshot under the shared lock: older callbacks cannot overwrite a newer mutation.
            if (mutations.lockRoot()==null) throw new ApiFailure(409,"DEPARTMENT_ROOT_MISSING","Root department does not exist.");
            Collection<String> keys=cache.keys(CacheConstants.LOGIN_TOKEN_KEY+"*"); if(keys==null) return;
            for(String key:keys)
            {
                if (!key.startsWith(CacheConstants.LOGIN_TOKEN_KEY)) continue;
                refreshToken(key.substring(CacheConstants.LOGIN_TOKEN_KEY.length()), userIds);
            }
        });
    }

    private void refreshToken(String token, Set<Long> userIds)
    {
        for (int attempt = 0; attempt < 4; attempt++)
        {
            LoginUser session = tokens.getLoginUserByToken(token);
            if (session == null || !userIds.contains(session.getUserId())) return;
            var user = users.selectUserById(session.getUserId());
            if (user == null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
            { tokens.delLoginUser(token); return; }
            user.setRoles(navigation.selectActiveRoles(user.getUserId()));
            session.setUser(user);
            session.setDeptId(user.getDeptId());
            session.setPermissions(user.isAdmin() || !user.getRoles().isEmpty()
                    ? permissions.getMenuPermission(user) : Set.of());
            if (tokens.updateLoginUser(session)) return;
        }
        // Sustained contention must fail closed rather than leave stale grants alive.
        tokens.delLoginUser(token);
    }

}
