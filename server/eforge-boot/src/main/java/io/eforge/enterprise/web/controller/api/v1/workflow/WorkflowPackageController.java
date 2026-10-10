package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.net.URI;
import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import io.eforge.enterprise.workflow.api.*;
import static io.eforge.enterprise.web.controller.api.v1.workflow.WorkflowValidationController.*;

@RestController
@RequestMapping("/api/v1/workflow/packages")
public class WorkflowPackageController {
    private static final String UUID_PATTERN="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowPackages> packages;
    public WorkflowPackageController(ObjectProvider<WorkflowPackages> packages) { this.packages = packages; }
    public record WorkflowPackageRequest(@NotBlank @Size(max=128) String name,
        @NotNull @Pattern(regexp="leave") String businessType, @NotNull @Valid WorkflowValidationRequest source) { }
    public record WorkflowPackageUpdateRequest(@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision,
        @NotNull @Valid WorkflowPackageRequest content) { }
    public record WorkflowRevisionRequest(@NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision) { }
    public record WorkflowPackageResponse(String id, String name, String businessType, String revision,
        String contentDigest, String validatedRevision, WorkflowValidationRequest source, Instant updatedAt) { }
    public record WorkflowPackageSummary(String id, String name, String businessType, String revision,
        String validatedRevision, Instant updatedAt) { }
    public record WorkflowPackageValidationResponse(String id, String revision, String contentDigest, String validatedRevision) { }

    @GetMapping @PreAuthorize("@ss.hasPermi('workflow:definition:list')") @Operation(operationId="listWorkflowPackages")
    public PageResponse<WorkflowPackageSummary> list(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
        @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize) {
        var result = service().list(page, pageSize);
        return new PageResponse<>(result.items().stream().map(row -> new WorkflowPackageSummary(row.id(), row.name(), row.businessType(),
            Long.toString(row.revision()), string(row.validatedRevision()), row.updatedAt())).toList(), result.total(), page, pageSize);
    }
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('workflow:definition:list')") @Operation(operationId="getWorkflowPackage")
    public WorkflowPackageResponse get(@PathVariable @Pattern(regexp=UUID_PATTERN) String id) { return response(service().get(id)); }
    @PostMapping @PreAuthorize("@ss.hasPermi('workflow:definition:edit')") @Operation(operationId="createWorkflowPackage")
    @Log(title="流程包草稿",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    @ApiResponse(responseCode="201",description="Created",content=@Content(schema=@Schema(implementation=WorkflowPackageResponse.class)))
    public ResponseEntity<WorkflowPackageResponse> create(@Valid @RequestBody WorkflowPackageRequest request) {
        var row=service().create(edit(request), Long.toString(SecurityUtils.getUserId()));
        return ResponseEntity.created(URI.create("/api/v1/workflow/packages/"+row.id())).body(response(row));
    }
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('workflow:definition:edit')") @Operation(operationId="updateWorkflowPackage")
    @Log(title="流程包草稿",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public WorkflowPackageResponse update(@PathVariable @Pattern(regexp=UUID_PATTERN) String id,
        @Valid @RequestBody WorkflowPackageUpdateRequest request) {
        return response(service().update(id, revision(request.expectedRevision()), edit(request.content()), Long.toString(SecurityUtils.getUserId())));
    }
    @PostMapping("/{id}/validation") @PreAuthorize("@ss.hasPermi('workflow:definition:validate')") @Operation(operationId="validateWorkflowPackage")
    @Log(title="流程包校验",businessType=BusinessType.OTHER,isSaveRequestData=false,isSaveResponseData=false)
    public WorkflowPackageValidationResponse validate(@PathVariable @Pattern(regexp=UUID_PATTERN) String id,
        @Valid @RequestBody WorkflowRevisionRequest request) {
        var row=service().validate(id, revision(request.expectedRevision()), Long.toString(SecurityUtils.getUserId()));
        return new WorkflowPackageValidationResponse(row.id(),Long.toString(row.revision()),row.contentDigest(),string(row.validatedRevision()));
    }
    private WorkflowPackages service() {
        var service=packages.getIfAvailable();
        if(service==null) throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");
        return service;
    }
    private static long revision(String revision) {
        try { long value=Long.parseLong(revision); if(value<1) throw new NumberFormatException(); return value; }
        catch(NumberFormatException failure) { throw new ApiFailure(400,"WORKFLOW_PACKAGE_INVALID","流程包版本无效。"); }
    }
    private static String string(Long value) { return value==null ? null : value.toString(); }
    private static WorkflowPackages.Edit edit(WorkflowPackageRequest request) {
        return new WorkflowPackages.Edit(request.name(),request.businessType(),new WorkflowValidation.Request(request.source().bpmnXml(),
            request.source().scenarios().stream().map(scenario -> new WorkflowValidation.Scenario(scenario.name(),scenario.decisions().stream()
                .map(decision -> new WorkflowValidation.Decision(decision.taskKey(),decision.approved())).toList(),scenario.expectedEnd())).toList()));
    }
    private static WorkflowPackageResponse response(WorkflowPackages.Draft draft) {
        return new WorkflowPackageResponse(draft.id(),draft.name(),draft.businessType(),Long.toString(draft.revision()),draft.contentDigest(),
            string(draft.validatedRevision()),new WorkflowValidationRequest(draft.source().bpmnXml(),draft.source().scenarios().stream()
                .map(scenario -> new WorkflowScenarioRequest(scenario.name(),scenario.decisions().stream()
                    .map(decision -> new WorkflowDecisionRequest(decision.taskKey(),decision.approved())).toList(),scenario.expectedEnd())).toList()),draft.updatedAt());
    }
}
