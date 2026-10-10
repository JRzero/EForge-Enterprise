package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import io.eforge.enterprise.workflow.api.WorkflowReleases;

@RestController @RequestMapping("/api/v1/workflow")
public class WorkflowReleaseController {
    private static final String UUID_PATTERN="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowReleases> releases;
    public WorkflowReleaseController(ObjectProvider<WorkflowReleases> releases){this.releases=releases;}
    public record WorkflowPublicationRequest(@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision) { }
    public record WorkflowActivationRequest(@NotNull @Pattern(regexp=UUID_PATTERN) String releaseId,
        @NotNull @Pattern(regexp="0|[1-9][0-9]{0,18}") String expectedRevision) { }
    public record WorkflowReleaseResponse(String id,String packageId,String packageRevision,String name,String businessType,
        String contentDigest,String processDefinitionId,Instant publishedAt) { }
    public record WorkflowActivationResponse(String businessType,String releaseId,String revision) { }

    @PostMapping("/packages/{id}/releases") @PreAuthorize("@ss.hasPermi('workflow:definition:publish')")
    @Operation(operationId="publishWorkflowPackage")
    @Log(title="流程发布",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    public WorkflowReleaseResponse publish(@PathVariable @Pattern(regexp=UUID_PATTERN) String id,
        @RequestBody @Valid WorkflowPublicationRequest request){return response(service().publish(id,revision(request.expectedRevision()),actor()));}
    @GetMapping("/packages/{id}/releases") @PreAuthorize("@ss.hasPermi('workflow:definition:list')")
    @Operation(operationId="listWorkflowReleases")
    public PageResponse<WorkflowReleaseResponse> list(@PathVariable @Pattern(regexp=UUID_PATTERN) String id,
        @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){
        var result=service().list(id,page,pageSize);return new PageResponse<>(result.items().stream().map(WorkflowReleaseController::response).toList(),result.total(),page,pageSize);
    }
    @GetMapping("/releases/{id}") @PreAuthorize("@ss.hasPermi('workflow:definition:list')")
    @Operation(operationId="getWorkflowRelease")
    public WorkflowReleaseResponse get(@PathVariable @Pattern(regexp=UUID_PATTERN) String id){return response(service().get(id));}
    @GetMapping("/activations/{businessType}") @PreAuthorize("@ss.hasPermi('workflow:definition:list')")
    @Operation(operationId="getWorkflowActivation")
    public WorkflowActivationResponse activation(@PathVariable @Pattern(regexp="leave") String businessType){return response(service().activation(businessType));}
    @PutMapping("/activations/{businessType}") @PreAuthorize("@ss.hasPermi('workflow:definition:activate')")
    @Operation(operationId="activateWorkflowRelease")
    @Log(title="流程激活",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public WorkflowActivationResponse activate(@PathVariable @Pattern(regexp="leave") String businessType,
        @RequestBody @Valid WorkflowActivationRequest request){return response(service().activate(businessType,request.releaseId(),revision(request.expectedRevision()),actor()));}
    private WorkflowReleases service(){var result=releases.getIfAvailable();if(result==null)throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");return result;}
    private static String actor(){return Long.toString(SecurityUtils.getUserId());}
    private static long revision(String value){try{return Long.parseLong(value);}catch(NumberFormatException failure){throw new ApiFailure(400,"WORKFLOW_RELEASE_INVALID","流程版本无效。");}}
    private static WorkflowReleaseResponse response(WorkflowReleases.Release row){return new WorkflowReleaseResponse(row.id(),row.packageId(),Long.toString(row.packageRevision()),row.name(),row.businessType(),row.contentDigest(),row.processDefinitionId(),row.publishedAt());}
    private static WorkflowActivationResponse response(WorkflowReleases.Activation row){return new WorkflowActivationResponse(row.businessType(),row.releaseId(),Long.toString(row.revision()));}
}
