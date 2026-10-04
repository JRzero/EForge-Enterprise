package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.system.domain.SysConfig;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class ConfigurationContracts
{
    private ConfigurationContracts() {}
    public record ConfigurationRequest(@NotBlank @Size(max=100) String name,
            @NotBlank @Size(max=100) String key,@NotBlank @Size(max=500) String value,
            @NotNull Boolean builtin,@Size(max=500) String remark)
    { @Override public String toString(){return "ConfigurationRequest[values redacted]";} }
    public record DeleteConfigurationsRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record ConfigurationResponse(@Schema(requiredMode=REQUIRED) String id,
            @Schema(requiredMode=REQUIRED) String name,@Schema(requiredMode=REQUIRED) String key,
            @Schema(requiredMode=REQUIRED) String value,@Schema(requiredMode=REQUIRED) boolean builtin,
            String remark,Instant createdAt)
    {
        static ConfigurationResponse from(SysConfig row){return new ConfigurationResponse(row.getConfigId().toString(),row.getConfigName(),row.getConfigKey(),row.getConfigValue()==null?"":row.getConfigValue(),"Y".equals(row.getConfigType()),row.getRemark(),row.getCreateTime()==null?null:row.getCreateTime().toInstant());}
    }
    public record ConfigurationValueResponse(@Schema(requiredMode=REQUIRED) String value) {}
}
