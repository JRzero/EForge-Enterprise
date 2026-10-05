package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;

@RestController @RequestMapping("/api/v1/tool/generator/tables")
public class GeneratorDeletionController {
    public record DeleteGeneratorTablesRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    private final GeneratorDeletionService generator;
    public GeneratorDeletionController(GeneratorDeletionService generator){this.generator=generator;}
    @DeleteMapping @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@ss.hasPermi('tool:gen:remove')") @Log(title="代码生成",businessType=BusinessType.DELETE)
    @Operation(operationId="deleteGeneratorTables")
    public void delete(@Valid @RequestBody DeleteGeneratorTablesRequest request){generator.delete(request.ids());}
}
