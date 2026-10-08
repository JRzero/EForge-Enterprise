package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.Collection;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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

/** Refresh committed authorization without recreating or overwriting a newer session. */
@Service
public class RoleSessionRefresher
{
    private static final int MAX_REFRESH_ATTEMPTS = 3;

    private final RedisCache cache;
    private final ISysUserService users;
    private final NavigationMapper navigation;
    private final SysPermissionService permissions;
    private final TokenService tokens;
    private final DepartmentMutationMapper mutations;
    private final TransactionTemplate transaction;

    public RoleSessionRefresher(RedisCache cache, ISysUserService users, NavigationMapper navigation,
            SysPermissionService permissions, TokenService tokens, DepartmentMutationMapper mutations,
            PlatformTransactionManager manager)
    {
        this.cache = cache;
        this.users = users;
        this.navigation = navigation;
        this.permissions = permissions;
        this.tokens = tokens;
        this.mutations = mutations;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Shared by canonical and compatibility mutations; a rollback publishes nothing. */
    public void refreshAfterCommit(Set<Long> userIds)
    {
        Set<Long> affected = Set.copyOf(userIds);
        if (affected.isEmpty())
        {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive())
        {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization()
            {
                @Override
                public void afterCommit()
                {
                    refresh(affected);
                }
            });
        }
        else
        {
            refresh(affected);
        }
    }

    public void refresh(Set<Long> userIds)
    {
        if (userIds.isEmpty())
        {
            return;
        }
        transaction.executeWithoutResult(status -> {
            // Fresh snapshot under the shared lock: older callbacks cannot publish old DB state.
            if (mutations.lockRoot() == null)
            {
                throw new ApiFailure(409, "DEPARTMENT_ROOT_MISSING", "Root department does not exist.");
            }
            Collection<String> keys = cache.keys(CacheConstants.LOGIN_TOKEN_KEY + "*");
            if (keys != null)
            {
                for (String key : keys)
                {
                    if (key.startsWith(CacheConstants.LOGIN_TOKEN_KEY))
                    {
                        refreshSession(key.substring(CacheConstants.LOGIN_TOKEN_KEY.length()), userIds);
                    }
                }
            }
        });
    }

    private void refreshSession(String token, Set<Long> userIds)
    {
        for (int attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++)
        {
            LoginUser session = tokens.getLoginUserByToken(token);
            if (session == null || !userIds.contains(session.getUserId()))
            {
                return;
            }
            try
            {
                var user = users.selectUserById(session.getUserId());
                if (user == null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
                {
                    tokens.delLoginUser(token);
                    return;
                }
                user.setRoles(navigation.selectActiveRoles(user.getUserId()));
                session.setUser(user);
                session.setDeptId(user.getDeptId());
                session.setPermissions(user.isAdmin() || !user.getRoles().isEmpty()
                        ? permissions.getMenuPermission(user) : Set.of());
                if (tokens.updateLoginUser(session))
                {
                    return;
                }
            }
            catch (RuntimeException failure)
            {
                // The DB mutation has already committed. When this identified
                // session cannot receive fresh authority, revoke it if Redis is
                // available and preserve the original failure for the caller.
                try
                {
                    tokens.delLoginUser(token);
                }
                catch (RuntimeException revocationFailure)
                {
                    if (revocationFailure != failure)
                    {
                        failure.addSuppressed(revocationFailure);
                    }
                }
                throw failure;
            }
            // A profile/bootstrap writer may have won the CAS. Read its current
            // bytes and recompute authority; never retry using an old snapshot.
        }
        // Repeated contention must not leave withdrawn permissions usable.
        // Deletion is safe even if logout/expiry already removed this token.
        tokens.delLoginUser(token);
    }
}
