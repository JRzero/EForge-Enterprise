package io.eforge.enterprise.web.controller.api.v1.auth;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataAccessResourceFailureException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.exception.user.CaptchaException;
import io.eforge.enterprise.common.core.domain.model.RegisterBody;
import io.eforge.enterprise.framework.web.service.SysRegisterService;
import io.eforge.enterprise.system.service.ISysConfigService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;
class RegistrationServiceTest {
    private final ISysConfigService configs=mock(ISysConfigService.class);
    private final SysRegisterService original=mock(SysRegisterService.class);
    private final RegistrationService service=new RegistrationService(configs,original);
    private final RegistrationRequest request=new RegistrationRequest("newaccount","Register123","Register123","42","captcha-id");
    @BeforeEach void enabled(){when(configs.selectConfigByKey("sys.account.registerUser")).thenReturn("true");}
    @Test void requestDiagnosticsDoNotContainAnyCredentialsOrCaptcha(){
        assertEquals("RegistrationRequest[credentials redacted]",request.toString());
    }
    @Test void disabledAndMalformedSettingNeverConsumeCaptchaOrCreateAccount(){
        for(String value:new String[]{"false","TRUE","","broken"}){
            when(configs.selectConfigByKey("sys.account.registerUser")).thenReturn(value);
            assertFalse(service.enabled());assertEquals(403,assertThrows(ApiFailure.class,()->service.register(request)).status());
        }
        verifyNoInteractions(original);
    }
    @Test void rejectsConfirmationMismatchBeforeOriginalWrite(){
        var different=new RegistrationRequest("newaccount","Register123","Register456","","");
        assertEquals("REGISTRATION_PASSWORD_MISMATCH",assertThrows(ApiFailure.class,()->service.register(different)).code());verifyNoInteractions(original);
    }
    @Test void forwardsExactCredentialsAndCaptchaOnlyWithoutAdditionalGrants(){
        service.register(request);var argument=ArgumentCaptor.forClass(RegisterBody.class);verify(original).register(argument.capture());
        assertEquals(request.username(),argument.getValue().getUsername());assertEquals(request.password(),argument.getValue().getPassword());
        assertEquals("42",argument.getValue().getCode());assertEquals("captcha-id",argument.getValue().getUuid());
    }
    @Test void originalCaptchaFailureRemainsTypedAndDoesNotBecomeUsernameConflict(){
        when(original.register(any())).thenThrow(new CaptchaException());assertThrows(CaptchaException.class,()->service.register(request));
    }
    @Test void bothExistingAndConcurrentDatabaseDuplicateUseSafeConflict(){
        when(original.register(any())).thenReturn("保存用户'unsafe-secret'失败，注册账号已存在");
        var existing=assertThrows(ApiFailure.class,()->service.register(request));assertEquals(409,existing.status());assertFalse(existing.getMessage().contains("unsafe-secret"));
        when(original.register(any())).thenThrow(new DuplicateKeyException("driver-private"));assertEquals("REGISTRATION_USERNAME_EXISTS",assertThrows(ApiFailure.class,()->service.register(request)).code());
    }
    @Test void originalFalseResultAndSqlFaultDoNotExposeDriverOrPayload(){
        when(original.register(any())).thenReturn("private-secret");var failure=assertThrows(ApiFailure.class,()->service.register(request));assertEquals(503,failure.status());assertFalse(failure.getMessage().contains("private-secret"));
        when(original.register(any())).thenThrow(new DataAccessResourceFailureException("driver-private"));assertEquals(503,assertThrows(ApiFailure.class,()->service.register(request)).status());
    }
}
