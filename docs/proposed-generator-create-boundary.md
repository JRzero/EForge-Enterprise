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
## Batch parser foundation (implementation in progress, 2026-10-06)

GeneratorCreationBatchParser is a pure, currently unwired foundation. It parses the
entire bounded MySQL batch before returning immutable requested-order entries with
independent AST copies and source-reference names. It rejects mixed statement
classes, duplicate targets, malformed names, foreign schemas (case-sensitive against
the actual selected schema), executable comments/hints outside quoted data and
oversized/count/deep-parenthesis inputs. Tests preserve Unicode/quoted names,
ordinary comment/literal keyword data, original types/keys/options/partitions,
LIKE, CTAS joins/subqueries/CTEs and independent deep AST snapshots. CTE names are
reference syntax, not asserted physical database tables; later source resolution
must respect their scopes.

A real red test showed that Druid visits foreign-key SQLName directly rather than
its SQLExprTableSource wrapper, which let foreign schemas escape a source-only
visitor. Explicit table and inline foreign-key checks repair that gap. Legal
literal test quoting and a test mutation overload were corrected as fixture/API
usage issues. No parser test is evidence of physical creation or execution safety.

Before either endpoint can use this parser, complete AST expression/function/
variable/SELECT-INTO/storage/engine/partition-path policy, SQL-mode and additional
parser resource/stack bounds, live existing-target/source resolution, ownership
and actual DDL/import partial outcome handling must pass targeted and real-runtime
checks. An AST copy is not an approved execution plan. Existing HTTP create behavior
is unchanged; no canonical creation endpoint/client or accepted creation capability
is introduced by the foundation. Preserve all original and remaining parity goals.
The parser foundation now passes 14 targeted tests and all 458 backend cases,
including the ten unchanged data-scope cases. A separate no-SQL JVM probe actually
exhausted the parser stack at 2,048 NOT prefixes before repair. Iterative lexer
checks now reject excessive prefixes, CASE depth and their combined per-statement
recursive budget before recursive parsing; the same isolated 128/512/2048/5000
probe inputs all return controlled errors. Nested combinations and long quoted
literal data are tested. Logs use generator-create-parser-* under boot target.
Both final real API regressions pass from the resulting jar and their normalized
OpenAPI snapshots exactly match the contract. Frontend and contract trees are
unchanged from accepted ff67dd4 (73 units, 64 fixture and both final 43 browsers);
client reproduction and production-default checks pass. Exact-head server run 37392720300 at 6bcce42c0e8c5a63be603f73ba207d942250e736 is now successful in all three jobs, including both browser/runtime configurations. This proves the parser foundation regression only. No
physical creation or final AST execution policy acceptance is claimed.

MySQL's single-statement atomic DDL does not combine a sequence of CREATEs with a
metadata transaction; implicit commits still separate the phases. This supports
the explicit per-statement/metadata outcomes proposed here. See the official
[atomic DDL manual](https://dev.mysql.com/doc/refman/8.4/en/atomic-ddl.html) and
[implicit commit manual](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).
The official [CTAS manual](https://dev.mysql.com/doc/refman/8.4/en/create-table-select.html)
confirms IF NOT EXISTS can skip an existing destination, so success must not imply
new ownership. These references support the design, not runtime acceptance.

A transport timeout/disconnect also requires an explicit unconfirmed outcome:
application failure alone cannot prove whether the server completed CREATE. This
is a recovery design inference. Do not label it rolled back or infer ownership
from an existence check that may observe a competing request. Recovery may use
explicit inspection/import of existing physical tables, with no automatic DROP.
## AST policy and pinned parser fidelity checkpoint (2026-10-06)

The pure, currently unwired AST policy prepares immutable SQL/name/reference
results after whole-batch validation. It checks native function names, variables,
assignment, SELECT INTO and locking, external storage/engines and partition paths.
Database source resolution (including CTE scope and views), SQL mode, native
function compatibility coverage, live ownership and partial DDL/import outcomes
remain prerequisites for endpoint wiring. No physical creation API acceptance is
claimed by these tests.

Actual failing tests exposed three pinned AST fidelity gaps: clone() dropped CTAS
WITH queries; serializing a snapshot dropped subpartition attributes; default AST
visitors missed generated expressions and parts of partition metadata. Snapshots
now retain the immutable original batch and reparse copies; the request text is
never itself an execution plan. Explicit policy traversal inspects those omitted
expressions and metadata.

Further failing tests showed the output visitor dropped lawful subpartition
options/comments and inferred RANGE COLUMNS from an identifier, while the MySQL
parser itself did not preserve its COLUMNS flag. A local parser extension records
the lexical distinction and a local output visitor preserves it and emits the
validated native subpartition ENGINE/MAX_ROWS/MIN_ROWS/COMMENT options. The pinned
Druid version is unchanged. Both RANGE and RANGE COLUMNS, computed YEAR bounds,
CTAS CTEs and unsafe special function parameters have targeted tests. The final
range repair passes 30 targeted tests (14 parser, 16 policy); full latest backend
and runtime regression is being verified separately. Logs are
`generator-create-policy-*-test.log`, `generator-create-policy-render-fixed.log`
and `generator-create-policy-range-final-test.log` under boot target. A red log is
a reproduced defect, not final acceptance evidence.

The user deferred the online form builder on 2026-10-06. Its inventory is retained,
but it is excluded from current development/acceptance. All other generator,
task, shell/shared and final acceptance requirements remain active.
An isolated, uniquely owned MySQL 8.4 container (no published ports or network)
executed the actual prepared SQL, not handwritten equivalents. Its partition
metadata proves `range_plain=RANGE`, `range_columns=RANGE COLUMNS` and computed
YEAR bounds=RANGE; SHOW CREATE retains the subpartition comment. CTAS WITH copies
the expected row, LIKE copies schema without rows, and the original source row
remains intact. The probe container was removed afterward. See
`generator-create-policy-prepared.sql`, `GeneratorCreationPolicyMysqlProbe.java`,
`generator-create-policy-mysql-probe.ps1` and the final PASS log
`generator-create-policy-mysql-probe.log` under boot target. This proves those SQL
rendering cases on real MySQL, not canonical/legacy endpoint behavior, concurrent
ownership, metadata import, partial outcome safety or final creation acceptance.
The MySQL fidelity probe is reproducible after Maven verify using
`server/scripts/verify-generator-creation-policy.ps1` with its committed Java
source in `server/scripts/probes/GeneratorCreationPolicyMysqlProbe.java`. It takes
an optional MavenRepository for non-default local dependency caches, uses no
application ports, waits for the final MySQL TCP server and removes only its own
unique container. The committed runner also passes; see
`generator-create-policy-mysql-reproducible.log`. The probe is independent of the
full application/API regressions and does not claim endpoint creation acceptance.
The isolated prepared-SQL fidelity probe is now also a required server-ci verify
step after Maven verification. Its default repository path uses the platform
user profile rather than Windows-only USERPROFILE; the updated runner passes
locally (`generator-create-policy-mysql-portable-runner.log`). Linux/cloud execution
must still be checked at the precise workflow commit before claiming cloud success.
### 2026-10-06: read-only creation database preflight

CTE lexical scope and physical read/FK/LIKE dependencies are now distinguished.
Whole-batch preflight checks live targets/metadata, native identifier folding,
selected-schema sources/views, reserved names, SQL modes and engines without DDL.
36 targeted tests and 480 full backend cases pass. Native JDBC probes pass 68/66
assertions for case modes 0/1, including actual Unicode/outer-scope query results,
real denied metadata access and retained source data. Prior bbd1556 cloud run
37395625273 is all-green; it does not prove acceptance of this newer foundation.
Current creation endpoint/executor/import/outcomes, source races and compatibility,
React output/pages and final parity remain incomplete. See
`security-review-generator-create-preflight.md`. Form builder remains deferred.
Final local checkpoint: the same sequential process completed both default and
explicitly enabled full API regressions successfully. Both normalized OpenAPI
snapshots exactly match the committed contract hash above. New exact-head cloud
run 37401067568 for 67e7bc2381d7a52ada3e1b49e72c0eea61767c76 has verify (including
both native SQL and both JDBC preflight profiles) and runtime-integration successful;
auth-runtime-integration is still running. Final cloud browser acceptance remains
pending. No source change or extra local live-browser run occurred after these
local checks. This supersedes the earlier enabled-runtime pending checkpoint.
### 2026-10-06: physical creation execution foundation

An unwired physical executor now validates the entire batch before DDL, requires
an owned writable autocommit connection, and reports immutable requested-order
CREATED/FAILED/UNATTEMPTED/UNCONFIRMED outcomes. It stops on failure/uncertainty,
never writes metadata or automatically drops tables, and removes IF NOT EXISTS
before dispatch to avoid ownership no-ops. Real JDBC profiles pass 88/86 combined
assertions, including actual partial DDL, retained business rows, injected lost
acknowledgement after real CREATE, and independent-connection target competition.
Shared original/canonical admin routes, checked metadata import, full compatibility,
React output/pages and final active parity are still required. See
`security-review-generator-create-execution.md`; form builder remains deferred.
### 2026-10-06: separate checked creation metadata import

The new admin-only service uses REQUIRES_NEW and the existing SQL metadata guard;
it accepts only fully acknowledged physical results, resolves exact native table
names/fields, checks every write/ID and records the authenticated actor. It preserves
original template choices plus canonical React target, without claiming React
output is implemented. Actual Spring/MyBatis/migration profiles pass 24 assertions
each: case-neighbour isolation, exact long ID, original role semantics, real late
SQL batch rollback/retry, retained physical tables, independent-parent-rollback
isolation and concurrent one-success/one-conflict import. Shared original/canonical
creation command/routes/client and full UI/output acceptance remain pending.
See `security-review-generator-create-import.md`; form builder remains deferred.
Final import-source checkpoint: both actual Spring/MyBatis profiles pass 27 cases,
including guard SQL privacy and physical retention, and full Maven verify passes
480 cases. Exact older physical implementation b7d78bff0fe9bba938dfd64bf39e60e2dbbe7b0a
passes server 37401957208 all three jobs, actual 88/86 JDBC and both 43-browser
profiles. Both old watches are terminal. New metadata import-service exact cloud
acceptance and assembled HTTP creation remain pending; do not substitute old
physical/preflight checks for this new acceptance.
Exact implementation afde85813221b2ad9320bdcf73306547a883ca08 is accepted for this
metadata phase: server 37403883802 all three jobs completed successfully. Cloud
logs confirm both actual Spring/MyBatis profiles pass 27 assertions and both
existing live-browser profiles pass 43. Complete MySQL/Redis/Quartz/OSHI/ACL/captcha
regressions and both exact OpenAPI checks succeed. The final local packaged Maven
classpath also passes both 27-case profiles (generator-create-import-packaged-*
logs), not merely the compile-phase classpath. Watch 22533 is terminal success.
This supersedes the earlier newest-cloud pending checkpoint. No physical/import
HTTP command or creation UI acceptance is claimed; those routes remain unassembled.