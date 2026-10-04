package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
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
import io.eforge.enterprise.system.domain.SysOperLog;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.LogContracts.*;

@RestController
@RequestMapping("/api/v1/monitor/operation-logs")
public class OperationLogController
{
    private final LogService logs;
    public OperationLogController(LogService logs){this.logs=logs;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:operlog:list')") @Operation(operationId="listOperationLogs")
    public PageResponse<OperationLogResponse> list(@Valid @ModelAttribute @ParameterObject OperationQuery query){return logs.operations(query);}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('monitor:operlog:query')") @Operation(operationId="getOperationLog")
    public OperationLogDetail get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id){return logs.operation(id);}
    @DeleteMapping @PreAuthorize("@ss.hasPermi('monitor:operlog:remove')") @Operation(operationId="deleteOperationLogs")
    @Log(title="操作日志",businessType=BusinessType.DELETE,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteLogsRequest request){logs.deleteOperations(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping("/clear") @PreAuthorize("@ss.hasPermi('monitor:operlog:remove')") @Operation(operationId="clearOperationLogs")
    @Log(title="操作日志",businessType=BusinessType.CLEAN,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Cleared",content=@Content)
    public ResponseEntity<Void> clear(){logs.clearOperations();return ResponseEntity.noContent().build();}
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('monitor:operlog:export')") @Operation(operationId="exportOperationLogs")
    @Log(title="操作日志",businessType=BusinessType.EXPORT,isSaveResponseData=false)
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@Valid @ModelAttribute @ParameterObject OperationQuery query)
    {new ExcelUtil<>(SysOperLog.class).exportExcel(response,logs.exportOperations(query),"操作日志");}
}
