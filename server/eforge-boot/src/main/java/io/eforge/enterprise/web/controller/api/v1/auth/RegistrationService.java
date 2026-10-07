package io.eforge.enterprise.web.controller.api.v1.auth;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.core.domain.model.RegisterBody;
import io.eforge.enterprise.framework.web.service.SysRegisterService;
import io.eforge.enterprise.system.service.ISysConfigService;
/** Canonical boundary; original registration/captcha/hash/audit behavior stays upstream. */
@Service
public class RegistrationService {
    private final ISysConfigService configurations;
    private final SysRegisterService original;
    public RegistrationService(ISysConfigService configurations, SysRegisterService original) {
        this.configurations=configurations;this.original=original;
    }
    public boolean enabled() { return "true".equals(configurations.selectConfigByKey("sys.account.registerUser")); }
    public void register(RegistrationRequest request) {
        if(!enabled())throw new ApiFailure(403,"REGISTRATION_DISABLED","Registration is not enabled.");
        if(!request.password().equals(request.confirmPassword()))
            throw new ApiFailure(400,"REGISTRATION_PASSWORD_MISMATCH","Password confirmation does not match.");
        var body=new RegisterBody();body.setUsername(request.username());body.setPassword(request.password());
        body.setCode(request.code()==null ? "" : request.code());body.setUuid(request.uuid()==null ? "" : request.uuid());
        try {
            String result=original.register(body);
            if(result!=null && !result.isEmpty()) {
                if(result.endsWith("注册账号已存在"))throw conflict();
                throw unavailable();
            }
        } catch(DuplicateKeyException failure) { throw conflict(); }
          catch(DataAccessException failure) { throw unavailable(); }
    }
    private static ApiFailure conflict(){return new ApiFailure(409,"REGISTRATION_USERNAME_EXISTS","The account already exists.");}
    private static ApiFailure unavailable(){return new ApiFailure(503,"REGISTRATION_UNAVAILABLE","Registration is temporarily unavailable.");}
}
