package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.system.domain.SysOperLog;
import io.eforge.enterprise.system.domain.SysLogininfor;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/** Canonical projections; RuoYi compatibility objects stay inside this boundary. */
public final class LogContracts
{
    private LogContracts() {}
    public enum OperationSort { operator, time, duration }
    public enum LoginSort { username, time }
    public enum Direction { asc, desc }
    public record OperationQuery(
            @Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
            @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
            @Size(max=128) String ip, @Size(max=50) String title, @Size(max=50) String operator,
            @Min(0) @Max(9) Integer businessType, @Min(0) @Max(1) Integer status,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @Schema(defaultValue="time") OperationSort sort, @Schema(defaultValue="desc") Direction direction) {}
    public record LoginQuery(
            @Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
            @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
            @Size(max=128) String ip, @Size(max=50) String username, @Min(0) @Max(1) Integer status,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @Schema(defaultValue="time") LoginSort sort, @Schema(defaultValue="desc") Direction direction) {}
    public record DeleteLogsRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record UnlockLoginRequest(@NotBlank @Size(max=30) String username) {}
    public record OperationLogResponse(@Schema(requiredMode=REQUIRED) String id,
            @Schema(requiredMode=REQUIRED) String title, Integer businessType,
            String operator, String ip, String location, String status, Instant operatedAt, Long duration)
    {
        static OperationLogResponse from(SysOperLog row) {
            return new OperationLogResponse(row.getOperId().toString(),row.getTitle(),row.getBusinessType(),row.getOperName(),
                    row.getOperIp(),row.getOperLocation(),row.getStatus()==null?null:row.getStatus().toString(),
                    row.getOperTime()==null?null:row.getOperTime().toInstant(),row.getCostTime());
        }
    }
    public record OperationLogDetail(@Schema(requiredMode=REQUIRED) OperationLogResponse entry,
            String departmentName, String method, String requestMethod, String url,
            Integer operatorType, String requestParameters, String responseBody, String errorMessage)
    {
        static OperationLogDetail from(SysOperLog row) {
            return new OperationLogDetail(OperationLogResponse.from(row),row.getDeptName(),row.getMethod(),row.getRequestMethod(),
                    row.getOperUrl(),row.getOperatorType(),row.getOperParam(),row.getJsonResult(),row.getErrorMsg());
        }
    }
    public record LoginLogResponse(@Schema(requiredMode=REQUIRED) String id,
            String username, String ip, String location, String browser, String operatingSystem,
            String status, String message, Instant loggedInAt)
    {
        static LoginLogResponse from(SysLogininfor row) {
            return new LoginLogResponse(row.getInfoId().toString(),row.getUserName(),row.getIpaddr(),row.getLoginLocation(),
                    row.getBrowser(),row.getOs(),row.getStatus(),row.getMsg(),row.getLoginTime()==null?null:row.getLoginTime().toInstant());
        }
    }
}
