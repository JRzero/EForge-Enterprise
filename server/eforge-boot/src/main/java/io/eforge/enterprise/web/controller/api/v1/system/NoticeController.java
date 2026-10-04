package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.NoticeContracts.*;

@RestController
@RequestMapping("/api/v1/system/notices")
public class NoticeController
{
    private final NoticeService notices;
    public NoticeController(NoticeService notices) { this.notices=notices; }

    @GetMapping @PreAuthorize("@ss.hasPermi('system:notice:list')") @Operation(operationId="listNotices")
    public PageResponse<NoticeResponse> list(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=50) String title,
            @RequestParam(defaultValue="") @Size(max=64) String author,
            @RequestParam(required=false) @Pattern(regexp="[12]") String type)
    { return notices.list(page,pageSize,title,author,type); }

    @GetMapping("/feed") @PreAuthorize("isAuthenticated()") @Operation(operationId="getNoticeFeed")
    public NoticeFeed feed() { return notices.feed(); }

    @GetMapping("/{id}") @PreAuthorize("isAuthenticated()") @Operation(operationId="getNotice")
    public NoticeResponse get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) { return notices.get(id); }

    @PostMapping @PreAuthorize("@ss.hasPermi('system:notice:add')") @Operation(operationId="createNotice")
    @Log(title="通知公告",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    @ApiResponse(responseCode="201",description="Created",content=@Content(schema=@Schema(implementation=NoticeResponse.class)))
    public ResponseEntity<NoticeResponse> create(@Valid @RequestBody NoticeRequest request)
    { var row=notices.create(request); return ResponseEntity.created(URI.create("/api/v1/system/notices/"+row.id())).body(row); }

    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:notice:edit')") @Operation(operationId="updateNotice")
    @Log(title="通知公告",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Updated",content=@Content)
    public ResponseEntity<Void> update(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody NoticeRequest request)
    { notices.update(id,request); return ResponseEntity.noContent().build(); }

    @DeleteMapping @PreAuthorize("@ss.hasPermi('system:notice:remove')") @Operation(operationId="deleteNotices")
    @Log(title="通知公告",businessType=BusinessType.DELETE)
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody NoticeIdsRequest request)
    { notices.delete(request.ids()); return ResponseEntity.noContent().build(); }

    @PostMapping("/read") @PreAuthorize("isAuthenticated()") @Operation(operationId="markNoticesRead")
    @ApiResponse(responseCode="204",description="Read state recorded",content=@Content)
    public ResponseEntity<Void> markRead(@Valid @RequestBody NoticeIdsRequest request)
    { notices.markRead(request.ids()); return ResponseEntity.noContent().build(); }

    @GetMapping("/{id}/readers") @PreAuthorize("@ss.hasPermi('system:notice:list')") @Operation(operationId="listNoticeReaders")
    public PageResponse<NoticeReader> readers(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,
            @RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=64) String search)
    { return notices.readers(id,page,pageSize,search); }
}
