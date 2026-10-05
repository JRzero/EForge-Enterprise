package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import static io.eforge.enterprise.web.controller.api.v1.monitor.CacheMonitorContracts.*;

@RestController
@RequestMapping("/api/v1/monitor/cache")
@PreAuthorize("@ss.hasPermi('monitor:cache:list')")
public class CacheMonitorController
{
    private final CacheMonitorService cache;
    public CacheMonitorController(CacheMonitorService cache){this.cache=cache;}
    @GetMapping @Operation(operationId="getCacheStatistics")
    public CacheStatistics statistics(){return cache.statistics();}
    @GetMapping("/names") @Operation(operationId="listCacheNames")
    public List<CacheName> names(){return cache.names();}
    @GetMapping("/keys") @Operation(operationId="listCacheKeys")
    public List<String> keys(@RequestParam @Pattern(regexp=NAMESPACE) String name){return cache.keys(name);}
    @GetMapping("/value") @Operation(operationId="getCacheValue")
    public CacheValue value(@RequestParam @Pattern(regexp=NAMESPACE) String name,@RequestParam @Size(max=4096) String key){return cache.value(name,key);}
    @DeleteMapping("/names/{name}") @Operation(operationId="clearCacheName")
    @ApiResponse(responseCode="204",description="Namespace snapshot cleared",content=@Content)
    public ResponseEntity<Void> clearName(@PathVariable @Pattern(regexp=NAMESPACE) String name){cache.clearName(name);return ResponseEntity.noContent().build();}
    @DeleteMapping("/keys") @Operation(operationId="clearCacheKey")
    @ApiResponse(responseCode="204",description="Key cleared (already absent also succeeds)",content=@Content)
    public ResponseEntity<Void> clearKey(@Valid @RequestBody ClearCacheKeyRequest request){cache.clearKey(request.name(),request.key());return ResponseEntity.noContent().build();}
    @DeleteMapping @Operation(operationId="clearAllCache")
    @ApiResponse(responseCode="204",description="All keys in the selected Redis database cleared, including login sessions",content=@Content)
    public ResponseEntity<Void> clearAll(){cache.clearAll();return ResponseEntity.noContent().build();}
}
