package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.*;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.DataFormatter;
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
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;

@RestController
@RequestMapping("/api/v1/system/users")
public class UserImportController
{
    private final UserImportService importer;
    public UserImportController(UserImportService importer) { this.importer = importer; }
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
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024 || !(name.endsWith(".xls") || name.endsWith(".xlsx")))
            throw invalidFile();
        try (var input = file.getInputStream(); var workbook = WorkbookFactory.create(input))
        {
            if (workbook.getNumberOfSheets() == 0) throw invalidFile();
            var sheet = workbook.getSheetAt(0);
            if (sheet.getLastRowNum() > 1000) throw new ApiFailure(400, "USER_IMPORT_TOO_LARGE", "A workbook can contain at most 1000 data rows.");
            if (sheet.getRow(0) == null) throw invalidFile();
            boolean hasUsername = false; DataFormatter formatter = new DataFormatter();
            for (var cell : sheet.getRow(0)) if ("登录名称".equals(formatter.formatCellValue(cell))) hasUsername = true;
            if (!hasUsername) throw invalidFile();
        }
        catch (ApiFailure exception) { throw exception; }
        catch (Exception exception) { throw invalidFile(); }
        List<SysUser> rows;
        try { rows = new ExcelUtil<>(SysUser.class).importExcel(file.getInputStream()); }
        catch (Exception exception) { throw invalidFile(); }
        if (rows == null || rows.isEmpty()) throw new ApiFailure(400, "USER_IMPORT_EMPTY", "The workbook has no data rows.");
        return importer.importUsers(rows, updateExisting);
    }
    @PostMapping(value = "/import-template", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('system:user:import')")
    @Operation(operationId = "downloadUserImportTemplate")
    @ApiResponse(responseCode = "200", description = "Original user import columns and converters", content = @Content(mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", schema = @Schema(type = "string", format = "binary")))
    public void template(HttpServletResponse response)
    { new ExcelUtil<>(SysUser.class).importTemplateExcel(response, "用户数据"); }
    private static ApiFailure invalidFile() { return new ApiFailure(400, "USER_IMPORT_FILE_INVALID", "Upload a valid XLS or XLSX user workbook."); }
}
