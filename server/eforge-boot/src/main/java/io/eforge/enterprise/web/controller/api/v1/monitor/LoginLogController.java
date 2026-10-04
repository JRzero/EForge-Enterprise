package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;
import io.eforge.enterprise.system.domain.SysLogininfor;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.LogContracts.*;

@RestController
@RequestMapping("/api/v1/monitor/login-logs")
public class LoginLogController
{
    private final LogService logs;
    public LoginLogController(LogService logs){this.logs=logs;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:logininfor:list')") @Operation(operationId="listLoginLogs")
    public PageResponse<LoginLogResponse> list(@Valid @ModelAttribute @ParameterObject LoginQuery query){return logs.logins(query);}
    @DeleteMapping @PreAuthorize("@ss.hasPermi('monitor:logininfor:remove')") @Operation(operationId="deleteLoginLogs")
    @Log(title="登录日志",businessType=BusinessType.DELETE,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteLogsRequest request){logs.deleteLogins(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping("/clear") @PreAuthorize("@ss.hasPermi('monitor:logininfor:remove')") @Operation(operationId="clearLoginLogs")
    @Log(title="登录日志",businessType=BusinessType.CLEAN,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Cleared",content=@Content)
    public ResponseEntity<Void> clear(){logs.clearLogins();return ResponseEntity.noContent().build();}
    @PostMapping("/unlock") @PreAuthorize("@ss.hasPermi('monitor:logininfor:unlock')") @Operation(operationId="unlockLoginAccount")
    @Log(title="账户解锁",businessType=BusinessType.OTHER,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Password failure state cleared",content=@Content)
    public ResponseEntity<Void> unlock(@Valid @RequestBody UnlockLoginRequest request){logs.unlock(request.username());return ResponseEntity.noContent().build();}
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('monitor:logininfor:export')") @Operation(operationId="exportLoginLogs")
    @Log(title="登录日志",businessType=BusinessType.EXPORT,isSaveResponseData=false)
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@Valid @ModelAttribute @ParameterObject LoginQuery query)
    {new ExcelUtil<>(SysLogininfor.class).exportExcel(response,logs.exportLogins(query),"登录日志");}
}
