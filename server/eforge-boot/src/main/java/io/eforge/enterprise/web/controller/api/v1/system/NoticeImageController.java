package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;

@RestController
@RequestMapping("/api/v1/system/notices/images")
public class NoticeImageController
{
    private final NoticeImageStore images;
    public NoticeImageController(NoticeImageStore images) {this.images = images;}
    public record NoticeImageResponse(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String imageUrl) {}
    @PostMapping(consumes="multipart/form-data")
    @PreAuthorize("@ss.hasPermi('system:notice:add') or @ss.hasPermi('system:notice:edit')")
    @Operation(operationId="uploadNoticeImage")
    @Log(title="公告图片", businessType=BusinessType.INSERT, isSaveRequestData=false, isSaveResponseData=false)
    @ApiResponse(responseCode="201", description="Image stored", content=@Content(schema=@Schema(implementation=NoticeImageResponse.class)))
    public ResponseEntity<NoticeImageResponse> upload(@RequestPart MultipartFile file)
    {var stored = images.upload(file); return ResponseEntity.created(URI.create(stored.imageUrl())).header("Cache-Control", "no-store").body(new NoticeImageResponse(stored.imageUrl()));}
}
