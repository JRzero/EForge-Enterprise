package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.time.*;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import io.eforge.enterprise.workflow.api.WorkflowLeaves;

@RestController @RequestMapping("/api/v1/workflow/leaves")
public class WorkflowLeaveController {
    private static final String UUID="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowLeaves> leaves;
    public WorkflowLeaveController(ObjectProvider<WorkflowLeaves> leaves){this.leaves=leaves;}
    public record LeaveSubmitRequest(@NotNull @Pattern(regexp=UUID) String submissionId,
        @NotNull LocalDate startDate,@NotNull LocalDate endDate,@NotBlank @Size(max=1000) String reason) { }
    public record LeaveCommandRequest(@NotNull @Pattern(regexp=UUID) String commandId,
        @NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision,
        @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String taskId,@NotNull @Size(max=500) String comment) { }
    public record LeaveDecisionRequest(@NotNull @Valid LeaveCommandRequest command,@NotNull Boolean approved) { }
    public record LeaveResponse(@NotNull String id,@NotNull String submissionId,@NotNull String initiatorId,
        @NotNull String releaseId,@NotNull String processId,@NotNull LocalDate startDate,@NotNull LocalDate endDate,
        @NotNull String reason,@NotNull String status,@NotNull String revision,@NotNull Instant createdAt) { }
    public record LeaveTaskResponse(@NotNull String id,@NotNull String key,String name,String assignee,@NotNull boolean canHandle) { }
    public record LeaveEventResponse(@NotNull String action,@NotNull String actorId,String taskId,
        @NotNull String comment,@NotNull Instant createdAt) { }
    public record LeaveDetailResponse(@NotNull LeaveResponse leave,@NotNull List<LeaveTaskResponse> tasks,
        @NotNull List<LeaveEventResponse> history) { }
    public record LeavePendingResponse(@NotNull LeaveResponse leave,@NotNull LeaveTaskResponse task,boolean canHandle) { }

    @PostMapping @PreAuthorize("@ss.hasPermi('workflow:request:submit')") @Operation(operationId="submitWorkflowLeave")
    @Log(title="提交请假审批",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    public LeaveResponse submit(@RequestBody @Valid LeaveSubmitRequest request){return response(service().submit(
        new WorkflowLeaves.Submit(request.submissionId(),request.startDate(),request.endDate(),request.reason()),actor()));}
    @GetMapping("/mine") @PreAuthorize("@ss.hasPermi('workflow:request:list')") @Operation(operationId="listMyWorkflowLeaves")
    public PageResponse<LeaveResponse> mine(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
        @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){var result=service().mine(actor(),page,pageSize);return new PageResponse<>(result.items().stream().map(WorkflowLeaveController::response).toList(),result.total(),page,pageSize);}
    @GetMapping("/handled") @PreAuthorize("@ss.hasPermi('workflow:task:list')") @Operation(operationId="listHandledWorkflowLeaves")
    public PageResponse<LeaveResponse> handled(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
        @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){var result=service().handled(actor(),page,pageSize);return new PageResponse<>(result.items().stream().map(WorkflowLeaveController::response).toList(),result.total(),page,pageSize);}
    @GetMapping("/pending") @PreAuthorize("@ss.hasPermi('workflow:task:list')") @Operation(operationId="listPendingWorkflowLeaves")
    public PageResponse<LeavePendingResponse> pending(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
        @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){var result=service().pending(actor(),page,pageSize);return new PageResponse<>(result.items().stream().map(item->new LeavePendingResponse(response(item.leave()),task(item.task()),item.canHandle())).toList(),result.total(),page,pageSize);}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasAnyPermi('workflow:request:list,workflow:task:list')") @Operation(operationId="getWorkflowLeave")
    public LeaveDetailResponse get(@PathVariable @Pattern(regexp=UUID) String id){var result=service().get(id,actor());return new LeaveDetailResponse(response(result.leave()),result.tasks().stream().map(WorkflowLeaveController::task).toList(),result.history().stream().map(event->new LeaveEventResponse(event.action(),event.actorId(),event.taskId(),event.comment(),event.createdAt())).toList());}
    @PostMapping("/{id}/claim") @PreAuthorize("@ss.hasPermi('workflow:task:handle')") @Operation(operationId="claimWorkflowLeaveTask")
    @Log(title="领取请假审批",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public LeaveResponse claim(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid LeaveCommandRequest request){return response(service().claim(id,command(request),actor()));}
    @PostMapping("/{id}/decision") @PreAuthorize("@ss.hasPermi('workflow:task:handle')") @Operation(operationId="decideWorkflowLeaveTask")
    @Log(title="处理请假审批",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public LeaveResponse decide(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid LeaveDecisionRequest request){return response(service().decide(id,command(request.command()),request.approved(),actor()));}
    @PostMapping("/{id}/withdrawal") @PreAuthorize("@ss.hasPermi('workflow:request:withdraw')") @Operation(operationId="withdrawWorkflowLeave")
    @Log(title="撤回请假审批",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public LeaveResponse withdraw(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid LeaveCommandRequest request){return response(service().withdraw(id,command(request),actor()));}
    private WorkflowLeaves service(){var result=leaves.getIfAvailable();if(result==null)throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");return result;}
    private static String actor(){return Long.toString(SecurityUtils.getUserId());}
    private static WorkflowLeaves.Command command(LeaveCommandRequest request){try{return new WorkflowLeaves.Command(request.commandId(),Long.parseLong(request.expectedRevision()),request.taskId(),request.comment());}catch(NumberFormatException failure){throw new ApiFailure(400,"WORKFLOW_LEAVE_INVALID","审批版本无效。");}}
    private static LeaveTaskResponse task(WorkflowLeaves.Task task){return new LeaveTaskResponse(task.id(),task.key(),task.name(),task.assignee(),task.canHandle());}
    private static LeaveResponse response(WorkflowLeaves.Leave row){return new LeaveResponse(row.id(),row.submissionId(),row.initiatorId(),row.releaseId(),row.processId(),row.startDate(),row.endDate(),row.reason(),row.status(),Long.toString(row.revision()),row.createdAt());}
}
