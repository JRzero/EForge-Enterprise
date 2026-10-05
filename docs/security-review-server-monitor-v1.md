# Canonical server diagnostics boundary

GET `/api/v1/monitor/server` retains the original `monitor:server:list` grant and
production security filters. Unauthorized/anonymous callers are rejected before
sampling. Monitoring remains a privileged global capability, not a department
data-scope resource. The existing compatibility endpoint and OSHI collector are
unchanged; the mutable RuoYi Server object stays behind the canonical projection.

The concrete response has CPU, RAM, JVM, host and disk groups plus a sampledAt
instant. CPU percentages and core count use the original collector. RAM values
use its binary GiB conversion and JVM values its binary MiB conversion. Disk
mount/type/size formatting and JVM start/uptime/argument display strings retain
original behavior. Host paths, Java installation and JVM arguments remain
privileged diagnostics under the original grant; the endpoint does not enumerate
environment variables or expose a complete System properties map. It returns
neither login credentials nor cached session/grant objects.

Sampling/projection exceptions return generic 503 SERVER_MONITOR_UNAVAILABLE,
without internal host/path/exception details. An interrupted probe preserves the
thread's interrupt flag. No new scheduler, agent, remote monitoring service or
framework abstraction is introduced. Platform hardware remains the source of
truth; tests use the service's local sampling seam to avoid fabricated production
measurements or hardware-dependent unit timing.

Six targeted cases verify production grants/authentication, binary units and
percentages, all diagnostic groups, immutable disks, successful projection,
generic I/O fault handling and interruption. Actual OSHI sampling in the owned
MySQL/Redis runtime checks CPU/RAM/JVM/host/disks, percentage bounds, stable
identity and memory-unit agreement with the unchanged legacy endpoint, then
denies a no-role account. Final client/regression/CI evidence is recorded in the
parity inventory. A prepared API does not establish a completed monitoring page.

The server React page now consumes this generated contract on the explicit
monitor-server route. The existing grant controls page access and the backend
continues to enforce it for every sample; an owned no-role browser and API request
prove denial. Host/path/JVM arguments/filesystem values are escaped React text,
never HTML. Fixture markup and long paths remain inert and within mobile bounds.
Abort-on-leave and failed-refresh clearing prevent stale privileged displays.
Actual OSHI browser sampling and strict memory/JVM/disk warning thresholds are
verified in the page checkpoint; exact page CI remains a separate acceptance gate.
