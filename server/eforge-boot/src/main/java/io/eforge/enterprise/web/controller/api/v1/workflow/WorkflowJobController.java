package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.time.Instant;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import io.eforge.enterprise.workflow.api.WorkflowJobs;

@RestController @RequestMapping("/api/v1/workflow")
public class WorkflowJobController {
    private static final String UUID="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowJobs> jobs;
    public WorkflowJobController(ObjectProvider<WorkflowJobs> jobs){this.jobs=jobs;}
    public record WorkflowFailedJobResponse(@NotNull String id,@NotNull String processId,@NotNull String releaseId,
        String leaveId,String elementId,int retries,@NotNull Instant createdAt) { }
    public record WorkflowJobsResponse(@NotNull PageResponse<WorkflowFailedJobResponse> page,boolean recoveryEnabled) { }
    public record WorkflowJobRetryRequest(@NotNull @Pattern(regexp=UUID) String commandId,@NotNull @Pattern(regexp=UUID) String leaveId) { }
    public record WorkflowJobQueuedResponse(@NotNull String commandId,@NotNull String originalJobId,@NotNull String queuedJobId,@NotNull String status) { }
    @GetMapping("/releases/{id}/failed-jobs") @PreAuthorize("@ss.hasPermi('workflow:operation:list')") @Operation(operationId="listFailedWorkflowJobs")
    public WorkflowJobsResponse list(@PathVariable @Pattern(regexp=UUID) String id,
        @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){
        var result=service().failed(id,page,pageSize);
        var rows=result.items().stream().map(job->new WorkflowFailedJobResponse(job.id(),job.processId(),job.releaseId(),job.leaveId(),job.elementId(),job.retries(),job.createdAt())).toList();
        return new WorkflowJobsResponse(new PageResponse<>(rows,result.total(),page,pageSize),result.recoveryEnabled());
    }
    @PostMapping("/jobs/{id}/retry") @ResponseStatus(HttpStatus.ACCEPTED)
    @PreAuthorize("@ss.hasPermi('workflow:operation:retry')") @Operation(operationId="retryWorkflowJob")
    @Log(title="恢复工作流作业",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public WorkflowJobQueuedResponse retry(@PathVariable @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String id,@RequestBody @Valid WorkflowJobRetryRequest request){
        var result=service().retry(id,new WorkflowJobs.Retry(request.commandId(),request.leaveId()),Long.toString(SecurityUtils.getUserId()));
        return new WorkflowJobQueuedResponse(result.commandId(),result.originalJobId(),result.queuedJobId(),result.status());
    }
    private WorkflowJobs service(){var result=jobs.getIfAvailable();if(result==null)throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");return result;}
}
