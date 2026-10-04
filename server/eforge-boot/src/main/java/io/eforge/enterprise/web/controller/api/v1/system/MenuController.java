package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import static io.eforge.enterprise.web.controller.api.v1.system.MenuContracts.*;

@RestController @RequestMapping("/api/v1/system/menus")
public class MenuController
{
    private final MenuService menus;
    public MenuController(MenuService menus) {this.menus=menus;}
    @GetMapping @PreAuthorize("@ss.hasPermi('system:menu:list')") @Operation(operationId="listMenus")
    public List<MenuResponse> list(@RequestParam(required=false) @Size(max=50) String name,
            @RequestParam(required=false) @Pattern(regexp="[01]?") String status,@RequestParam(required=false) Boolean visible)
    {return menus.list(name,status,visible);}
    @GetMapping("/options") @PreAuthorize("@ss.hasAnyPermi('system:menu:query,system:menu:add,system:menu:edit')") @Operation(operationId="getMenuOptions")
    public List<MenuResponse> options(@RequestParam(required=false) @Pattern(regexp="[1-9][0-9]{0,18}") String excludeId) {return menus.options(excludeId);}
    @GetMapping("/routes") @PreAuthorize("@ss.hasAnyPermi('system:menu:query,system:menu:add,system:menu:edit')") @Operation(operationId="getMenuRouteOptions")
    public List<MenuRouteOption> routes() {return menus.routeOptions();}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:menu:query')") @Operation(operationId="getMenu")
    public MenuResponse get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) {return menus.get(id);}
    @PostMapping @PreAuthorize("@ss.hasPermi('system:menu:add')") @Operation(operationId="createMenu") @Log(title="菜单管理",businessType=BusinessType.INSERT)
    public ResponseEntity<MenuResponse> create(@Valid @RequestBody MenuWriteRequest request)
    {var row=menus.create(request);return ResponseEntity.created(URI.create("/api/v1/system/menus/"+row.id())).body(row);}
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:menu:edit')") @Operation(operationId="updateMenu") @Log(title="菜单管理",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> update(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody MenuWriteRequest request)
    {menus.update(id,request);return ResponseEntity.noContent().build();}
    @PutMapping("/sort") @PreAuthorize("@ss.hasPermi('system:menu:edit')") @Operation(operationId="sortMenus") @Log(title="菜单排序",businessType=BusinessType.UPDATE)
    public ResponseEntity<Void> sort(@Valid @RequestBody MenuSortRequest request) {menus.sort(request);return ResponseEntity.noContent().build();}
    @DeleteMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:menu:remove')") @Operation(operationId="deleteMenu") @Log(title="菜单管理",businessType=BusinessType.DELETE)
    public ResponseEntity<Void> delete(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) {menus.delete(id);return ResponseEntity.noContent().build();}
}
