package io.eforge.enterprise.web.controller.api.v1.tool;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.SecurityUtils;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorImportContracts.*;

@RestController @RequestMapping("/api/v1/tool/generator")
public class GeneratorImportController {
    private final GeneratorImportService generator;
    public GeneratorImportController(GeneratorImportService generator){this.generator=generator;}
    @PostMapping("/imports") @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@ss.hasPermi('tool:gen:import')")
    @Log(title="代码生成",businessType=BusinessType.IMPORT)
    @Operation(operationId="importGeneratorTables")
    public ImportResponse importTables(@Valid @RequestBody ImportRequest request) {
        return generator.importTables(request,SecurityUtils.getUsername());
    }
}
