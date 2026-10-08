package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.net.URI;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import static io.eforge.enterprise.web.controller.api.v1.monitor.JobWriteContracts.*;

@RestController @RequestMapping("/api/v1/monitor/jobs")
public class JobWriteController {
    private final JobWriteService jobs;
    public JobWriteController(JobWriteService jobs){this.jobs=jobs;}
    @PostMapping @PreAuthorize("@ss.hasPermi('monitor:job:add')")
    @Operation(operationId="createJob") @ApiResponse(responseCode="201",description="Created paused task",content=@Content(schema=@Schema(implementation=JobCreatedResponse.class)))
    @Log(title="定时任务",businessType=BusinessType.INSERT)
    public ResponseEntity<JobCreatedResponse> create(@Valid @RequestBody JobWriteRequest request) {
        var result=jobs.create(request);return ResponseEntity.created(URI.create("/api/v1/monitor/jobs/"+result.id())).body(result);
    }
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('monitor:job:edit')") @Operation(operationId="updateJob")
    @ApiResponse(responseCode="204",description="Updated task") @Log(title="定时任务",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> update(@PathVariable String id,@Valid @RequestBody JobWriteRequest request){jobs.update(id,request);return ResponseEntity.noContent().build();}
    @PutMapping("/{id}/status") @PreAuthorize("@ss.hasPermi('monitor:job:changeStatus')") @Operation(operationId="changeJobStatus")
    @ApiResponse(responseCode="204",description="Changed task status") @Log(title="定时任务",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> status(@PathVariable String id,@Valid @RequestBody JobStatusRequest request){jobs.status(id,request);return ResponseEntity.noContent().build();}
    @PostMapping("/{id}/run") @PreAuthorize("@ss.hasPermi('monitor:job:changeStatus')") @Operation(operationId="runJob")
    @ApiResponse(responseCode="202",description="Manual execution dispatched after commit") @Log(title="定时任务",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> run(@PathVariable String id){jobs.run(id);return ResponseEntity.accepted().build();}
    @DeleteMapping @PreAuthorize("@ss.hasPermi('monitor:job:remove')") @Operation(operationId="deleteJobs")
    @ApiResponse(responseCode="204",description="Deleted selected tasks") @Log(title="定时任务",businessType=BusinessType.DELETE)
    public ResponseEntity<Void> delete(@Valid @RequestBody JobDeleteRequest request){jobs.delete(request);return ResponseEntity.noContent().build();}
}
