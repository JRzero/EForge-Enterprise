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
import io.eforge.enterprise.quartz.domain.SysJobLog;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobLogContracts.*;

@RestController
@RequestMapping("/api/v1/monitor/job-logs")
public class JobLogController
{
    private final JobLogService logs;
    public JobLogController(JobLogService logs){this.logs=logs;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:job:list')") @Operation(operationId="listJobLogs")
    public PageResponse<JobLogResponse> list(@Valid @ModelAttribute @ParameterObject JobLogQuery query){return logs.list(query);}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('monitor:job:query')") @Operation(operationId="getJobLog")
    public JobLogDetail detail(@PathVariable String id){return logs.detail(id);}
    @DeleteMapping @PreAuthorize("@ss.hasPermi('monitor:job:remove')") @Operation(operationId="deleteJobLogs")
    @Log(title="任务调度日志",businessType=BusinessType.DELETE,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody LogContracts.DeleteLogsRequest request){logs.delete(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping("/clear") @PreAuthorize("@ss.hasPermi('monitor:job:remove')") @Operation(operationId="clearJobLogs")
    @Log(title="任务调度日志",businessType=BusinessType.CLEAN,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Cleared",content=@Content)
    public ResponseEntity<Void> clear(){logs.clear();return ResponseEntity.noContent().build();}
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('monitor:job:export')") @Operation(operationId="exportJobLogs")
    @Log(title="任务调度日志",businessType=BusinessType.EXPORT,isSaveResponseData=false)
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@Valid @ModelAttribute @ParameterObject JobLogQuery query)
    {new ExcelUtil<>(SysJobLog.class).exportExcel(response,logs.export(query),"任务调度日志");}
}
