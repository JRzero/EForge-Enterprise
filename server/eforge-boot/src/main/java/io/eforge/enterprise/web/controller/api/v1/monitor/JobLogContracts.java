package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Instant;
import java.time.LocalDate;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.quartz.domain.SysJobLog;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class JobLogContracts
{
    private JobLogContracts() {}
    public record JobLogQuery(
            @Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
            @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
            @Size(max=64) String name,@Size(max=64) String group,@Size(max=500) String invokeTarget,
            @Min(0) @Max(1) Integer status,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @Schema(defaultValue="desc") LogContracts.Direction direction,
            @Size(max=64) String timeZone) {}
    public record JobLogResponse(@Schema(requiredMode=REQUIRED) String id,String name,String group,
            String invokeTarget,String message,String status,Instant startedAt,Instant endedAt,Instant createdAt)
    {
        static JobLogResponse from(SysJobLog row) {
            return new JobLogResponse(row.getJobLogId().toString(),row.getJobName(),row.getJobGroup(),row.getInvokeTarget(),
                    row.getJobMessage(),row.getStatus(),instant(row.getStartTime()),instant(row.getEndTime()),instant(row.getCreateTime()));
        }
        private static Instant instant(java.util.Date value){return value==null?null:value.toInstant();}
    }
    public record JobLogDetail(@Schema(requiredMode=REQUIRED) JobLogResponse entry,String exceptionInfo) {}
}
