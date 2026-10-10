package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.util.List;
import jakarta.validation.constraints.Pattern;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowComparisons;

@RestController @RequestMapping("/api/v1/workflow/packages")
public class WorkflowComparisonController {
    private static final String UUID_PATTERN="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowComparisons> comparisons;
    public WorkflowComparisonController(ObjectProvider<WorkflowComparisons> comparisons){this.comparisons=comparisons;}
    public record WorkflowComparisonVersion(String kind,String id,String revision,String contentDigest) { }
    public record WorkflowComparisonField(String name,String before,String after,boolean changed) { }
    public record WorkflowComparisonResponse(String packageId,WorkflowComparisonVersion baseline,
        WorkflowComparisonVersion target,List<WorkflowComparisonField> fields) { }
    @GetMapping("/{id}/comparison") @PreAuthorize("@ss.hasPermi('workflow:definition:list')")
    @Operation(operationId="compareWorkflowPackage")
    public WorkflowComparisonResponse compare(@PathVariable @Pattern(regexp=UUID_PATTERN) String id,
        @RequestParam @Pattern(regexp=UUID_PATTERN) String baselineReleaseId,
        @RequestParam(required=false) @Pattern(regexp=UUID_PATTERN) String targetReleaseId){
        var service=comparisons.getIfAvailable();if(service==null)throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");
        var result=service.compare(id,baselineReleaseId,targetReleaseId);
        return new WorkflowComparisonResponse(result.packageId(),version(result.baseline()),version(result.target()),
            result.fields().stream().map(f->new WorkflowComparisonField(f.name(),f.before(),f.after(),f.changed())).toList());
    }
    private static WorkflowComparisonVersion version(WorkflowComparisons.Version value){return new WorkflowComparisonVersion(value.kind(),value.id(),Long.toString(value.revision()),value.contentDigest());}
}
