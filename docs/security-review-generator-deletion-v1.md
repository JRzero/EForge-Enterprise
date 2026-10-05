# Generator metadata deletion and shared references (2026-10-06)

Canonical DELETE /api/v1/tool/generator/tables accepts a bounded nonempty batch
of exact positive decimal string IDs, uses original tool:gen:remove authorization
and audit, and returns 204. Unknown IDs are idempotent. Only generator metadata
is deleted; physical tables and their records are retained. The generated client
comes from the runtime OpenAPI contract.

The shared generator transaction guard precedes reads and writes. Canonical and
original deletion both reject the whole selection if another unselected table
references a selected child. Parent and child can be removed together. Reference
checks use bound values. Renaming configuration metadata updates every parent
reference and authenticated audit fields in the same transaction; it does not
rename physical business tables. SQL faults roll back parent, child and fields.

Original configuration save now requires a complete unique owned field set,
preserves authoritative physical type, checks all table/field update counts and
uses the authenticated actor. Renames require an existing unimported physical
target with matching column names. Original category/tree/subtable inputs are
validated under the same guard: no unknown category, missing/self child, missing
child foreign key or tree fields from another resource. Non-sub categories clear
obsolete child references. Original compatibility responses remain behind their
existing migration boundary.

The real verifier uses only its own three uniquely named disposable tables and
seeded records. It proves original/canonical deletion SQL-lock waiting and resume,
reference refusal, canonical rename fault rollback and retry, original rename,
foreign/duplicate/incomplete/null field refusal and physical-type preservation.
It additionally rejects five invalid original relationship/category cases without
changing table, field or audit snapshots. Two simultaneously queued HTTP requests
for creating a child reference and deleting that child must yield one successful
operation and a consistent refusal; actual performance_schema waits must be
observed for both requests before releasing the owner transaction. Atomic batch
deletion is tested with a field-delete fault, retry and repeat. Direct SQL checks
prove physical identities and seeded records remain intact. Owned resources and
jobs are cleaned in finally blocks.

428 backend tests pass, including nine deletion MVC cases, three guard cases and
ten unchanged data-scope cases. Frontend lint/typecheck/client reproduction/build,
73 units and 64 fixture browsers pass. Both complete configurations passed 43
existing real browsers and complete APIs before the final five original semantic
checks were added. The final Java build and both final complete actual API regressions pass,
including those five original semantic checks; exact-head cloud acceptance is pending. Logs use
generator-deletion-* under the boot target. This timing is explicit: prior browser
success does not establish the newly added original-save checks.

Canonical synchronization and actual schema/key/type changes, physical DDL,
immutable output snapshots, safe React/EForge templates, preview/download/custom
filesystem output, complete generator pages and runnable generated CRUD/tree/sub
modules remain required. Shared serialization does not complete every original
sync behavior. Form builder, shell/shared features and final original-capability
acceptance remain active. No task dispatch or approval-rejected scheduler mutation
implementation is changed in this stage.
