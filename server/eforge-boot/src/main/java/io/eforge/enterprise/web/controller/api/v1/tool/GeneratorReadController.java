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
    private final io.eforge.enterprise.system.service.ISysMenuService menus;
    public GeneratorReadController(GeneratorReadService generator,io.eforge.enterprise.system.service.ISysMenuService menus){this.generator=generator;this.menus=menus;}
    // The original treeselect is authenticated and scoped by the current user, with no menu-administration grant.
    @GetMapping("/menu-options") @PreAuthorize("isAuthenticated()") @Operation(operationId="getGeneratorMenuOptions")
    public List<MenuChoice> menuOptions(){
        return menus.selectMenuList(new io.eforge.enterprise.common.core.domain.entity.SysMenu(),io.eforge.enterprise.common.utils.SecurityUtils.getUserId())
            .stream().map(row->new MenuChoice(row.getMenuId().toString(),row.getParentId()==null?"0":row.getParentId().toString(),row.getMenuName(),row.getMenuType())).toList();
    }
    @GetMapping("/tables") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorTables")
    public PageResponse<TableSummary> list(@Valid @ModelAttribute @ParameterObject TableQuery query){return generator.list(query);}
    @GetMapping("/database-tables") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorDatabaseTables")
    public PageResponse<DatabaseTable> database(@Valid @ModelAttribute @ParameterObject TableQuery query){return generator.database(query);}
    @GetMapping("/tables/{id}") @PreAuthorize("@ss.hasPermi('tool:gen:query')") @Operation(operationId="getGeneratorTable")
    public TableDetail detail(@PathVariable String id){return generator.detail(id);}
    @GetMapping("/tables/{id}/columns") @PreAuthorize("@ss.hasPermi('tool:gen:list')") @Operation(operationId="listGeneratorColumns")
    public List<ColumnResponse> columns(@PathVariable String id){return generator.columns(id);}
}
