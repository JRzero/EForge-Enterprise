package io.eforge.enterprise.web.controller.api.v1.monitor;

import org.springframework.stereotype.Service;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.web.domain.Server;

@Service
public class ServerMonitorService
{
    public ServerMonitorResponse snapshot() {
        try {return ServerMonitorResponse.from(sample());}
        catch(Exception failure) {
            if(failure instanceof InterruptedException)Thread.currentThread().interrupt();
            throw new ApiFailure(503,"SERVER_MONITOR_UNAVAILABLE","Server diagnostics are temporarily unavailable.");
        }
    }
    // Local sampling seam keeps tests off platform hardware; production uses the original OSHI probe.
    Server sample() throws Exception {var server=new Server();server.copyTo();return server;}
}
