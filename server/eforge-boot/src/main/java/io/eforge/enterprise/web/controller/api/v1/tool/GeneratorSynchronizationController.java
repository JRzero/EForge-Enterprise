package io.eforge.enterprise.web.controller.api.v1.tool;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.generator.service.GeneratorSynchronizationService;

@RestController @RequestMapping("/api/v1/tool/generator/tables")
public class GeneratorSynchronizationController {
    private final GeneratorSynchronizationService synchronization;
    public GeneratorSynchronizationController(GeneratorSynchronizationService synchronization){this.synchronization=synchronization;}
    @PostMapping("/{id}/synchronize") @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@ss.hasPermi('tool:gen:edit')") @Log(title="代码生成",businessType=BusinessType.UPDATE)
    @Operation(operationId="synchronizeGeneratorTable")
    public void synchronize(@PathVariable String id){synchronization.byId(id,SecurityUtils.getUsername());}
}
