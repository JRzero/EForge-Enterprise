package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Instant;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.quartz.domain.SysJob;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class JobContracts {
    private JobContracts() {}
    public record JobQuery(@Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
        @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
        @Size(max=64) String name,@Size(max=64) String group,@Size(max=500) String invokeTarget,
        @Min(0) @Max(1) Integer status,Sort sort,LogContracts.Direction direction) {}
    public enum Sort {id,name,createdAt}
    public record JobResponse(@Schema(requiredMode=REQUIRED) String id,String name,String group,
        String invokeTarget,String cronExpression,String misfirePolicy,boolean concurrent,String status,
        String remark,Instant createdAt,Instant updatedAt,Instant nextExecutionAt) {
        static JobResponse from(SysJob row) {
            return new JobResponse(row.getJobId().toString(),row.getJobName(),row.getJobGroup(),row.getInvokeTarget(),
                row.getCronExpression(),row.getMisfirePolicy(),"0".equals(row.getConcurrent()),row.getStatus(),row.getRemark(),
                instant(row.getCreateTime()),instant(row.getUpdateTime()),instant(row.getNextValidTime()));
        }
        private static Instant instant(java.util.Date value){return value==null?null:value.toInstant();}
    }
}