# Generator metadata serialization boundary

V025 adds one feature-local InnoDB coordination row under the excluded `gen_`
namespace. Canonical import/configuration save and the original table service's
import/update/delete/sync acquire the same row with prepared `SELECT ... FOR UPDATE`
inside their existing Spring SQL transaction. Commit/rollback releases the row;
multiple application processes use the same database boundary. Existing HTTP
mutation entry points therefore serialize before reading current metadata.

This coordination can delay another generator metadata write while an import,
save or sync transaction runs. It does not pause/rebuild Quartz, run SQL before
task dispatch, gate authentication, or lock unrelated business tables. No task
proposal rejected by approval review is retried. Production console defaults,
original grants, DTO boundaries and all baseline/dependency pins remain unchanged.
The lock requires an active transaction and exactly one guard row; missing schema
or autocommit misuse fails closed. Deployment must apply V025 before using the new
server. There is no in-memory fallback or silently recreated guard.

418 backend tests including the ten unchanged data-scope cases pass. Tests reject
unprotected autocommit and absent coordination rows. Both enabled/default-disabled
complete real API regressions pass. In the parent-owned disposable schema, a
separate SQL transaction holds the actual record lock; performance_schema proves
the authenticated canonical save and original sync requests are waiting on that
lock. After rollback they resume and return their normal successful responses.
Both actual OpenAPI snapshots match the committed contract and the generated
client remains reproducible. Earlier accepted 66158a6 supplies unchanged frontend
lint/typecheck/build, 73 units, 64 fixtures and both configurations' 43 real browsers;
this boundary adds no frontend or public contract change. The new exact-head cloud
regression must still pass before cloud acceptance.

This is serialization, not complete mutation/integrity acceptance. Next work must
add canonical batch deletion and synchronization, enforce shared legacy field
ownership and checked writes, preserve references during rename, guard external
references during deletion, and verify real concurrent reference/rename/delete/
sync outcomes and complete rollback. The unused standalone column write helpers
have no HTTP callers and must join this boundary before future exposure. Physical
DDL, output snapshot/path/SQL boundaries, React/EForge generation, full pages and
runnable generated modules remain required, followed by form builder, shell/shared
and final original-capability/calendar/export audits. Reads/templates are not
claimed consistent snapshots by this writer-only checkpoint.

Evidence: generator-boundary-backend-final.log, generator-boundary-disabled-runtime.log,
generator-boundary-enabled-runtime.log, GeneratorMetadataBoundaryTest and the
observed SQL waiting barrier in verify-generator-configuration-integration.ps1.

Exact metadata serialization implementation ef2ba15041be3954b3f28f53cae7286a4ec695ce
passes server 37347737857 all three jobs, confirmed 2026-10-06, including both
configurations' complete real browsers/runtime and exact OpenAPI. Its frontend
and contracts trees are identical to accepted 66158a6; web-ci's path filter does
not trigger for this backend-only change. This accepts serialization only; all
stated remaining integrity, generator outputs/pages and full-parity work remains.
