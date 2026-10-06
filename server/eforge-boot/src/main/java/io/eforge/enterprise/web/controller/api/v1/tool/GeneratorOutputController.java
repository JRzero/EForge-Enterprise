package io.eforge.enterprise.web.controller.api.v1.tool;

import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorOutputContracts.*;

@RestController @RequestMapping("/api/v1/tool/generator")
public class GeneratorOutputController {
    private final GeneratorOutputService output;
    public GeneratorOutputController(GeneratorOutputService output){this.output=output;}
    @GetMapping("/tables/{id}/preview") @PreAuthorize("@ss.hasPermi('tool:gen:preview')")
    @Operation(operationId="previewGeneratorTable")
    public ResponseEntity<PreviewResponse> preview(@PathVariable String id){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(output.preview(id));
    }
    @PostMapping(value="/downloads",produces="application/zip") @PreAuthorize("@ss.hasPermi('tool:gen:code')")
    @Log(title="代码生成",businessType=BusinessType.GENCODE) @Operation(operationId="downloadGeneratorTables")
    @ApiResponse(responseCode="200",description="Complete generated files",content=@Content(mediaType="application/zip",schema=@Schema(type="string",format="binary")))
    public ResponseEntity<byte[]> download(@Valid @RequestBody DownloadRequest request){
        byte[] archive=output.download(request.tableIds());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip")).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"eforge-generated.zip\"")
            .contentLength(archive.length).body(archive);
    }
}