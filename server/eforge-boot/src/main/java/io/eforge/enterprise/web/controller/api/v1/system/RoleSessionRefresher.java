package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.Collection;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.SessionIndexService;
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
    private static final int PUBLICATION_BATCH_SIZE = 32;

    private final SessionIndexService sessionIndex;
    private final ISysUserService users;
    private final NavigationMapper navigation;
    private final SysPermissionService permissions;
    private final TokenService tokens;
    private final DepartmentMutationMapper mutations;
    private final TransactionTemplate transaction;

    public RoleSessionRefresher(SessionIndexService sessionIndex, ISysUserService users, NavigationMapper navigation,
            SysPermissionService permissions, TokenService tokens, DepartmentMutationMapper mutations,
            PlatformTransactionManager manager)
    {
        this.sessionIndex = sessionIndex;
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
        // Enumeration and unrelated/expired session reads need no IAM row lock.
        // Complete enumeration first; a failed cursor must not publish a partial batch.
        Collection<String> keys = sessionIndex.sessionKeys(userIds);
        if (keys != null)
        {
            List<String> batch = new ArrayList<>(PUBLICATION_BATCH_SIZE);
            for (String key : keys)
            {
                if (key.startsWith(CacheConstants.LOGIN_TOKEN_KEY))
                {
                    batch.add(key.substring(CacheConstants.LOGIN_TOKEN_KEY.length()));
                    if (batch.size() == PUBLICATION_BATCH_SIZE)
                    {
                        refreshBatch(batch, userIds);
                        batch.clear();
                    }
                }
            }
            refreshBatch(batch, userIds);
        }
    }

    private void refreshBatch(List<String> candidates, Set<Long> userIds)
    {
        List<String> pending = candidates;
        for (int attempt = 0; attempt < MAX_REFRESH_ATTEMPTS && !pending.isEmpty(); attempt++)
        {
            List<LoginUser> sessions = new ArrayList<>(pending.size());
            for (String token : pending)
            {
                LoginUser session = tokens.getLoginUserByToken(token);
                if (session != null && userIds.contains(session.getUserId())) sessions.add(session);
            }
            if (sessions.isEmpty())
            {
                return;
            }
            pending = transaction.execute(status -> {
                if (mutations.lockRoot() == null)
                {
                    throw new ApiFailure(409, "DEPARTMENT_ROOT_MISSING", "Root department does not exist.");
                }
                List<String> conflicts = new ArrayList<>();
                for (LoginUser session : sessions)
                {
                    if (!publish(session.getToken(), session)) conflicts.add(session.getToken());
                }
                return conflicts;
            });
            // Release the lock before reading conflicts; the next bounded batch
            // gets a new SQL view. At most 32 session snapshots are retained here.
        }
        // Repeated contention fails closed without recreating any session.
        for (String token : pending) tokens.delLoginUser(token);
    }

    private boolean publish(String token, LoginUser session)
    {
        // Keep the lock through CAS/revocation: another IAM mutation cannot commit
        // between this SQL read and publication of its authority into Redis.
        try
        {
            var user = users.selectUserById(session.getUserId());
            if (user == null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
            {
                tokens.delLoginUser(token);
                return true;
            }
            user.setRoles(navigation.selectActiveRoles(user.getUserId()));
            session.setUser(user);
            session.setDeptId(user.getDeptId());
            session.setPermissions(user.isAdmin() || !user.getRoles().isEmpty()
                    ? permissions.getMenuPermission(user) : Set.of());
            return tokens.updateLoginUser(session);
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
    }
}
