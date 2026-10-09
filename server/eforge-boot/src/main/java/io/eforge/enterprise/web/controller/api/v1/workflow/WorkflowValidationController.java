package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowValidation;

/** Present in both configurations so disabling the engine never changes the API contract. */
@RestController
@RequestMapping("/api/v1/workflow")
public class WorkflowValidationController {
    private final ObjectProvider<WorkflowValidation> validation;
    public WorkflowValidationController(ObjectProvider<WorkflowValidation> validation) { this.validation = validation; }

    public record WorkflowStatus(boolean enabled) { }
    public record WorkflowDecisionRequest(@NotBlank @Pattern(regexp="[A-Za-z][A-Za-z0-9_]{0,63}") String taskKey,
        @NotNull Boolean approved) { }
    public record WorkflowScenarioRequest(@NotBlank @Size(max=64) String name,
        @NotEmpty @Size(max=100) List<@NotNull @Valid WorkflowDecisionRequest> decisions,
        @NotBlank @Pattern(regexp="[A-Za-z][A-Za-z0-9_]{0,63}") String expectedEnd) { }
    public record WorkflowValidationRequest(@NotBlank @Size(max=262144) String bpmnXml,
        @NotEmpty @Size(max=20) List<@NotNull @Valid WorkflowScenarioRequest> scenarios) { }
    public record WorkflowScenarioResponse(String name, List<String> completedTasks, String endActivity) { }
    public record WorkflowValidationResponse(String processKey, String sha256, List<WorkflowScenarioResponse> scenarios) { }

    @GetMapping("/status") @PreAuthorize("isAuthenticated()") @Operation(operationId="getWorkflowStatus")
    public WorkflowStatus status() { return new WorkflowStatus(validation.getIfAvailable() != null); }

    @PostMapping("/validation") @PreAuthorize("@ss.hasPermi('workflow:definition:validate')")
    @Operation(operationId="validateWorkflowScenarios")
    @Log(title="流程场景校验", businessType=BusinessType.OTHER, isSaveRequestData=false, isSaveResponseData=false)
    public WorkflowValidationResponse validate(@Valid @RequestBody WorkflowValidationRequest request) {
        var validator = validation.getIfAvailable();
        if (validator == null) throw new ApiFailure(503, "WORKFLOW_DISABLED", "工作流功能尚未启用。");
        var result = validator.validate(new WorkflowValidation.Request(request.bpmnXml(), request.scenarios().stream()
            .map(scenario -> new WorkflowValidation.Scenario(scenario.name(), scenario.decisions().stream()
                .map(decision -> new WorkflowValidation.Decision(decision.taskKey(), decision.approved())).toList(), scenario.expectedEnd())).toList()));
        return new WorkflowValidationResponse(result.processKey(), result.sha256(), result.scenarios().stream()
            .map(scenario -> new WorkflowScenarioResponse(scenario.name(), scenario.completedTasks(), scenario.endActivity())).toList());
    }
}
