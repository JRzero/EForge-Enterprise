package io.eforge.enterprise.web.controller.api.v1.app;

import java.util.Date;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.common.core.text.Convert;
import io.eforge.enterprise.common.utils.DateUtils;
import io.eforge.enterprise.system.service.ISysConfigService;

/** ConfigurationValueReader retains its short guarded transactions outside the auth read-only snapshot. */
@Service
public class PasswordStatusService
{
    private final ISysConfigService configs;
    public PasswordStatusService(ISysConfigService configs){this.configs=configs;}
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public BootstrapResponse.PasswordStatus read(Date updated)
    {
        return BootstrapResponse.PasswordStatus.from(Convert.toStr(configs.selectConfigByKey("sys.account.chrtype"),"0"),
                Convert.toInt(configs.selectConfigByKey("sys.account.initPasswordModify")),
                Convert.toInt(configs.selectConfigByKey("sys.account.passwordValidateDays")),updated,DateUtils.getNowDate());
    }
}