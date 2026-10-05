package io.eforge.enterprise.web.controller.api.v1.tool;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.SecurityUtils;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorConfigurationContracts.*;

@RestController @RequestMapping("/api/v1/tool/generator")
public class GeneratorConfigurationController {
    private final GeneratorConfigurationService generator;
    public GeneratorConfigurationController(GeneratorConfigurationService generator){this.generator=generator;}
    @PutMapping("/tables/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@ss.hasPermi('tool:gen:edit')") @Log(title="代码生成",businessType=BusinessType.UPDATE)
    @Operation(operationId="updateGeneratorTable")
    public void update(@PathVariable String id,@Valid @RequestBody UpdateRequest input){generator.update(id,input,SecurityUtils.getUsername());}
}
