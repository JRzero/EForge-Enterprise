package io.eforge.enterprise.web.controller.api.v1.monitor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;

@RestController
@RequestMapping("/api/v1/monitor/server")
public class ServerMonitorController
{
    private final ServerMonitorService monitor;
    public ServerMonitorController(ServerMonitorService monitor){this.monitor=monitor;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:server:list')") @Operation(operationId="getServerMonitor")
    public ServerMonitorResponse get(){return monitor.snapshot();}
}
