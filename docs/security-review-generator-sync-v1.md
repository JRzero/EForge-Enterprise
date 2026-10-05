# Shared generator schema synchronization (2026-10-06)

The original synchronization read current PK/auto-increment metadata but did not
persist those flags, and unchecked field writes could report success after an
incomplete mutation. Canonical and original synchronization now use one guarded
metadata transaction with checked writes and reference protection.

POST /api/v1/tool/generator/tables/{id}/synchronize uses original tool:gen:edit
permission and audit, exact decimal string IDs and an empty 204 response. The
original GET synchronization route delegates to the same service behind its
existing AjaxResult compatibility boundary. Invalid IDs return 400; missing
imports 404; missing physical schemas, invalid stored tree options or referenced
field removal return controlled 409 errors. SQL faults are sanitized. Product
synchronization never performs physical DDL or writes business rows.

The generator-only SQL guard precedes imported-resource and schema reads. The
RuoYi MIT-derived algorithm initializes actual fields and retains its original
conditional query/dictionary settings for list fields and required/control choices
for eligible non-key insert/edit fields. Existing column IDs remain stable; new
columns use the authenticated actor. This does not invent preservation of all
custom flags or Java-field names which the original algorithm resets. Every
update/insert/delete count is checked inside the same transaction.

PK and auto-increment changes are persisted through an internal schema-probe
mapper never called by configuration request saves. Explicit zero initialization
clears old edit/list/query flags when a field becomes a primary key. Physical
names/types/keys come solely from same-schema information_schema results. Tree
field removal and removal of a child foreign key referenced by another imported
configuration are rejected before writes in both routes. After sync, stale full
field sets are refused by both canonical and original configuration saves.

The real verifier alters only two uniquely named parent-owned fixture tables. It
proves actual add/drop/type/decimal/PK/auto changes, original conditional choices
and exact surviving field IDs. Separate UPDATE/INSERT/DELETE faults prove complete
metadata/audit rollback followed by retry. Two actual sync/save HTTP requests are
observed concurrently waiting in performance_schema before release; their serial
outcome is accepted only if synced metadata remains valid and stale fields cannot
be restored. Both final configurations observed 204/409. Full post-DDL row snapshots
and original entry identity/content remain unchanged through synchronization; test
DDL has already committed and is not falsely included in metadata rollback claims.
Missing physical schema, original/canonical reference refusal and actual no-role
and anonymous gates are verified. Owned fixtures/triggers/jobs/accounts clean up
in finally blocks.

444 Maven tests pass, including eight synchronization MVC cases, eight algorithm
cases and ten unchanged data-scope cases. Frontend lint/typecheck/generated-client
reproduction/build, 73 units and 64 fixture browsers pass. Both final complete
actual API configurations pass and their live OpenAPI snapshots exactly match the
contract. Both configurations passed 43 existing browsers and complete runtimes before
the final legacy SQL-error privacy repair. Both final default and enabled complete API runs pass after that repair. Exact-head cloud must
rerun both final browser/runtime configurations; cloud acceptance remains pending. Logs use generator-sync-*
under boot target. No synchronization UI or final generator completion is claimed.

Harness errors were corrected and not counted as product acceptance: canonical 204
was initially checked as legacy 200; a prior dot-sourced string-array variable
coerced import records and lost IDs (sync now owns prefixed variables and checks
response identity); mysql -e required a single-statement fault trigger; a newly
added auto column could inherit the existing sequence, so retention now compares
actual complete post-DDL rows instead of assuming a new ID of 1. Final default and
enabled complete API runs pass all corrected checks.

External privileged DDL is not serialized by the metadata guard or rolled back by
this operation. Physical table creation, immutable output snapshots, safe
React/EForge templates, preview/archive/custom filesystem output, complete pages
and runnable generated CRUD/tree/submodules remain required. Form builder, full
shell/shared capabilities, other-module calendar/export audit and final original
frontend parity remain active. The rejected task runtime mutation proposal is
untouched and still requires its specific explicit approval.

Final privacy review reproduced a legacy HTTP SQL error leaking a controlled
private connection-detail string (eight MVC cases: seven pass, one fails before
repair). The scoped original synchDb boundary now wraps DataAccessException
with a fixed ServiceException message while retaining its cause only for protected
server diagnostics; HTTP 200/AjaxResult code 500 compatibility is preserved.
All eight MVC cases pass after repair. Real UPDATE/INSERT/DELETE faults now each
exercise the original route too, requiring safe public errors and exact full
metadata/audit rollback. No global compatibility advice is rewritten.
