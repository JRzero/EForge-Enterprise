# Canonical generator configuration review — implementation in progress

PUT /api/v1/tool/generator/tables/{id} uses the original tool:gen:edit grant and
server-authenticated UPDATE audit actor. It returns 204 only after every metadata
write succeeds. New concrete configuration/field DTOs expose no BaseEntity and do
not accept physical column names/types/primary-key/autoincrement identities or
client audit actors. IDs remain decimal strings; overflow and malformed identifiers
are rejected. Every current field must occur exactly once under its owning table.
Foreign/duplicate/incomplete field selections fail before writes. SQL failures and
missing resources use canonical sanitized problems.

All original seven Java type choices, eight query modes and nine control kinds are
retained, including Boolean, GTE/LTE, imageUpload/fileUpload/editor. Flags are explicit
required booleans; field descriptions/dictionaries/remarks can clear, and order is
persisted. Class/package/property names must be valid Java source identifiers;
module/business names are metadata route/permission text, not Java identifiers.
Legal hyphenated module/business names must remain supported. Actual tree fields
must belong to the parent table; a subtable is a distinct imported table with the
selected physical foreign-key field. Menu parents are validated and their names
are resolved server-side. Layout 1–3, detail choice, author, output mode/path and
physical-table name edit with matching schema remain configurable.

The service locks only its current gen_table row in the database transaction,
serializing canonical configuration edits to the same resource. Table and field
updates share one Spring/MyBatis/JDBC transaction. Failed or zero row writes throw.
Canonical read/write options use distinct OpenAPI schema names: a runtime snapshot
exposed a collision that removed parentMenuName from the read schema, now corrected
and explicitly checked by the real verifier. Other DTO schema names are explicit.

The real verifier creates only three uniquely named disposable physical tables,
imports two owned metadata resources, and checks actual cross-table/incomplete
refusal without changes to either resource. A temporary UPDATE trigger fails after
the table and first field were written; a direct SQL snapshot must prove complete
rollback, followed by successful retry. It verifies all nine controls, Boolean/LTE,
clear/order/tree/subtable/rename, exact IDs and unchanged physical identities,
anonymous/no-role refusal and distinct complete live OpenAPI schemas. Owned trigger,
metadata, tables and account are cleaned in finally blocks.

This is not complete generator mutation/concurrency acceptance. Shared legacy
mutation/sync coordination, rename/delete/subtable-reference concurrency and the
remaining canonical create/delete/sync/output boundaries remain required. No
filesystem output or template execution happens here; path/output-string escaping
and containment are mandatory at the later generation boundary. React/EForge
output, complete pages, generated CRUD/tree/subtable end-to-end proof, form builder,
shell/shared features and final original-capability audit remain in scope. Task
mutation approval constraints remain unchanged and scheduler mutation code is untouched. The accompanying job-log calendar fix only changes read/export filters, not task execution.

Validation state: final configuration, schema disambiguation and the accompanying
job-log calendar repair pass 416 backend tests, including 14 configuration MVC
cases and ten unchanged data-scope cases. Generated client reproduction,
frontend lint/typecheck/build, 73 units and 64 fixture browsers pass. Final disabled
API runtime and enabled complete 43-browser/runtime regressions pass, including
legal hyphenated names, distinct complete read/write schemas, rollback/retry and
actual UTC/Shanghai/DST filter boundaries. The initial enabled browser date failure
was repaired in the product and rerun successfully; see the job-log calendar review.
Both configurations also pass their complete 43-browser/full-runtime regressions and exact live OpenAPI checks. Exact-head cloud acceptance
remains pending. No configuration page or final generator completion is claimed.
Logs use generator-configuration-* under boot target.
