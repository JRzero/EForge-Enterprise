package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;

@RestController
@RequestMapping("/api/v1/system/users")
public class UserImportController
{
    private final UserImportService importer;
    private final UserImportFileReader files;
    public UserImportController(UserImportService importer, UserImportFileReader files)
    { this.importer = importer; this.files = files; }
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record UserImportRow(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "One-based imported record ordinal") int row,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String username,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"CREATED", "UPDATED", "FAILED"}) String outcome, String code) {}
    public record UserImportResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int total,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int created,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int updated,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int failed,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UserImportRow> rows) {}

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("@ss.hasPermi('system:user:import')")
    @Log(title = "用户导入", businessType = BusinessType.IMPORT, isSaveRequestData = false, isSaveResponseData = false)
    @Operation(operationId = "importUsers")
    public UserImportResponse importFile(@RequestPart MultipartFile file, @RequestParam(defaultValue = "false") boolean updateExisting)
    {
        return importer.importUsers(files.read(file), updateExisting);
    }
    @PostMapping(value = "/import-template", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('system:user:import')")
    @Operation(operationId = "downloadUserImportTemplate")
    @ApiResponse(responseCode = "200", description = "Original user import columns and converters", content = @Content(mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", schema = @Schema(type = "string", format = "binary")))
    public void template(HttpServletResponse response)
    { new ExcelUtil<>(SysUser.class).importTemplateExcel(response, "用户数据"); }
}
