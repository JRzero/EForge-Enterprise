package io.eforge.enterprise.web.controller.api.v1.profile;

import java.util.Objects;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.framework.web.service.TokenService;
import io.eforge.enterprise.system.mapper.DepartmentMutationMapper;
import io.eforge.enterprise.system.service.ISysUserService;
import static io.eforge.enterprise.web.controller.api.v1.profile.ProfileContracts.*;

/** Reuses original RuoYi profile services behind concrete self-service contracts. */
@Service
public class ProfileService
{
    private final ISysUserService users;
    private final TokenService tokens;
    private final DepartmentMutationMapper mutations;
    private final AvatarStore avatars;
    private final TransactionTemplate transaction;
    public ProfileService(ISysUserService users, TokenService tokens, DepartmentMutationMapper mutations,
            AvatarStore avatars, PlatformTransactionManager manager)
    { this.users = users; this.tokens = tokens; this.mutations = mutations; this.avatars = avatars; transaction = new TransactionTemplate(manager); }
    public ProfileResponse get()
    {
        SysUser user = active(SecurityUtils.getLoginUser());
        return new ProfileResponse(user.getUserId().toString(), user.getUserName(), user.getNickName(), user.getEmail(),
                user.getPhonenumber(), user.getSex(), safeAvatar(user.getAvatar()), user.getDept() == null ? null : user.getDept().getDeptName(),
                Objects.toString(users.selectUserRoleGroup(user.getUserName()), ""), Objects.toString(users.selectUserPostGroup(user.getUserName()), ""),
                user.getCreateTime() == null ? null : user.getCreateTime().toInstant());
    }
    public void update(UpdateProfileRequest request)
    {
        LoginUser session = SecurityUtils.getLoginUser();
        try
        {
            transaction.executeWithoutResult(status -> {
                mutations.lockRoot(); SysUser current = active(session);
                SysUser patch = new SysUser(current.getUserId());
                // Original mapper uses zero to omit department updates; null would clear it.
                patch.setDeptId(0L);
                patch.setNickName(request.displayName()); patch.setEmail(request.email());
                patch.setPhonenumber(request.phone()); patch.setSex(request.sex()); patch.setUpdateBy(current.getUserName());
                if (!users.checkPhoneUnique(patch)) throw new ApiFailure(409, "USER_PHONE_EXISTS", "The phone number is already assigned.");
                if (!users.checkEmailUnique(patch)) throw new ApiFailure(409, "USER_EMAIL_EXISTS", "The email is already assigned.");
                requireWrite(users.updateUserProfile(patch));
            });
        }
        catch (DuplicateKeyException exception) { throw new ApiFailure(409, "USER_CONFLICT", "Account contact information conflicts."); }
        // Redis refresh happens only after the database transaction has committed.
        session.getUser().setNickName(request.displayName()); session.getUser().setEmail(request.email());
        session.getUser().setPhonenumber(request.phone()); session.getUser().setSex(request.sex()); tokens.setLoginUser(session);
    }
    public void password(ChangePasswordRequest request)
    {
        LoginUser session = SecurityUtils.getLoginUser();
        SysUser changed = transaction.execute(status -> {
            mutations.lockRoot(); SysUser current = active(session);
            if (!SecurityUtils.matchesPassword(request.oldPassword(), current.getPassword()))
                throw new ApiFailure(400, "OLD_PASSWORD_INVALID", "The current password is incorrect.");
            if (SecurityUtils.matchesPassword(request.newPassword(), current.getPassword()))
                throw new ApiFailure(409, "PASSWORD_UNCHANGED", "The new password must differ from the current password.");
            requireWrite(users.resetUserPwd(current.getUserId(), SecurityUtils.encryptPassword(request.newPassword())));
            return users.selectUserById(current.getUserId());
        });
        session.getUser().setPassword(changed.getPassword()); session.getUser().setPwdUpdateDate(changed.getPwdUpdateDate());
        tokens.setLoginUser(session);
    }
    public AvatarResponse avatar(MultipartFile file)
    {
        var image = avatars.decode(file); LoginUser session = SecurityUtils.getLoginUser();
        String[] stored = new String[2];
        try
        {
            transaction.executeWithoutResult(status -> {
                mutations.lockRoot(); SysUser current = active(session);
                stored[1] = current.getAvatar(); stored[0] = avatars.save(image);
                if (!users.updateUserAvatar(current.getUserId(), stored[0])) requireWrite(0);
            });
        }
        catch (RuntimeException exception) { avatars.delete(stored[0]); throw exception; }
        avatars.delete(stored[1]); session.getUser().setAvatar(stored[0]); tokens.setLoginUser(session);
        return new AvatarResponse(stored[0]);
    }
    private SysUser active(LoginUser session)
    {
        SysUser user = users.selectUserById(session.getUserId());
        if (user == null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
        { tokens.delLoginUser(session.getToken()); throw new CredentialsExpiredException("Account is no longer active"); }
        return user;
    }
    private static void requireWrite(int changed)
    { if (changed != 1) throw new ApiFailure(409, "PROFILE_WRITE_CONFLICT", "The profile could not be updated."); }
    private static String safeAvatar(String url)
    { return url != null && url.matches("/profile/[A-Za-z0-9/_-]+\\.[A-Za-z0-9]+") ? url : null; }
}
