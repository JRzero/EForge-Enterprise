# Generator rendering snapshot boundary

This internal foundation captures a privately loaded graph and creates a separate
legacy working graph for each render. It is not an HTTP DTO or an output endpoint.
It does not yet replace the old preview/download/custom generation implementation.
React/EForge templates, safe language contexts, immutable generated output,
path/ZIP/custom-output boundaries and full UI/end-to-end proof remain required.

The capture preserves all writable legacy bean properties, nested list/map values,
nulls, exact long IDs/BigDecimal values, dates and SQL timestamp nanoseconds, child
metadata and aliases inside each graph. No caller-owned mutable object is retained.
Cycles, unexpected mutable kinds and oversized/deep graphs produce a fixed safe
400 error. Bean kinds are a fixed whitelist; no class/component comes from DB text.
Every working copy and captured generation date remain independent of later writes.
Capture requires a private consistent graph; concurrent mutation of caller-owned
input is not supported or falsely described as atomic.

The loader enforces the original preview/code permission union through real Spring
method security. It reads joined root/field and optional child metadata inside a
short read-only REPEATABLE_READ / REQUIRES_NEW transaction. Rendering/filesystem
work is outside this read transaction; no generator mutation lock is acquired.
The original explicit primary key or first-column fallback is retained for root
and child. Missing configurations/fields/references fail safely as 404/409; actual
SQL failures return a fixed 503 without SQL/driver details. Invalid or duplicate
selections are rejected before mapper queries.

Actual MySQL testing found the original LEFT JOIN can materialize an empty child
row because table_id is shared with the column result map. The new loader excludes
rows without a persisted column_id before choosing the key and now rejects a
configuration with no real fields. The legacy mapper and original routes are
unchanged. This regression failed before the fix and passed afterward.

Local evidence (2026-10-06): final Maven verification passes 490 boot tests plus
10 data-scope parity tests. Twelve targeted tests include real Velocity output and
filename parity for crud/tree/sub across element-ui/element-plus/TypeScript, plus
deep isolation, aliases, date kinds, timestamps and safe capture failures.
These preserve original output behavior; they do not prove that old generated
source is safe or that React/EForge output already exists.

The persistent native probe uses actual Spring security/transactions, actual
MyBatis XML and an isolated MySQL baseline schema. A delegating mapper pauses only
the test reader after its real root query. A separate writer commits root, child
and both field versions before the reader's child query. The reader retains the
old coherent graph; the next read sees all new values. It proves actual read-only
REPEATABLE_READ, permission denial before SQL, exact IDs, first-key fallback,
no-field/missing selection, caller transaction suspension/restoration and rollback,
detached old snapshots, SQL privacy/retry and unchanged metadata counts. It adds
no waiting instrumentation to product code. Request attributes in the harness
support the real permission-context service; production permission logic is unchanged.

Both native case modes finished successfully with 30 assertions each (same sequential process, exit 0).
Logs: generator-snapshot-final-verify.log, generator-snapshot-mysql-0.log and
generator-snapshot-mysql-1.log in server/eforge-boot/target. Exact-commit cloud
acceptance is pending until all jobs reach terminal success. Form builder remains
deferred by the user; all other current requirements remain active.