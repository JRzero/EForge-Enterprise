package io.eforge.enterprise.framework.web.service;

import java.util.Set;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.enums.DataSourceType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder;
import io.eforge.enterprise.system.mapper.NavigationMapper;
import io.eforge.enterprise.system.service.ISysUserService;

/** Redis proves session existence; current SQL state alone grants request authority. */
@Service
public class AuthorizationSnapshotService
{
    private final ISysUserService users;
    private final NavigationMapper navigation;
    private final SysPermissionService permissions;
    private final TransactionTemplate transaction;

    public AuthorizationSnapshotService(ISysUserService users, NavigationMapper navigation,
            SysPermissionService permissions, PlatformTransactionManager manager)
    {
        this.users = users;
        this.navigation = navigation;
        this.permissions = permissions;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        transaction.setReadOnly(true);
    }

    /** Does not write Redis, extend TTL, acquire the IAM mutation lock, or join an older read view. */
    public void refresh(LoginUser session)
    {
        if (session == null || session.getUserId() == null) throw inactive();
        read(session.getUserId(), Function.identity()).applyTo(session);
    }

    /** Final check uses the credential proof already verified by Spring, never a new password guess. */
    public void confirmLogin(LoginUser verified)
    {
        if (verified == null || verified.getUser() == null || verified.getUserId() == null
                || verified.getPassword() == null) throw inactive();
        Long identity = verified.getUserId();
        String username = verified.getUsername();
        String passwordProof = verified.getPassword();
        Snapshot current = read(identity, snapshot -> {
            if (!Objects.equals(username, snapshot.user().getUserName())
                    || !Objects.equals(passwordProof, snapshot.user().getPassword())) throw inactive();
            return snapshot;
        });
        current.applyTo(verified);
    }

    /** Internal projections such as navigation must use this same short read view. No cache writes here. */
    public <T> T read(Long userId, Function<Snapshot, T> projection)
    {
        if (userId == null) throw inactive();
        String previous = DynamicDataSourceContextHolder.getDataSourceType();
        try
        {
            // Select the primary before the transaction obtains its connection.
            DynamicDataSourceContextHolder.setDataSourceType(DataSourceType.MASTER.name());
            return transaction.execute(status -> projection.apply(readUser(userId)));
        }
        catch (DataAccessException | TransactionException failure)
        {
            ApiFailure safe = new ApiFailure(503, "AUTHORIZATION_UNAVAILABLE", "Current authorization could not be verified.");
            safe.initCause(failure);
            throw safe;
        }
        finally
        {
            if (previous == null) DynamicDataSourceContextHolder.clearDataSourceType();
            else DynamicDataSourceContextHolder.setDataSourceType(previous);
        }
    }

    private Snapshot readUser(Long userId)
    {
        SysUser user = users.selectUserById(userId);
        if (user == null || !userId.equals(user.getUserId()) || !"0".equals(user.getStatus())
                || !"0".equals(user.getDelFlag())) throw inactive();
        user.setRoles(navigation.selectActiveRoles(userId));
        // The upstream no-role fallback can include a deleted role. Empty active
        // roles must remain empty; per-role permissions still drive DataScopeAspect.
        Set<String> granted = user.isAdmin() || !user.getRoles().isEmpty()
                ? Set.copyOf(permissions.getMenuPermission(user)) : Set.of();
        return new Snapshot(user, granted);
    }

    private static ApiFailure inactive()
    {return new ApiFailure(401, "AUTHENTICATION_FAILED", "An active account is required.");}

    /** Fresh, request-owned mapper objects; never shared or cached as a singleton. */
    public record Snapshot(SysUser user, Set<String> permissions)
    {
        public void applyTo(LoginUser session)
        {
            session.setUser(user);
            session.setDeptId(user.getDeptId());
            session.setPermissions(permissions);
        }
    }
}
