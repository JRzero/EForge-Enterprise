package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Instant;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.framework.web.domain.Server;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/** Canonical diagnostics; upstream mutable probes remain behind this boundary. */
public record ServerMonitorResponse(@Schema(requiredMode=REQUIRED) Instant sampledAt,
        @Schema(requiredMode=REQUIRED) CpuMetrics cpu,
        @Schema(requiredMode=REQUIRED) MemoryMetrics memory,
        @Schema(requiredMode=REQUIRED) JvmMetrics jvm,
        @Schema(requiredMode=REQUIRED) HostMetrics host,
        @Schema(requiredMode=REQUIRED) List<DiskMetrics> disks)
{
    public ServerMonitorResponse {disks=List.copyOf(disks);}
    public record CpuMetrics(int coreCount,double userPercent,double systemPercent,double idlePercent,double waitPercent) {}
    /** RAM measurements are GiB, preserving the existing probe's binary conversion. */
    public record MemoryMetrics(double totalGiB,double usedGiB,double freeGiB,double usagePercent) {}
    /** JVM measurements are MiB. Times/arguments retain the existing diagnostic display format. */
    public record JvmMetrics(String name,String version,String home,double totalMiB,double maxMiB,double usedMiB,double freeMiB,
            double usagePercent,String startedAt,String uptime,String arguments) {}
    public record HostMetrics(String name,String ip,String operatingSystem,String architecture,String workingDirectory) {}
    /** Sizes preserve upstream human-readable disk formatting and mount/type information. */
    public record DiskMetrics(String mount,String fileSystem,String type,String totalSize,String usedSize,String freeSize,double usagePercent) {}
    static ServerMonitorResponse from(Server server) {
        var cpu=server.getCpu();var memory=server.getMem();var jvm=server.getJvm();var host=server.getSys();
        return new ServerMonitorResponse(Instant.now(),new CpuMetrics(cpu.getCpuNum(),cpu.getUsed(),cpu.getSys(),cpu.getFree(),cpu.getWait()),
                new MemoryMetrics(memory.getTotal(),memory.getUsed(),memory.getFree(),memory.getUsage()),
                new JvmMetrics(jvm.getName(),jvm.getVersion(),jvm.getHome(),jvm.getTotal(),jvm.getMax(),jvm.getUsed(),jvm.getFree(),
                        jvm.getUsage(),jvm.getStartTime(),jvm.getRunTime(),jvm.getInputArgs()),
                new HostMetrics(host.getComputerName(),host.getComputerIp(),host.getOsName(),host.getOsArch(),host.getUserDir()),
                server.getSysFiles().stream().map(disk->new DiskMetrics(disk.getDirName(),disk.getSysTypeName(),disk.getTypeName(),
                        disk.getTotal(),disk.getUsed(),disk.getFree(),disk.getUsage())).toList());
    }
}
