package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class CacheMonitorContracts
{
    private CacheMonitorContracts() {}
    public static final String NAMESPACE = "(?:login_tokens|sys_config|sys_dict|captcha_codes|repeat_submit|rate_limit|pwd_err_cnt):";
    public record CacheName(@Schema(requiredMode=REQUIRED) String name,@Schema(requiredMode=REQUIRED) String description) {}
    public record CommandStatistic(@Schema(requiredMode=REQUIRED) String name,@Schema(requiredMode=REQUIRED) String calls) {}
    /** Counts/bytes remain exact decimal strings, including values beyond JavaScript's integer range. */
    public record CacheStatistics(@Schema(requiredMode=REQUIRED) RedisInformation info,
            @Schema(requiredMode=REQUIRED) String keyCount,@Schema(requiredMode=REQUIRED) List<CommandStatistic> commands) {
        public CacheStatistics {commands=List.copyOf(commands);}
    }
    public record RedisInformation(String version,String mode,String port,String connectedClients,String uptimeDays,
            String usedMemory,String usedMemoryBytes,String userChildrenCpuSeconds,String maxMemory,
            String aofEnabled,String rdbLastSaveStatus,String inputKbps,String outputKbps) {}
    public record CacheValue(@Schema(requiredMode=REQUIRED) String name,@Schema(requiredMode=REQUIRED) String key,
            @Schema(requiredMode=REQUIRED) String value) {}
    public record ClearCacheKeyRequest(@NotBlank @Pattern(regexp=NAMESPACE) String name,@NotBlank @Size(max=4096) String key) {}
}
