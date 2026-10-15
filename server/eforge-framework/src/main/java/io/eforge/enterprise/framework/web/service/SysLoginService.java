package io.eforge.enterprise.framework.web.service;

import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.common.constant.CacheConstants;
import io.eforge.enterprise.common.constant.Constants;
import io.eforge.enterprise.common.constant.UserConstants;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.common.core.redis.RedisCache;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.user.BlackListException;
import io.eforge.enterprise.common.exception.user.CaptchaException;
import io.eforge.enterprise.common.exception.user.CaptchaExpireException;
import io.eforge.enterprise.common.exception.user.UserNotExistsException;
import io.eforge.enterprise.common.exception.user.UserPasswordNotMatchException;
import io.eforge.enterprise.common.exception.user.UserException;
import io.eforge.enterprise.common.utils.DateUtils;
import io.eforge.enterprise.common.utils.MessageUtils;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.common.utils.ip.IpUtils;
import io.eforge.enterprise.framework.manager.AsyncManager;
import io.eforge.enterprise.framework.manager.factory.AsyncFactory;
import io.eforge.enterprise.framework.security.context.AuthenticationContextHolder;
import io.eforge.enterprise.system.service.ISysConfigService;
import io.eforge.enterprise.system.service.ISysUserService;

/**
 * 登录校验方法
 * 
 * @author ruoyi
 */
@Component
public class SysLoginService
{
    @Autowired
    private TokenService tokenService;

    @Resource
    private AuthenticationManager authenticationManager;

    @Autowired
    private RedisCache redisCache;
    
    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysConfigService configService;

    /**
     * 登录验证
     * 
     * @param username 用户名
     * @param password 密码
     * @param code 验证码
     * @param uuid 唯一标识
     * @return 结果
     */
    public String login(String username, String password, String code, String uuid)
    {
        // 验证码校验
        try
        {
            validateCaptcha(username, code, uuid);
            // 登录前置校验
            loginPreCheck(username, password);
        }
        catch (RuntimeException failure)
        {
            ApiFailure unavailable = infrastructureFailure(failure);
            if (unavailable != null)
            {
                if (!"LOGIN_AUDIT_UNAVAILABLE".equals(unavailable.code())) recordSafeFailure(username, unavailable);
                throw unavailable;
            }
            throw failure;
        }
        // 用户验证
        Authentication authentication = null;
        try
        {
            UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(username, password);
            AuthenticationContextHolder.setContext(authenticationToken);
            // 该方法会去调用UserDetailsServiceImpl.loadUserByUsername
            authentication = authenticationManager.authenticate(authenticationToken);
        }
        catch (Exception e)
        {
            ApiFailure unavailable = infrastructureFailure(e);
            if (unavailable != null) { recordSafeFailure(username, unavailable); throw unavailable; }
            if (e instanceof BadCredentialsException)
            {
                recordRejection(username, MessageUtils.message("user.password.not.match"));
                throw new UserPasswordNotMatchException();
            }
            else
            {
                // Spring wraps UserDetailsService failures. Preserve only the
                // known resource messages, never arbitrary provider/cause text.
                String message = credentialRejection(e);
                if (message != null)
                {
                    recordRejection(username, message);
                    throw new ServiceException(message);
                }
                recordSafeFailure(username, e);
                throw new ServiceException("Login was rejected.");
            }
        }
        finally
        {
            AuthenticationContextHolder.clearContext();
        }
        LoginUser loginUser = (LoginUser) authentication.getPrincipal();
        // Redis creation follows the final current-identity/password-proof fence.
        // Never record success for a rejected proof or a failed session creation.
        String token;
        try { token = tokenService.createToken(loginUser); }
        catch (RuntimeException failure) { recordSafeFailure(username, failure); throw failure; }
        try
        {
            recordLoginInfo(loginUser.getUserId());
            AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_SUCCESS, MessageUtils.message("user.login.success")));
        }
        catch (RuntimeException failure)
        {
            // A failed login-info write must not leave an undisclosed active token.
            try { tokenService.delLoginUser(loginUser.getToken()); }
            catch (RuntimeException revocationFailure) { if (revocationFailure != failure) failure.addSuppressed(revocationFailure); }
            var safe = new ApiFailure(503, "LOGIN_UNAVAILABLE", "Login could not be completed.");
            safe.initCause(failure); recordSafeFailure(username, safe); throw safe;
        }
        return token;
    }

    private static String credentialRejection(Throwable failure)
    {
        java.util.Set<Throwable> seen = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        Throwable cause = failure;
        for (int depth = 0; cause != null && depth < 8 && seen.add(cause); depth++, cause = cause.getCause())
        {
            if (!(cause instanceof UserException rejection)) continue;
            String code = rejection.getCode();
            if (code == null) continue;
            if (java.util.Set.of("user.password.not.match", "user.not.exists", "user.password.delete", "user.blocked").contains(code))
                return MessageUtils.message(code);
            Object[] arguments = rejection.getArgs();
            Object[] args = arguments == null ? null : arguments.clone();
            if (code.equals("user.password.retry.limit.exceed") && args != null && args.length == 2
                    && args[0] instanceof Integer && args[1] instanceof Integer)
                return MessageUtils.message(code, args);
        }
        return null;
    }

    private static ApiFailure infrastructureFailure(Throwable failure)
    {
        java.util.Set<Throwable> seen = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        Throwable cause = failure;
        for (int depth = 0; cause != null && depth < 8 && seen.add(cause); depth++, cause = cause.getCause())
        {
            if (cause instanceof ApiFailure safe && safe.status() >= 500) return safe;
            if (cause instanceof org.springframework.dao.DataAccessException || cause instanceof org.springframework.transaction.TransactionException)
            {
                ApiFailure safe = new ApiFailure(503, "LOGIN_UNAVAILABLE", "Login could not be completed.");
                safe.initCause(failure); return safe;
            }
        }
        return null;
    }

    private static void recordSafeFailure(String username, Throwable original)
    {
        try { AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, "Login was not completed.")); }
        catch (RuntimeException auditUnavailable) { if (auditUnavailable != original) original.addSuppressed(auditUnavailable); }
    }

    private static void recordRejection(String username, String message)
    {
        try { AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, message)); }
        catch (RuntimeException failure)
        {
            // Do not recursively enqueue another audit into the failed queue.
            var safe = new ApiFailure(503, "LOGIN_AUDIT_UNAVAILABLE", "Login could not be completed.");
            safe.initCause(failure); throw safe;
        }
    }

    /**
     * 校验验证码
     * 
     * @param username 用户名
     * @param code 验证码
     * @param uuid 唯一标识
     * @return 结果
     */
    public void validateCaptcha(String username, String code, String uuid)
    {
        boolean captchaEnabled = configService.selectCaptchaEnabled();
        if (captchaEnabled)
        {
            String verifyKey = CacheConstants.CAPTCHA_CODE_KEY + StringUtils.nvl(uuid, "");
            String captcha = redisCache.getCacheObject(verifyKey);
            if (captcha == null)
            {
                recordRejection(username, MessageUtils.message("user.jcaptcha.expire"));
                throw new CaptchaExpireException();
            }
            redisCache.deleteObject(verifyKey);
            if (!code.equalsIgnoreCase(captcha))
            {
                recordRejection(username, MessageUtils.message("user.jcaptcha.error"));
                throw new CaptchaException();
            }
        }
    }

    /**
     * 登录前置校验
     * @param username 用户名
     * @param password 用户密码
     */
    public void loginPreCheck(String username, String password)
    {
        // 用户名或密码为空 错误
        if (StringUtils.isEmpty(username) || StringUtils.isEmpty(password))
        {
            recordRejection(username, MessageUtils.message("not.null"));
            throw new UserNotExistsException();
        }
        // 密码如果不在指定范围内 错误
        if (password.length() < UserConstants.PASSWORD_MIN_LENGTH
                || password.length() > UserConstants.PASSWORD_MAX_LENGTH)
        {
            recordRejection(username, MessageUtils.message("user.password.not.match"));
            throw new UserPasswordNotMatchException();
        }
        // 用户名不在指定范围内 错误
        if (username.length() < UserConstants.USERNAME_MIN_LENGTH
                || username.length() > UserConstants.USERNAME_MAX_LENGTH)
        {
            recordRejection(username, MessageUtils.message("user.password.not.match"));
            throw new UserPasswordNotMatchException();
        }
        // IP黑名单校验
        String blackStr = configService.selectConfigByKey("sys.login.blackIPList");
        if (IpUtils.isMatchedIp(blackStr, IpUtils.getIpAddr()))
        {
            recordRejection(username, MessageUtils.message("login.blocked"));
            throw new BlackListException();
        }
    }

    /**
     * 记录登录信息
     *
     * @param userId 用户ID
     */
    public void recordLoginInfo(Long userId)
    {
        userService.updateLoginInfo(userId, IpUtils.getIpAddr(), DateUtils.getNowDate());
    }
}
