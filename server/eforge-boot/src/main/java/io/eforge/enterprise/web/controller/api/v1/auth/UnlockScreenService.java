package io.eforge.enterprise.web.controller.api.v1.auth;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.service.ISysUserService;
/** Canonical current-user verification over the original authenticated screen unlock behavior. */
@Service
public class UnlockScreenService {
    private final ISysUserService users;
    public UnlockScreenService(ISysUserService users){this.users=users;}
    public void verifyPassword(String password){
        try {
            var user=users.selectUserById(SecurityUtils.getUserId());
            if(user==null || !"0".equals(user.getStatus()) || !"0".equals(user.getDelFlag()))
                throw new ApiFailure(401,"AUTHENTICATION_REQUIRED","The account is no longer active.");
            if(!SecurityUtils.matchesPassword(password,user.getPassword()))
                throw new ApiFailure(403,"SCREEN_UNLOCK_PASSWORD_MISMATCH","Password verification failed.");
        } catch(DataAccessException | IllegalArgumentException failure){
            throw new ApiFailure(503,"SCREEN_UNLOCK_UNAVAILABLE","Screen unlock is temporarily unavailable.");
        }
    }
}
