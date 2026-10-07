package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
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
import io.eforge.enterprise.common.core.domain.entity.SysDictType;
import io.eforge.enterprise.common.core.domain.entity.SysDictData;
import io.eforge.enterprise.common.utils.poi.CanonicalExcelUtil;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.DictionaryContracts.*;

@RestController
@RequestMapping("/api/v1/system")
public class DictionaryController
{
    private final DictionaryService dictionaries;
    public DictionaryController(DictionaryService dictionaries) {this.dictionaries=dictionaries;}
    @GetMapping("/dictionaries") @PreAuthorize("@ss.hasPermi('system:dict:list')") @Operation(operationId="listDictionaries")
    public PageResponse<DictionaryResponse> list(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue="") @Size(max=100) String name,@RequestParam(defaultValue="") @Size(max=100) String code,
            @RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to)
    {return dictionaries.list(page,pageSize,name,code,status,from,to);}
    // Original optionselect/type reads require authentication, not administration grants.
    @GetMapping("/dictionaries/options") @PreAuthorize("isAuthenticated()") @Operation(operationId="getDictionaryOptions")
    public List<DictionaryTypeOption> options() {return dictionaries.options();}
    @GetMapping("/dictionaries/lookup/{code}") @PreAuthorize("isAuthenticated()") @Operation(operationId="getDictionaryValues")
    public List<DictionaryValueOption> lookup(@PathVariable @Size(max=100) @Pattern(regexp="[a-z][a-z0-9_]*") String code) {return dictionaries.lookup(code);}
    @GetMapping("/dictionaries/{id}") @PreAuthorize("@ss.hasPermi('system:dict:query')") @Operation(operationId="getDictionary")
    public DictionaryResponse get(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) {return dictionaries.get(id);}
    @PostMapping("/dictionaries") @PreAuthorize("@ss.hasPermi('system:dict:add')") @Log(title="字典类型",businessType=BusinessType.INSERT) @Operation(operationId="createDictionary")
    @ApiResponse(responseCode="201",description="Created dictionary",content=@Content(schema=@Schema(implementation=DictionaryResponse.class)))
    public ResponseEntity<DictionaryResponse> create(@Valid @RequestBody DictionaryRequest request) {var row=dictionaries.create(request);return ResponseEntity.created(URI.create("/api/v1/system/dictionaries/"+row.id())).body(row);}
    @PutMapping("/dictionaries/{id}") @PreAuthorize("@ss.hasPermi('system:dict:edit')") @Log(title="字典类型",businessType=BusinessType.UPDATE) @Operation(operationId="updateDictionary")
    @ApiResponse(responseCode="204",description="Updated",content=@Content)
    public ResponseEntity<Void> update(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody DictionaryRequest request) {dictionaries.update(id,request);return ResponseEntity.noContent().build();}
    @DeleteMapping("/dictionaries") @PreAuthorize("@ss.hasPermi('system:dict:remove')") @Log(title="字典类型",businessType=BusinessType.DELETE) @Operation(operationId="deleteDictionaries")
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteDictionariesRequest request) {dictionaries.delete(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping("/dictionaries/cache/refresh") @PreAuthorize("@ss.hasPermi('system:dict:remove')") @Log(title="字典类型",businessType=BusinessType.CLEAN) @Operation(operationId="refreshDictionaryCache")
    @ApiResponse(responseCode="204",description="Cache refreshed",content=@Content)
    public ResponseEntity<Void> refresh() {dictionaries.refresh();return ResponseEntity.noContent().build();}
    @PostMapping(value="/dictionaries/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") @PreAuthorize("@ss.hasPermi('system:dict:export')") @Log(title="字典类型",businessType=BusinessType.EXPORT) @Operation(operationId="exportDictionaries")
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void export(HttpServletResponse response,@RequestParam(defaultValue="") @Size(max=100) String name,@RequestParam(defaultValue="") @Size(max=100) String code,@RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to)
    {new CanonicalExcelUtil<>(SysDictType.class).exportExcel(response,dictionaries.exportTypes(name,code,status,from,to),"字典类型");}
    @GetMapping("/dictionary-entries") @PreAuthorize("@ss.hasPermi('system:dict:list')") @Operation(operationId="listDictionaryEntries")
    public PageResponse<DictionaryEntryResponse> entries(@RequestParam(defaultValue="1") @Min(1) @Max(1000000) int page,@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize,
            @RequestParam @Pattern(regexp="[1-9][0-9]{0,18}") String dictionaryId,@RequestParam(defaultValue="") @Size(max=100) String label,@RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status)
    {return dictionaries.listEntries(page,pageSize,dictionaryId,label,status);}
    @GetMapping("/dictionary-entries/{id}") @PreAuthorize("@ss.hasPermi('system:dict:query')") @Operation(operationId="getDictionaryEntry")
    public DictionaryEntryResponse getEntry(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id) {return dictionaries.getEntry(id);}
    @PostMapping("/dictionary-entries") @PreAuthorize("@ss.hasPermi('system:dict:add')") @Log(title="字典数据",businessType=BusinessType.INSERT) @Operation(operationId="createDictionaryEntry")
    @ApiResponse(responseCode="201",description="Created entry",content=@Content(schema=@Schema(implementation=DictionaryEntryResponse.class)))
    public ResponseEntity<DictionaryEntryResponse> createEntry(@Valid @RequestBody EntryRequest request) {var row=dictionaries.createEntry(request);return ResponseEntity.created(URI.create("/api/v1/system/dictionary-entries/"+row.id())).body(row);}
    @PutMapping("/dictionary-entries/{id}") @PreAuthorize("@ss.hasPermi('system:dict:edit')") @Log(title="字典数据",businessType=BusinessType.UPDATE) @Operation(operationId="updateDictionaryEntry")
    @ApiResponse(responseCode="204",description="Updated",content=@Content)
    public ResponseEntity<Void> updateEntry(@PathVariable @Pattern(regexp="[1-9][0-9]{0,18}") String id,@Valid @RequestBody EntryRequest request) {dictionaries.updateEntry(id,request);return ResponseEntity.noContent().build();}
    @DeleteMapping("/dictionary-entries") @PreAuthorize("@ss.hasPermi('system:dict:remove')") @Log(title="字典数据",businessType=BusinessType.DELETE) @Operation(operationId="deleteDictionaryEntries")
    @ApiResponse(responseCode="204",description="Deleted",content=@Content)
    public ResponseEntity<Void> deleteEntries(@Valid @RequestBody DeleteDictionaryEntriesRequest request) {dictionaries.deleteEntries(request.ids());return ResponseEntity.noContent().build();}
    @PostMapping(value="/dictionary-entries/export",produces="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") @PreAuthorize("@ss.hasPermi('system:dict:export')") @Log(title="字典数据",businessType=BusinessType.EXPORT) @Operation(operationId="exportDictionaryEntries")
    @ApiResponse(responseCode="200",description="Filtered XLSX",content=@Content(mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",schema=@Schema(type="string",format="binary")))
    public void exportEntries(HttpServletResponse response,@RequestParam @Pattern(regexp="[1-9][0-9]{0,18}") String dictionaryId,@RequestParam(defaultValue="") @Size(max=100) String label,@RequestParam(defaultValue="") @Pattern(regexp="[01]?") String status)
    {new CanonicalExcelUtil<>(SysDictData.class).exportExcel(response,dictionaries.exportEntries(dictionaryId,label,status),"字典数据");}
}
