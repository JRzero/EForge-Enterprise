package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorReadContracts.*;

@RestController @RequestMapping("/api/v1/tool/generator")
public class GeneratorReadController {
    private final GeneratorReadService generator;
    public GeneratorReadController(GeneratorReadService generator){this.generator=generator;}
    @GetMapping("/tables") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorTables")
    public PageResponse<TableSummary> list(@Valid @ModelAttribute @ParameterObject TableQuery query){return generator.list(query);}
    @GetMapping("/database-tables") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorDatabaseTables")
    public PageResponse<DatabaseTable> database(@Valid @ModelAttribute @ParameterObject TableQuery query){return generator.database(query);}
    @GetMapping("/tables/{id}") @PreAuthorize("@ss.hasPermi('tool:gen:query')") @Operation(operationId="getGeneratorTable")
    public TableDetail detail(@PathVariable String id){return generator.detail(id);}
    @GetMapping("/tables/{id}/columns") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorColumns")
    public List<ColumnResponse> columns(@PathVariable String id){return generator.columns(id);}
}
