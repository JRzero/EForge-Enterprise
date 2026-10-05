package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;

@RestController
@RequestMapping("/api/v1/monitor/consoles")
public class ConsoleAccessController
{
    private final ConsoleAccessService access;
    public ConsoleAccessController(ConsoleAccessService access){this.access=access;}
    public record ConsoleStatus(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean enabled){}
    public record ConsoleEntry(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String entryPath,
            @Schema(requiredMode=Schema.RequiredMode.REQUIRED) int expiresInSeconds){}
    @GetMapping("/druid") @Operation(operationId="getDruidConsoleStatus")
    public ResponseEntity<ConsoleStatus> druid(){return status(ConsoleTarget.DRUID);}
    @GetMapping("/api-docs") @Operation(operationId="getApiDocsConsoleStatus")
    public ResponseEntity<ConsoleStatus> docs(){return status(ConsoleTarget.API_DOCS);}
    @PostMapping("/druid/session") @Operation(operationId="openDruidConsole")
    public ResponseEntity<ConsoleEntry> openDruid(HttpServletRequest request){return open(ConsoleTarget.DRUID,request);}
    @PostMapping("/api-docs/session") @Operation(operationId="openApiDocsConsole")
    public ResponseEntity<ConsoleEntry> openDocs(HttpServletRequest request){return open(ConsoleTarget.API_DOCS,request);}
    private ResponseEntity<ConsoleStatus> status(ConsoleTarget target)
    {access.authorize(target,SecurityUtils.getLoginUser());return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store").body(new ConsoleStatus(access.enabled(target)));}
    private ResponseEntity<ConsoleEntry> open(ConsoleTarget target,HttpServletRequest request)
    {var cookie=access.open(target,SecurityUtils.getLoginUser(),request);return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store")
        .header(HttpHeaders.SET_COOKIE,cookie.toString()).body(new ConsoleEntry(target.entryPath(),ConsoleTicketService.LIFETIME_SECONDS));}
}
