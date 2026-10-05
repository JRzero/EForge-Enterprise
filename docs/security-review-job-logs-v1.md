# Task log and Cron preview API review

Scope: canonical task logs and a read-only Quartz expression preview. Task
management, its scheduler/database mutation consistency, and all React task
pages are separate pending work.

The canonical endpoints retain original `monitor:job:list/query/remove/export`
grants. Preview accepts any original add/edit/query grant. Anonymous and no-role
requests are denied before mapper access. Exception text is available only in
the query-protected detail response; list projections omit it and legacy base
entity fields. The frontend must render exception text as text.

Identifiers stay strings in JSON to preserve all positive Java long values.
Batch deletion validates every identifier before issuing one SQL statement;
missing rows are idempotent. Canonical clear uses DELETE and preserves the
identity sequence so stale selected identifiers cannot delete future logs.
The upstream compatibility endpoint retains its existing TRUNCATE behavior.

Paging and status bounds, field lengths, enum ordering and calendar ranges are
validated. Sorting contains only fixed SQL identifiers and a validated enum;
filters remain mapper parameters. Paging state is cleared on errors and export
includes the complete filtered set. SQL failures return generic ProblemDetail.

Preview uses the actual Quartz parser and server timezone. It returns up to five
future instants; valid exhausted expressions return an empty list. It never
creates a job, invokes a target, or changes the scheduler. No permission,
invocation whitelist, baseline or data-scope semantics are changed.

Targeted MVC tests cover the grants, invalid input, long identifiers, detail
boundary, SQL failures and actual special-date/timezone/exhausted expressions.
The disposable MySQL/Redis/Quartz harness dispatches actual successful and
failing jobs through the preserved compatibility boundary, verifies canonical
logs and XLSX content, injects a SQL delete fault, and checks monotonic IDs after
clear. Full module acceptance still requires task CRUD and actual browser tests.
