# Generator physical creation: next implementation boundary

This is a design checkpoint, not implemented or accepted creation behavior.
Original GenController.createTableSave is admin-role-only. It parses MySQL with
Druid 1.2.28, executes each MySqlCreateTableStatement, then imports all selected
metadata. Raw other statements are skipped; SqlUtil's whitespace normalization
makes trailing-space keyword checks insufficient. That generic helper must not be
rewritten globally as part of generator work.

The next canonical boundary must retain the original administrator role,
authenticated audit, batch SQL table creation and automatic metadata import, with
concrete canonical DTOs and generated client. The original endpoint must share
preflight/execution policy behind its AjaxResult boundary rather than remain a
bypass. Product code must not accept general SQL statements or arbitrary database
connections. Validate the complete parsed batch before executing the first DDL:
statement classes, target/source schema references, duplicate/existing targets,
identifier lengths, table options/external paths/storage and expression boundaries.
Preserve actual original accepted syntax/features rather than replacing SQL input
with a single reduced table wizard. Canonical SQL should be emitted from validated
ASTs, not text substitutions or keyword checks.

Actual MySQL DDL commits implicitly. Do not put CREATE TABLE into the metadata
row-lock transaction and pretend that both phases roll back together. Execute
physical DDL as its own bounded phase, preserve precise created/failed/unattempted
outcomes, and import created metadata using the existing generator transaction
boundary. A failed later statement/import must never automatically DROP physical
tables or erase business rows. Return honest structured outcomes via canonical
HTTP semantics and safe ProblemDetail; preserve enough information for retry.
Existing tables must not be silently treated as newly owned and imported after
an ignored conflict. Concurrent canonical/original create/import must produce
consistent metadata/physical outcomes across application processes.

Require targeted original-role/anonymous/wrong-grant tests, malicious SQL/schema/
path/function and mixed-statement preflight refusal without earlier DDL, legal
Unicode/quotes/comments and all supported table constructs, actual creation and
initialized metadata/exact IDs, duplicate/concurrent requests, true MySQL partial
DDL and import fault results, metadata rollback with retained physical tables,
successful retries and generated client/OpenAPI reproduction. Real fixtures own
all created physical tables/rows and clean only their own resources. No generic
low-code backend or scheduler gate is introduced. Runtime and full browser/cloud
acceptance remain mandatory; interface/UI creation is not claimed by this plan.

Local parser evidence (Druid 1.2.28, no SQL execution): quoted Unicode names and
semicolon/keyword text in column comments remain AST data; schema is represented
separately from target name; LIKE has its own source table; CREATE AS SELECT has
a select subtree; DATA DIRECTORY/CONNECTION/ENGINE appear as explicit options;
a mixed CREATE/DROP batch yields distinct statement classes. See ignored target
generator-create-parser-probe.log. These facts guide preflight; they prove neither
policy completeness nor runtime creation/output acceptance.

## Execution and recovery details to implement

Canonical preflight errors use controlled 400/409 ProblemDetail and execute no
DDL. Successful creation returns 201 with requested-order physical and import
outcomes and exact string metadata IDs. A failure after any successful CREATE
must return a controlled failure with explicit created/failed/unattempted entries;
created-but-not-imported entries remain visible for recovery. A generic SQL error
alone cannot describe the result. Use a creation-local exception/advice or concrete
response boundary; do not extend unrelated compatibility errors to expose SQL or
rewrite the global ApiFailure contract for this single feature. Public entries
contain validated table names and fixed status/code fields, never datasource,
raw driver errors or request SQL. Original HTTP 200/AjaxResult success/failure
semantics remain behind its compatibility boundary with honest outcome data.

Do not use IF NOT EXISTS as evidence of physical ownership: concurrent CREATE can
return a non-error no-op for a table created by another request. Preflight may
accept that syntax, but validated execution must either explicitly report an
existing table or require an actual successful CREATE without the no-op clause;
never automatically import an unrelated existing table as newly created. Existing
targets must be identified before the first DDL. Target races after preflight
produce honest failure outcomes with retained earlier creates. The metadata import
transaction remains separate and serialized; a competing import may win, which
must be reported without overwriting its configuration or deleting physical rows.
Do not introduce a long global application lock or claim ordinary MySQL CREATE
and metadata import constitute one atomic transaction.

AST checks must cover every actual source reference, including LIKE, CTAS joins/
subqueries/CTEs and foreign-key references, and all side-effect surfaces including
SELECT INTO, variables/assignments, stored/user-defined functions, file/directory/
connection/tablespace options, hints and executable comments. Quoted identifiers
and literals/comments containing suspicious words stay data. Legal same-schema
LIKE/CTAS and original column/index/constraint/table/partition constructs require
explicit acceptance tests; unknown or dangerous syntax cannot fall through to the
old raw mapper. Read actual pinned parser classes and prove validation before
wiring either endpoint. Bound request size/count/depth before execution, and test
all-item preflight refusal with a valid earlier statement to prove no early DDL.

The original admin role remains authoritative for both routes; canonical import
permission is not added as an accidental extra restriction to this admin action.
Authenticated actor attribution applies to newly imported metadata. Keep original
legacy template selection behind its compatibility boundary; canonical output
uses the versioned EForge React target. Creation recovery does not imply the
existing Vue templates already produce accepted React/EForge code.