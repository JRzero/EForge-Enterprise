package io.eforge.enterprise.web.controller.api.v1.workflow;

import java.time.Instant;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import io.eforge.enterprise.workflow.api.WorkflowPurchases;

@RestController @RequestMapping("/api/v1/samples/purchases")
public class PurchaseController {
    private static final String UUID="[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final ObjectProvider<WorkflowPurchases> purchases;
    public PurchaseController(ObjectProvider<WorkflowPurchases> purchases){this.purchases=purchases;}
    public record PurchaseItemRequest(@NotBlank @Size(max=64) String id,@NotBlank @Size(max=200) String name,
        @NotBlank @Size(max=20) String unit,@NotBlank @Size(max=20) String quantity,@NotBlank @Size(max=20) String unitPrice) { }
    public record PurchaseEditRequest(@NotBlank @Size(max=100) String title,@NotBlank @Size(max=1000) String reason,
        @NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String approverId,@NotNull @Size(min=1,max=100) List<@NotNull @Valid PurchaseItemRequest> items) { }
    public record PurchaseCreateRequest(@NotNull @Pattern(regexp=UUID) String commandId,@NotNull @Valid PurchaseEditRequest content) { }
    public record PurchaseCommandRequest(@NotNull @Pattern(regexp=UUID) String commandId,
        @NotNull @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision,@NotNull @Size(max=500) String comment) { }
    public record PurchaseUpdateRequest(@NotNull @Valid PurchaseCommandRequest command,@NotNull @Valid PurchaseEditRequest content) { }
    public record PurchaseDecisionRequest(@NotNull @Valid PurchaseCommandRequest command,@NotNull Boolean approved) { }
    public record PurchaseResponse(@NotNull String id,@NotNull String initiatorId,@NotNull String approverId,
        @NotNull String title,@NotNull String reason,@NotNull String total,@NotNull String status,@NotNull String revision,
        String processId,String releaseId,@NotNull Instant createdAt) { }
    public record PurchaseItemResponse(@NotNull String id,@NotNull String name,@NotNull String unit,@NotNull String quantity,@NotNull String unitPrice,@NotNull String amount) { }
    public record PurchaseEventResponse(@NotNull String action,@NotNull String actorId,@NotNull String comment,@NotNull Instant createdAt) { }
    public record PurchaseDetailResponse(@NotNull PurchaseResponse purchase,@NotNull List<PurchaseItemResponse> items,@NotNull List<PurchaseEventResponse> history) { }
    public record PurchaseApproverResponse(@NotNull String id,@NotNull String name) { }
    public record PurchaseAttachmentResponse(@NotNull String id,@NotNull String name,@NotNull long size) { }
    @GetMapping("/{id}/attachments") @PreAuthorize("@ss.hasPermi('sample:purchase:list')") @Operation(operationId="listPurchaseAttachments")
    public List<PurchaseAttachmentResponse> attachments(@PathVariable @Pattern(regexp=UUID) String id){return service().attachments(id,actor()).stream().map(a->new PurchaseAttachmentResponse(a.id(),a.name(),a.size())).toList();}
    @GetMapping(value="/{id}/attachments/{attachmentId}",produces=MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @PreAuthorize("@ss.hasPermi('sample:purchase:list')") @Operation(operationId="downloadPurchaseAttachment")
    public ResponseEntity<byte[]> download(@PathVariable @Pattern(regexp=UUID) String id,@PathVariable @Pattern(regexp=UUID) String attachmentId){
        var download=service().download(id,attachmentId,actor());
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).header("X-Content-Type-Options","nosniff")
            .header("Cache-Control","no-store").header("Content-Disposition",ContentDisposition.attachment().filename(download.attachment().name(),StandardCharsets.UTF_8).build().toString()).body(download.content());
    }
    @PostMapping(value="/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="uploadPurchaseAttachment")
    @Log(title="采购附件",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse upload(@PathVariable @Pattern(regexp=UUID) String id,@RequestParam @Pattern(regexp=UUID) String commandId,
        @RequestParam @Pattern(regexp="[1-9][0-9]{0,18}") String expectedRevision,@RequestPart MultipartFile file){
        if(file.getSize()>5*1024*1024||file.isEmpty())throw new ApiFailure(400,"PURCHASE_ATTACHMENT_INVALID","附件大小无效。");
        try{return response(service().upload(id,command(new PurchaseCommandRequest(commandId,expectedRevision,"")),file.getOriginalFilename(),file.getBytes(),actor()));}
        catch(java.io.IOException failure){throw new ApiFailure(400,"PURCHASE_ATTACHMENT_INVALID","无法读取上传附件。");}
    }
    @PostMapping("/{id}/attachments/{attachmentId}/removal") @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="removePurchaseAttachment")
    @Log(title="移除采购附件",businessType=BusinessType.DELETE,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse removeAttachment(@PathVariable @Pattern(regexp=UUID) String id,@PathVariable @Pattern(regexp=UUID) String attachmentId,
        @RequestBody @Valid PurchaseCommandRequest request){return response(service().removeAttachment(id,attachmentId,command(request),actor()));}
    @GetMapping("/approvers") @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="listPurchaseApprovers")
    public PageResponse<PurchaseApproverResponse> approvers(@RequestParam(defaultValue="") @Size(max=50) String query,
        @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){
        var result=service().approvers(query,page,pageSize,actor());return new PageResponse<>(result.items().stream().map(a->new PurchaseApproverResponse(a.id(),a.name())).toList(),result.total(),page,pageSize);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="createPurchaseDraft")
    @Log(title="采购草稿",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse create(@RequestBody @Valid PurchaseCreateRequest request){return response(service().create(request.commandId(),edit(request.content()),actor()));}
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="updatePurchaseDraft")
    @Log(title="采购草稿",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse update(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid PurchaseUpdateRequest request){return response(service().update(id,command(request.command()),edit(request.content()),actor()));}
    @GetMapping @PreAuthorize("@ss.hasPermi('sample:purchase:list')") @Operation(operationId="listPurchases")
    public PageResponse<PurchaseResponse> list(@RequestParam(defaultValue="mine") @Pattern(regexp="mine|pending|handled") String view,
        @RequestParam(defaultValue="") @Pattern(regexp="|DRAFT|PENDING|APPROVED|REJECTED|WITHDRAWN") String status,
        @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize){
        var result=service().list(view,status,page,pageSize,actor());return new PageResponse<>(result.items().stream().map(PurchaseController::response).toList(),result.total(),page,pageSize);
    }
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('sample:purchase:list')") @Operation(operationId="getPurchase")
    public PurchaseDetailResponse get(@PathVariable @Pattern(regexp=UUID) String id){var result=service().get(id,actor());return new PurchaseDetailResponse(response(result.purchase()),result.items().stream().map(i->new PurchaseItemResponse(i.id(),i.name(),i.unit(),i.quantity(),i.unitPrice(),i.amount())).toList(),result.history().stream().map(e->new PurchaseEventResponse(e.action(),e.actorId(),e.comment(),e.createdAt())).toList());}
    @PostMapping("/{id}/submission") @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="submitPurchase")
    @Log(title="提交采购",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse submit(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid PurchaseCommandRequest request){return response(service().submit(id,command(request),actor()));}
    @PostMapping("/{id}/decision") @PreAuthorize("@ss.hasPermi('sample:purchase:approve')") @Operation(operationId="decidePurchase")
    @Log(title="审批采购",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse decide(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid PurchaseDecisionRequest request){return response(service().decide(id,command(request.command()),request.approved(),actor()));}
    @PostMapping("/{id}/withdrawal") @PreAuthorize("@ss.hasPermi('sample:purchase:write')") @Operation(operationId="withdrawPurchase")
    @Log(title="撤回采购",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    public PurchaseResponse withdraw(@PathVariable @Pattern(regexp=UUID) String id,@RequestBody @Valid PurchaseCommandRequest request){return response(service().withdraw(id,command(request),actor()));}
    private WorkflowPurchases service(){var value=purchases.getIfAvailable();if(value==null)throw new ApiFailure(503,"WORKFLOW_DISABLED","工作流功能尚未启用。");return value;}
    private static String actor(){return Long.toString(SecurityUtils.getUserId());}
    private static WorkflowPurchases.Edit edit(PurchaseEditRequest e){return new WorkflowPurchases.Edit(e.title(),e.reason(),e.approverId(),e.items().stream().map(i->new WorkflowPurchases.ItemInput(i.id(),i.name(),i.unit(),i.quantity(),i.unitPrice())).toList());}
    private static WorkflowPurchases.Command command(PurchaseCommandRequest c){try{return new WorkflowPurchases.Command(c.commandId(),Long.parseLong(c.expectedRevision()),c.comment());}catch(NumberFormatException failure){throw new ApiFailure(400,"PURCHASE_INVALID","采购版本无效。");}}
    private static PurchaseResponse response(WorkflowPurchases.Purchase p){return new PurchaseResponse(p.id(),p.initiatorId(),p.approverId(),p.title(),p.reason(),p.total(),p.status(),Long.toString(p.revision()),p.processId(),p.releaseId(),p.createdAt());}
}
