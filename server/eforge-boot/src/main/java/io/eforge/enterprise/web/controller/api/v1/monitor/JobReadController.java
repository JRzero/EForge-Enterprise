package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.*;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.poi.CanonicalExcelUtil;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobContracts.*;

@RestController @RequestMapping("/api/v1/monitor/jobs")
public class JobReadController {
    private final JobReadService jobs;
    public JobReadController(JobReadService jobs){this.jobs=jobs;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:job:list')") @Operation(operationId="listJobs")
    public PageResponse<JobResponse> list(@Valid @ModelAttribute @ParameterObject JobQuery query){return jobs.list(query);}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('monitor:job:query')") @Operation(operationId="getJob")
    public JobResponse detail(@PathVariable String id){return jobs.detail(id);}
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('monitor:job:export')") @Operation(operationId="exportJobs")
    @Log(title="定时任务",businessType=BusinessType.EXPORT,isSaveResponseData=false)
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@Valid @ModelAttribute @ParameterObject JobQuery query)
    {new CanonicalExcelUtil<>(SysJob.class).exportExcel(response,jobs.export(query),"定时任务");}
}