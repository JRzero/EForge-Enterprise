package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.time.LocalDate;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.utils.poi.CanonicalExcelUtil;
import io.eforge.enterprise.system.domain.SysConfig;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.ConfigurationContracts.*;

@RestController
@RequestMapping("/api/v1/system/configurations")
public class ConfigurationController
{
    private final ConfigurationService configurations;
    public ConfigurationController(ConfigurationService configurations){this.configurations=configurations;}
    @GetMapping @PreAuthorize("@ss.hasPermi('system:config:list')") @Operation(operationId="listConfigurations")
    public PageResponse<ConfigurationResponse> list(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=100) String name,@RequestParam(defaultValue="") @Size(max=100) String key,@RequestParam(required=false) Boolean builtin,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to)
    {return configurations.list(page,pageSize,name,key,builtin,from,to);}
    @GetMapping("/lookup") @PreAuthorize("isAuthenticated()") @Operation(operationId="getConfigurationValue")
    public ConfigurationValueResponse lookup(@RequestParam @NotBlank @Size(max=100) String key){return configurations.lookup(key);}
    @GetMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:config:query')") @Operation(operationId="getConfiguration")
    public ConfigurationResponse get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id){return configurations.get(id);}
    @PostMapping @PreAuthorize("@ss.hasPermi('system:config:add')") @Operation(operationId="createConfiguration")
    @Log(title="参数管理",businessType=BusinessType.INSERT,isSaveRequestData=false,isSaveResponseData=false)
    @ApiResponse(responseCode="201",description="Created",content=@Content(schema=@Schema(implementation=ConfigurationResponse.class)))
    public ResponseEntity<ConfigurationResponse> create(@Valid @RequestBody ConfigurationRequest request){var row=configurations.create(request);return ResponseEntity.created(URI.create("/api/v1/system/configurations/"+row.id())).body(row);}
    @PutMapping("/{id}") @PreAuthorize("@ss.hasPermi('system:config:edit')") @Operation(operationId="updateConfiguration")
    @Log(title="参数管理",businessType=BusinessType.UPDATE,isSaveRequestData=false,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Updated",content=@Content)
    public ResponseEntity<Void> update(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody ConfigurationRequest request){configurations.update(id,request);return ResponseEntity.noContent().build();}
    @DeleteMapping @PreAuthorize("@ss.hasPermi('system:config:remove')") @Operation(operationId="deleteConfigurations")
    @Log(title="参数管理",businessType=BusinessType.DELETE)
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteConfigurationsRequest request){configurations.delete(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping("/cache/refresh") @PreAuthorize("@ss.hasPermi('system:config:remove')") @Operation(operationId="refreshConfigurationCache")
    @Log(title="参数管理",businessType=BusinessType.CLEAN)
    @ApiResponse(responseCode="204",description="Cache refreshed",content=@Content)
    public ResponseEntity<Void> refresh(){configurations.refresh();return ResponseEntity.noContent().build();}
    @PostMapping(value="/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") @PreAuthorize("@ss.hasPermi('system:config:export')") @Operation(operationId="exportConfigurations")
    @Log(title="参数管理",businessType=BusinessType.EXPORT)
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@RequestParam(defaultValue="") @Size(max=100) String name,@RequestParam(defaultValue="") @Size(max=100) String key,@RequestParam(required=false) Boolean builtin,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to)
    {new CanonicalExcelUtil<>(SysConfig.class).exportExcel(response,configurations.export(name,key,builtin,from,to),"参数数据");}
}
