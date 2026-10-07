package io.eforge.enterprise.web.controller.api.v1.app;
import java.util.Date;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.system.service.ISysConfigService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PasswordStatusServiceTest {
    @Test void usesOriginalIntegerFallbackAndKeepsMalformedPolicyInactive(){
        var configs=mock(ISysConfigService.class);var service=new PasswordStatusService(configs);
        when(configs.selectConfigByKey("sys.account.chrtype")).thenReturn("4");
        when(configs.selectConfigByKey("sys.account.initPasswordModify")).thenReturn("bad");
        when(configs.selectConfigByKey("sys.account.passwordValidateDays")).thenReturn("-1");
        var status=service.read(null);assertEquals("4",status.characterType());assertFalse(status.initialChangeRecommended());assertFalse(status.expired());
        when(configs.selectConfigByKey("sys.account.initPasswordModify")).thenReturn("1");
        when(configs.selectConfigByKey("sys.account.passwordValidateDays")).thenReturn("30");
        assertTrue(service.read(null).initialChangeRecommended());assertTrue(service.read(null).expired());
        assertFalse(service.read(new Date()).expired());assertTrue(service.read(new Date(System.currentTimeMillis()-32L*86_400_000)).expired());
    }
}