# EForge Enterprise Roadmap

## Current scope adjustment (2026-10-06)

The user deferred the online form builder. It is excluded from current development and acceptance, while its original inventory is retained for future work. Historical entries below do not override this decision. Generator work, scheduled jobs, shell/shared capabilities and every other required capability remain in scope. Deferred work must not be reported as completed.

## Phase 0 — Architecture

- [x] repository model
- [x] modular-monolith decision
- [x] Spring Boot baseline decision
- [x] pin RuoYi upstream commit
- [x] RuoYi inheritance boundary
- [x] EForge dependency boundary
- [x] versioned typed API/OpenAPI contract
- [x] navigation-group vs route distinction
- [x] application bootstrap contract
- [x] authentication/permission boundary
- [x] security/data-scope migration policy
- [x] generator direction
- [x] architecture review

## Phase 1 — Server foundation import

- [x] import pinned RuoYi Spring Boot 3 backend baseline
- [x] preserve upstream MIT license/notice
- [x] establish unchanged Maven green baseline
- [x] move backend under `server/`
- [x] rename `ruoyi-admin` to `eforge-boot`
- [x] rename Maven coordinates/application identity
- [x] rename Java packages in controlled steps
- [ ] remove Vue/static frontend assumptions
- [x] add data-scope parity tests
- [x] verify MySQL initialization
- [x] verify Redis-backed authentication
- [x] harden Swagger/Druid/CORS/secrets defaults

## Phase 2 — Typed API and EForge web shell

- [x] establish reproducible EForge package consumption
- [x] initialize React application
- [x] consume pinned/versioned EForge packages
- [x] add `/api/v1/auth/login`
- [x] add `/api/v1/app/bootstrap`
- [x] generate TypeScript client from OpenAPI
- [x] login/logout/session integration
- [x] route registry + backend navigation projection
- [x] permission-aware navigation
- [x] 403/404
- [x] system dashboard

## Phase 3 — Core enterprise modules

- [ ] user management (administration/import and profile verified in CI; shared status/sex dictionaries integrated and verified locally; current CI and full capability audit pending)
- [ ] role management (canonical API/client, administration/allocation pages and grant/department trees verified in CI; shared status dictionaries integrated and verified locally; current CI and full capability audit pending)
- [x] department management (canonical hierarchy API, EForge page, live CRUD/sort/data-scope verification)
- [x] post management (canonical API, EForge page, live CRUD/permissions/download verification)
- [ ] menu/permission management (canonical API/client and React tree/icons/scope/session refresh verified in CI; status/visibility dictionaries verified locally; query/cache shell behavior pending)
- [ ] dictionary (type/data pages, paging/dates, whole preview, CRUD/bulk/export and shared integration verified locally; remaining field/abort/cache browser acceptance and current CI pending)
- [ ] configuration (canonical API/client and page passed CI; filters/CRUD/bulk/XLSX/cache, permission/error/mobile and real persistence verified; final acceptance audit pending)
- [ ] notices (canonical API/client, rich editor/rendering, administration/top-feed/readers UI and JPG/PNG/static-SVG upload passed local verification and exact-commit CI at c7605fe: server 37237590148, web 37237590166; full capability audit remains pending)
- [ ] operation/login logs (ten canonical operations/client and both React pages verified locally and in exact-head CI, including real audit detail/copy/sorting/XLSX/deletion/password-lock/unlock/session preservation; final capability audit pending)
- [ ] online session management (canonical API/client and page verified locally and in exact-head CI, including exact filters/paging, scoped/self force logout, twelve-session isolation and Redis ACL faults; final capability audit pending)
- [ ] scheduled tasks, Cron editor and task logs (canonical task reads/logs/actual Quartz preview and original read/log pages verified in CI; seven-field Cron editor/read-tool/detail handoff verified locally at 06f4fbd with 371 backend/73 unit/64 fixture and both configurations' 43 real browsers; Cron exact-head server 37310528730 all three jobs and web 37310528660 pass. Task CRUD, scheduler/SQL mutation consistency, create/edit Cron integration and final capability audit remain pending)
- [ ] server/cache monitoring and authenticated consoles (server/cache APIs, clients and pages passed full local regression and exact commit CI; cache page c597d44 server 37259840797 all three jobs/web 37259840781 success, local 312/65/52/37 and actual charts/clearing/SQL/session acceptance; consoles and final capability audit pending)

Diagnostic console canonical APIs, generated client and scoped authentication
transport pass local 336 backend/67 unit/52 fixture/37 real browser regression,
including actual enabled servlet resources, grant/logout revocation, ACL faults
and expiry. Exact commit 3a77fda passes server 37267216665 all three jobs and web
37267216628. Both embedded React console pages now pass local 338 backend/67
unit/57 fixture/40 real browser cases in enabled and default-disabled runtime,
including original Druid login/SQL/JSON windows, Swagger authorization and actual
execution, scoped caching/logout/revocation and error recovery. Page cb3a250
passes exact-head server 37273703241 all three jobs (both configurations' full
real browsers/OpenAPI) and web 37273703194. Final capability audit remains pending.

## Phase 4 — Generator

- [ ] remove Vue generator templates
- [ ] generator outputs typed backend DTO/controller contracts
- [ ] generator outputs EForge ListPage/FormPage/DetailPage scaffolds
- [ ] generator outputs route registrations
- [ ] generated pages consume OpenAPI client
- [ ] generator validation tests

## Phase 5 — Full-stack verification

- [x] server unit/integration tests
- [x] frontend lint/typecheck/test/build
- [ ] Playwright login/RBAC/CRUD E2E
- [ ] Docker Compose local MySQL + Redis
- [x] CI verification
- [x] seeded route-contract validation
- [ ] reference CRUD module generated end to end

## Deferred until proven

- multi-tenancy
- microservices
- workflow engine
- MQ
- distributed transactions
- low-code renderer
- business-domain packages

## Full RuoYi frontend parity

The phase checkboxes describe individual milestones, not completion of the full
frontend. Track all original frontend operations, shared controls and remaining
shell capabilities in [ruoyi-frontend-parity.md](ruoyi-frontend-parity.md) and its
machine-readable inventory. The full parity objective remains active.

Task replacement recovery checkpoint: an existing compatibility update now
restores its original RAMJobStore schedule after replacement failure; seven
actual Quartz tests and real MySQL checked-exception rollback/original-target
execution pass. Full local regression is 358 backend/67 unit/57 fixture and 40
real browser cases in each configuration, with both live OpenAPI snapshots exact.
Exact commit ec658d1 passes server 37295454573 all three jobs and web 37295454526. Canonical task CRUD, commit/concurrency/batch/
precommit/persistent-fault consistency and all task/Cron/log pages remain pending;
see security-review-task-replacement.md. The complete parity objective stays active.
Canonical task read checkpoint: list/detail/full filtered sorted XLSX and generated
client pass 371 backend/67 unit/57 fixture and both configurations' 40 real
browser regressions, with exact live OpenAPI equality. Exact commit 1337834 cloud
validation passes server 37298378311 all three jobs and web 37298378298. Task mutations, full SQL/Quartz consistency and all pages
remain incomplete. Automatic review rejected the proposed high-impact mutation
boundary; neither rejected runtime patch was written. Explicit approval of the
narrower proposal in proposed-task-mutation-boundary.md is pending. Independent
task-log pages and all remaining original capabilities continue to be required.Task read and original task-log pages now pass 371 backend/69 unit/61 fixture and
42 real browser cases in each configuration, both full runtime regressions and
exact live OpenAPI equality. Exact implementation 94f1b18 passes server 37304885110 all three jobs and web 37304885166. Task CRUD,
status/run controls, Cron editor and full scheduler/SQL mutation consistency are
still incomplete; the affected-ID mutation proposal still awaits explicit approval.
Generator/form builder, shell/shared capabilities and final parity audit remain.
Cron editor checkpoint: original seven-field/date-mode/refill/reset/cancel/confirm
behaviors and protected actual Quartz five-instant/server-zone preview now pass
371 backend/73 unit/64 fixture and 43 real browser cases in each configuration,
both full runtime regressions and exact live OpenAPI. Exact implementation 06f4fbd passes server 37310528730 all three jobs and web 37310528660. The read tool/detail handoff does not persist task changes; task
create/edit integration and all canonical mutations/full consistency remain
required. Pending explicit approval still applies only to the rejected mutation
boundary. Independent generator React/EForge output/UI, form builder, shell/
shared capabilities and final original-capability audits continue next.
Generator read checkpoint: canonical imported/database lists, configuration/detail
choices and fields plus generated client pass 388 backend/73 unit/64 fixture and
both configurations' 43 existing real browsers/full runtime, exact live OpenAPI.
Exact implementation 2ca49b1 passes server 37315345511 all three jobs and web
37315345434. All generator mutations/output/templates/UI and generated
reference module end-to-end proof remain required; full original parity stays active.
Generator import checkpoint: canonical batch metadata import, original permission
and audit, preflight, SQL uniqueness, rollback/retry and requested-order exact IDs
pass 400 backend/73 unit/64 fixture and both configurations' 43 existing real
browsers/full MySQL/Redis/Quartz/OSHI/ACL/captcha regressions, exact live OpenAPI.
Exact implementation 15d7bce passes server 37333745938 all three jobs and web
37333746012. All other generator writes, React/EForge
output/templates/UI and runnable generated module proof remain required. No
physical table creation or custom filesystem output is implemented in this stage.

Generator configuration API checkpoint: atomic complete-field configuration save,
original grants, server-owned physical identity, all original field/settings
choices, exact IDs, SQL rollback/retry and distinct read/write schemas pass 416
backend/73 unit/64 fixture and both configurations' 43 real browsers/full runtime.
The actual browser-calendar failure is repaired in job-log list/export and proven
with Shanghai/DST SQL boundaries; both live OpenAPI snapshots match. Exact-head
cloud acceptance is pending. Shared legacy/sync/reference concurrency, remaining
generator writes/output/templates/full pages and runnable generation proof remain
required, followed by form builder, shell/shared and final capability/calendar
checks. No approval-rejected task mutation scheme is implemented.

Configuration API/calendar repair exact 66158a6 passes server 37345364383 all three jobs and web 37345364385; remaining generator and complete frontend parity work stays active.

Generator metadata serialization: V025 shared SQL transaction guard, actual canonical/original wait and rollback resumption, 418 backend and both complete API regressions pass; exact contract unchanged, cloud pending. Next enforce legacy ownership/checked writes and rename/reference/delete/sync consistency, add canonical delete/sync, then remaining generator/output/UI and full original parity deliverables.

Metadata serialization exact ef2ba15 passes server 37347737857 all three jobs and both full browser/runtime configurations; remaining reference/legacy ownership/delete/sync/output/UI acceptance stays required.

## Generator deletion and shared references checkpoint (2026-10-06)

Canonical bounded batch metadata deletion, original remove permission/audit,
shared original deletion guards, atomic parent-reference rename and original
complete owned-field/category/tree/subtable validation pass 428 backend tests.
Actual default/enabled complete API regressions prove SQL waiting, simultaneously
queued reference/delete consistency, complete rename/delete rollback and retry,
original invalid writes without audit changes, idempotence and retained physical
tables with their original seeded records. Both live OpenAPI snapshots match the
contract; generated client reproduction, security defaults, frontend lint/typecheck/
build, 73 units and 64 fixture browsers pass. Each configuration passed 43 existing
real browsers before the last original-save semantic checks; both final complete
API runs independently verify those new checks. Exact-head cloud is pending.
See docs/security-review-generator-deletion-v1.md for precise evidence timing.
Canonical sync and physical schema/key/type changes, physical DDL, safe React/EForge
output/templates, preview/download/custom output and full generator pages/generated
module proof remain required. Form builder, shell/shared features and final full
original-capability acceptance remain active; task approval restrictions stay intact.

Exact deletion/reference implementation 5c843569a12758e180a8b8111ab3b037bc665b8c
passes server 37357189557 all three jobs and web 37357189811, confirmed 2026-10-06.
The final server cloud job executes both complete real API configurations and
43 real browsers per configuration from this exact source, including the five
final original-save semantic checks. This supersedes earlier pending-cloud and
browser-timing limitations for this implementation. Generator synchronization,
physical DDL, safe React/EForge outputs/pages and full original parity remain active.

## Generator synchronization checkpoint (2026-10-06)

Canonical synchronization and original synchDb now share a guarded metadata
transaction, preserve exact surviving IDs and original conditional settings, and
persist actual physical PK/auto/type changes with checked writes. Tree/subtable
references and stale complete field saves are protected. Product sync performs no
physical DDL or business-row writes. 444 backend tests (eight MVC, eight algorithm,
ten data-scope), frontend lint/typecheck/reproduction/build, 73 units and 64 fixture
browsers pass. Both final actual API configurations prove complete update/insert/
delete and audit rollback/retry, concurrent SQL waiters with 204/409 outcomes,
permission boundaries, retained full post-DDL rows and exact live OpenAPI.

A legacy SQL-detail leak was reproduced by a failing HTTP test, then repaired
inside the original synchronization boundary; all eight MVC cases and both final
actual API configurations pass. Both configurations passed 43 existing real
browsers before this last backend privacy repair. Exact-head cloud must run the
final browser/runtime source; acceptance remains pending. See
`docs/security-review-generator-sync-v1.md` for evidence timing and limits.

Physical creation remains a design checkpoint in
`docs/proposed-generator-create-boundary.md`, with no new creation API claimed.
React/EForge output/templates, immutable snapshots, preview/download/custom output,
complete generator pages and generated CRUD/tree/submodule end-to-end proof remain
required, followed by form builder, shell/shared, calendar/export audits and full
original parity. The specifically rejected task runtime scheme remains untouched.
Exact synchronization implementation ff67dd4889723f9704df34cbc7edccd01eaef90e
passes server 37371330417 all three jobs (attempt 2) and web 37371330438,
confirmed 2026-10-06. Both final configurations pass 43 actual browsers, full
MySQL/Redis/Quartz/OSHI/ACL/captcha and synchronization regressions, and exact
OpenAPI. This supersedes the earlier pending-cloud/browser-timing limitation.
Attempt 1 could not acquire hosted runners for two jobs; those jobs had no test
steps, and the same-run failed-job retry passed without a source change. The
successful original runtime job is retained. This accepts synchronization only;
physical creation, generator output/templates/pages and full parity remain active.
### 2026-10-06: generator creation AST policy and fidelity foundation

- Pure, unwired whole-batch AST policy and immutable parser snapshots now have
  30 targeted cases. Reproduced clone/visitor/renderer omissions are repaired,
  including CTAS WITH, unsafe generated/partition expressions, subpartition
  options/comments and distinct RANGE/RANGE COLUMNS syntax without a pin change.
- Full Maven verify passes 474 cases (464 boot plus ten data-scope cases). Both
  final real API configurations pass and exact normalized OpenAPI matches the
  contract; generated client reproduction passes. Frontend/contract trees remain
  unchanged, with prior accepted browser evidence; new cloud acceptance is pending.
- The committed isolated MySQL fidelity probe executes actual prepared SQL and
  proves partition kinds/comments, CTAS WITH/LIKE and source retention.
- Creation API/executor, live source/CTE/view resolution, SQL modes, native-function
  compatibility coverage, honest partial DDL/import outcomes and concurrency still
  require implementation and real acceptance before endpoint wiring. Generator
  React output/pages, task mutations, shell/shared and final acceptance remain.
- Online form builder stays deferred by the user's current scope decision.

See `proposed-generator-create-boundary.md` for exact evidence and limitations.
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

### Shared generator creation HTTP — local validation complete, cloud pending

Canonical POST /api/v1/tool/generator/creations and original form creation now
share the admin command, complete-batch preflight, separate physical DDL and
checked independent metadata import. Partial failures preserve truthful physical
and import outcomes, without compensating DROP or SQL input auditing. The real
OpenAPI candidate and generated client include this operation.

Local Maven passed 488 tests including 10 data-scope cases; 8 creation MVC/security
cases passed. Actual Spring/MyBatis MySQL probes passed 47 assertions in each
native case mode. Frontend lint/typecheck/reproduction/build, 73 unit tests and
64 simulated browser cases passed. Final default/enabled complete HTTP runs
are terminal success, including actual SQL failure/recovery, concurrent creation,
audit, configuration/sync and full MySQL/Redis/Quartz/OSHI/ACL/captcha regression.
Both exported OpenAPI snapshots exactly match the contract. Production security
defaults pass. Final real-browser and exact-commit cloud acceptance remain pending.
See security-review-generator-create-http.md.
This phase does not complete generator output/UI or the overall objective.
Form builder remains deferred; all other current requirements remain.

### Creation server acceptance and cache tooltip regression repair

Creation/client 27a26e4 passed exact server-ci 37408353480 in all three jobs,
including both 47-case Spring/MyBatis probes, both 43-case real browser profiles,
both complete HTTP creation/configuration/sync/monitoring regressions and exact
OpenAPI checks. Initial web-ci 37408353499 failed the existing cache tooltip
mobile resize scenario. Its actual cloud trace and a controlled local timer/
resize test reproduced HTML tooltip overflow before the fix.

The fix restores the active tooltip during resize and removes tooltip position
transitions. Original security, exact-counter, keyboard and full DOM-boundary
assertions remain. The same gated scenario passes after the fix and eight repeats;
all frontend checks, 73 unit and 64 simulated browser tests pass. Final exact
patch cloud acceptance remains pending. See security-review-cache-tooltip-resize.md.
No generator UI/output or full-objective completion is claimed; form builder
remains deferred and every other current requirement remains.

Final exact-commit acceptance (2026-10-06): implementation f5a62c7931225b86768385fbc2ffe84809f46b84.
Server run 37409725668 is terminal success in all three jobs; web run 37409724884
is terminal success. The server log directly proves default/enabled profiles each
43 real browser tests, both complete creation HTTP fault/recovery/concurrency/audit
regressions, both 47-assertion native Spring/MyBatis probes and exact live OpenAPI.
Evidence: server/eforge-boot/target/cache-tooltip-cloud-final.log. This supersedes
pending statements above. Generator output/UI remain incomplete; form builder is deferred.
Generator immutable metadata snapshots (2026-10-06): internal capture and real
permission-controlled REPEATABLE_READ/REQUIRES_NEW loader added. Final 500 backend
tests pass; 12 capture/template-parity tests and both native MySQL modes each
30 real Spring/MyBatis assertions pass, including concurrent root/child/field
commits, outer-transaction isolation, safe SQL failure/recovery and empty LEFT JOIN
field regression. See security-review-generator-rendering-snapshot.md. These are
not output endpoints or React/EForge output/UI acceptance. Exact cloud is pending.
Generator target-language text foundation (2026-10-06): actual Java compiler,
JSON/XML/SpEL parsing and both native MySQL case modes (four SQL modes) prove
literal fidelity and injection containment. Full Maven 505 tests and five targeted
tests pass; both native modes each 23 assertions pass. See
security-review-generator-output-text.md. This helper is not yet used by templates
or output endpoints; all renderer, React/EForge and UI work remains required.
Exact-commit cloud is pending. Form builder stays deferred.
Exact cloud acceptance (2026-10-06): snapshot implementation
5567fb2e348ba6c1faa627d5a8e7a31f12514e2c, server run 37411636219,
and text-context implementation 7c7405cec289188b911337f6f876a13b2443e7b8,
server run 37412282095, each finished successfully in all three jobs.
Direct logs generator-snapshot-cloud-accepted.log and
generator-output-text-cloud-accepted.log prove both profiles each 43 real browsers,
complete real API/MySQL/Redis/Quartz/OSHI/ACL/captcha regressions, identical live
OpenAPI and the native assertions for their exact sources. Both modes of the text
commit show 30 snapshot and 23 output-context assertions. These accepted commits
are foundations; they do not prove the later uncommitted original-preview change.
Original generator preview and Java text (2026-10-06): preview now renders one
consistent metadata snapshot with separate working graphs per template. The old
success/error envelope and authority are retained. Original Java domain, mapper,
service and controller free-form comments/Excel/audit/export text now use explicit
encodings; actual CRUD/tree/subtable Java output compiles and reflection preserves
hostile labels and converters without injected members. Final 521 backend tests,
41 targeted tests, both native MySQL modes each32 and both complete APIs pass;
OpenAPI is unchanged. See security-review-generator-preview-snapshot.md.
Exact final cloud/two final43 browsers are pending. SQL/XML/JS/TS, identifiers,
paths/ZIP/custom output, React/EForge output, full generator UI and actual business
runtime/browser acceptance remain. Form builder stays deferred.
Original Mapper XML physical-name integration (2026-10-06): actual original
CRUD/tree/sub XML now composes MySQL identifier and XML encoding, while result
column attributes preserve physical names independently. Whole531 backend tests,
10 real MyBatis parsing/binding cases, both actual MySQL modes each132 statements/
assertions and both native snapshots each32 pass. The JDBC mode-switch fixture
failure was corrected by initializing/verifying each connection's mode; exact
value assertions and client prepared statements remain. Final two complete API/
browser profiles and exact cloud are pending. See security-review-generator-mapper-xml.md.
Java/OGNL identifiers, other SQL/JS/TS contexts, immutable file bundles/ZIP/custom
paths, true React/EForge templates and full generator management/runtime acceptance
remain unfinished; form builder remains deferred.
Exact-cloud acceptance: implementation 841e3aed8a55268713306e27a7e3319dc0e5d015,
server run https://github.com/JRzero/EForge-Enterprise/actions/runs/37429057075
finished SUCCESS in all three jobs. Direct generator-preview-java-cloud-accepted.log
shows final521 backend tests, both32 snapshot profiles, both23 text profiles,
default/enabled each43 real browser tests, both complete real API regressions and
both unchanged live OpenAPI checks. This accepts the original-preview/Java stage
only. It does not accept the later Mapper XML change or complete generator output.
Final local Mapper XML acceptance: authority6963 terminal exit0; default and
enabled profiles each43 actual browsers and all complete API/SQL/Redis/Quartz/
OSHI/ACL/captcha/permission/concurrency regressions pass. Both live OpenAPI exports
match contract SHA256481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
New implementation exact cloud remains pending. Local stage acceptance does not
complete the generator output/UI or the full current goal.
Exact XML-stage cloud acceptance: d8eb258f48bb9a71b8bb3f055eeeaa36fac7fac4,
https://github.com/JRzero/EForge-Enterprise/actions/runs/37432111694, all three
jobs finished SUCCESS. Direct generator-mapper-xml-cloud-accepted.log shows531
backend tests, both32 actual snapshots, both132 actual Mapper/literal probes,
default/enabled each43 actual browsers, complete real APIs and unchanged OpenAPI.
Observer43858 finished exit0. This does not accept the later menu/SpEL source.
Actual generated menu SQL and controller annotation integration (2026-10-06):
all original dynamic menu literals and Java route/Java-embedded SpEL permission
arguments now use their actual contexts. Original six permissions and six menu
rows per batch remain.533 backend tests,4 complete Java generation compiler/
reflection/SpEL cases,1 actual SQL AST case, both230 actual native assertions and
both32 snapshot profiles pass. Final both complete API/browser/OpenAPI profiles
and exact new-source cloud are pending. See security-review-generator-menu-spel.md.
No React/EForge/full output/UI completion is claimed; form builder remains deferred.
Final local menu/SpEL acceptance:88871 terminal exit0, default/enabled each43
actual browsers and both full real API regressions pass. Both live OpenAPI
exports exactly match SHA256481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
Exact new-commit cloud is pending. This stage does not complete generator output,
React/EForge templates, management UI or the full active goal.
Exact menu/SpEL cloud acceptance:42b0a0d5de41fe4726f80a4e243dd96e54475d16,
https://github.com/JRzero/EForge-Enterprise/actions/runs/37435846617 all three jobs
SUCCESS. Direct generator-menu-spel-cloud-accepted.log proves533 backend tests,
both230 native output/Mapper/menu checks, both32 snapshots, default/enabled each43
real browsers, full APIs and unchanged live OpenAPI. Observer80201 ended1 only
because its final GitHub API poll returned unexpected EOF; authoritative run/jobs
and direct logs prove success. No rerun/source change was needed. This accepts
that exact menu/SpEL stage, not the later FK alias change.
Actual subtable FK alias fix (2026-10-06): original generation failed all three
actual Java compiler cases with saved custom foreign-key Java fields. Rendering
now separates physical SQL identity, saved Java property and original getter/
setter spelling. All three now compile; actual generated service bytecode assigns
exact parent data before batch persistence.538 backend tests, both474 real native
statements/assertions, both32 actual snapshots and actual MVC safe no-write errors
pass. Final default/enabled profiles each43 real browsers and complete APIs pass; both live OpenAPI files exactly match the contract. Session58628 ended0. Exact new-source cloud remains pending.
See security-review-generator-fk-java-field.md. Broader identifiers/tree aliases,
complete bundle/paths/canonical output/React/EForge/UI/end-to-end remain required.
FK exact cloud accepted: 660fb4be282d113f127cf0b317fb1b4ea1b89987,
server37440030951 all three jobs SUCCESS. Direct generator-fk-cloud-accepted.log
proves538 backend, both474 native checks/both32 snapshots, two43 real browsers,
complete APIs and exact OpenAPI. Observer29040 ended0. Later bundle integration
is independent and not covered by this accepted SHA.
Original output bundle integration (2026-10-06, local runtime verified/cloud pending):
Original preview and single/batch downloads now share pure snapshot rendering and
immutable complete file output. The entire name selection uses one short
REPEATABLE_READ/REQUIRES_NEW read with original code permission; preview-only is
insufficient for downloads. Preserve original template keys, all CRUD/tree/sub
and UI/Plus/Plus-TypeScript files and original shared index export append rules.
Reject unsafe portable relative paths and conflicting files before returning ZIP;
return safe legacy JSON failures and retain failed audit instead of partial ZIP.
565 backend tests pass (555 boot +10 scope). Actual original download MVC cases
initially expose three failure-envelope regressions; targeted controller adapter
fix keeps all19 green. Nine original template families retain every ZIP file and
content; Unicode names remain exact, collisions/path refusals and immutable
output verified. Real MySQL modes0/1 each64 assertions prove original and named
snapshot permissions before SQL, concurrent table/field commit coherence,
caller transaction suspension, SQL fault privacy/recovery, pure render without
DB reads and actual original service ZIP/preview content agreement. Session44960
completed both final full API and43-browser profiles sequentially, including new
actual HTTP binary single/batch output, safe failure, audit and row retention.
Both live OpenAPI snapshots match the contract. Exact new cloud remains pending.
Canonical output/client, custom filesystem paths, true React/EForge templates,
complete generator UI and generated business HTTP/browser remain outstanding.
See security-review-generator-output-bundle.md. Form builder remains deferred.
Final local runtime acceptance (2026-10-06):44960 ended0. Default and enabled
profiles each43 real browsers and complete real API regression pass, including
actual single/batch binary output/preview agreement, saved FK field, TS export
merge, unsafe/missing/duplicate/SQL errors and retry, no-role, honest audit and
full metadata/business-row equality. Both live OpenAPI snapshots equal contract
SHA256 481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
No local integration app is retained. Full frontend generated/lint/typecheck/
73-unit/build pass. Output-limit target44 passes after the full565 build with
only an additional test, no production jar/source changes. Exact cloud pending.
Exact bundle cloud acceptance: a884f08a783cadc73f2087a304f83c5181a53e32,
server37443783208 all three jobs SUCCESS. Observer84145 ended0. Direct
generator-bundle-cloud-accepted.log proves566 backend (556boot+10scope), modes0/1
each64 actual snapshots and474 actual output/Mapper/menu checks, default/enabled
each43 real browsers, original single/batch output HTTP/audit/retention and full
APIs/OpenAPI. This accepts only bundle implementation, not later canonical APIs.
Canonical output API stage (2026-10-06, final runtime/cloud pending): actual typed
preview and full binary download under/api/v1 now share immutable output; original
preview/code permissions remain separate, exact string IDs and safe problems,
no-store and audit preserved.586 backend/20MVC, actual default full API without
browser, generated client reproduction and frontend75/lint/typecheck/build pass.
Final both43/browser API profiles now under86768. First contract B817D25F... new
schema is not accepted by the prior bundle cloud. No canonical custom filesystem,
React/EForge templates or complete generator UI claim; all remain required.
See security-review-generator-canonical-output-v1.md.
Final local acceptance (2026-10-06): both generator-canonical-output-disabled/enabled-runtime.log end in PASS and each records 43 real browser tests passed. Session86768 is no longer retained; authoritative complete logs and both live OpenAPI exports prove terminal success. Both exports exactly equal contract SHA256 B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0. Canonical preview/download real permissions, full binary fidelity, safe SQL/path failures/recovery, audit and exact metadata/business-row retention pass. Cloud acceptance of this canonical implementation remains pending its own commit and workflows.

Exact canonical cloud acceptance: implementation 67ea28c8531657f563068cfc6fc37133cbaf0ce1; server37458912730 all three jobs and web37458912762 SUCCESS. Observer50720 ended0; web18052 ended0. Direct generator-canonical-output-cloud-accepted.log proves 586 backend (576boot+10scope), both native64 snapshots/both474 output contexts, both43 real browsers, complete original/canonical API output fidelity and full MySQL/Redis/Quartz/OSHI/ACL/captcha regression. Both cloud OpenAPI comparison steps pass against committed B817D25F... contract. This accepts only canonical preview/download/client, not the later uncommitted primary-key accessor fix or remaining generator templates/UI/custom output.

Final local acceptance: session46711 ended0; default/enabled profiles each record43 real browsers and final complete API PASS. Both live OpenAPI exports equal contract B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0. Actual SQL saved oRderKey output, original/canonical complete preview and binary ZIP, safe SQL/path failures/retry, honest audit, exact metadata and business rows pass. No local app retained. Frontend source is unchanged from accepted67ea28c (75units/lint/typecheck/build/generated reproduction and accepted web37458912762). New fix cloud acceptance remains pending its own exact commit/run.

Exact cloud acceptance: bd83767f99f7b07a8ff54debda5c71c6f4d38088 server37461230715 all three jobs SUCCESS; observer6740 terminal0. Direct generator-pk-accessor-cloud-accepted.log proves589 backend (579boot+10scope), both64 snapshots/both474 output context native probes, default/enabled each43 real browsers, complete original/canonical output HTTP and MySQL/Redis/Quartz/OSHI/ACL/captcha APIs and both exact OpenAPI comparisons. Frontend unchanged from accepted67ea web37458912762. This accepts the PK fix only; later dirty custom-filesystem source is not covered.

Custom filesystem output (2026-10-06, final runtime pending): canonical typed POST
and original custom route share complete immutable output and atomic backend file
installation within a trusted configured root. Default disabled and original code
permission before SQL remain. Paths/links/junctions, partial retained/unconfirmed
outcomes, safe errors/audit, Unicode destinations, flat/prefixed root settings and
no automatic client retry are verified. Full Maven603 (593boot+10scope), targeted34
(one host-specific symlink skip; actual Windows junction passed), frontend79 units/
lint/typecheck/build/generated reproduction and64 mocked browsers pass. Corrected
actual no-browser API export equals D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
Final default/enabled API+43-browser profiles run sequentially under83433. Cloud
not yet submitted; earlier accepted PK source does not cover this implementation.
See security-review-generator-custom-output.md. True React/EForge templates, full
manager UI and actual generated business HTTP/browser remain required. Form builder
is deferred; the specifically rejected Quartz runtime proposal is not implemented.

Final custom output local acceptance:83433 ended0; default/enabled each43 real
browsers and complete API PASS. Both final live OpenAPI snapshots exactly equal
D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
Actual canonical/original backend file bytes and replacement results, disabled
protection/path refusal/no-role/audit, full metadata/business-row retention and
complete MySQL/Redis/Quartz/OSHI/ACL/captcha regression pass. No local app retained.
Cloud acceptance remains pending this exact implementation's workflows. This does
not complete React/EForge templates, generator UI or generated business deployment.

Exact custom output cloud acceptance: implementation
7d0563476688255543969169a147bf4e96d1c59c, server37470491224 all three jobs
SUCCESS and web37470491110 SUCCESS. Observers13268/71517 ended0. Direct
generator-custom-output-cloud-server-accepted.log proves603 backend (593boot+
10scope, one OS-specific skip), actual MySQL modes0/1 each64 coherent snapshots
and each474 output contexts, default/enabled each43 real browsers, complete
canonical/original output and MySQL/Redis/Quartz/OSHI/ACL/captcha APIs, actual
custom filesystem bytes/replacement/default protection and exact committed
OpenAPI comparisons. Direct web-accepted log proves79 units,64 mocked browsers,
generated reproduction/lint/typecheck/build. The corrected D3161897... contract
is accepted. Earlier missing200 exports are superseded, not accepted evidence.
This accepts custom output/API/client only; true React/EForge templates, full
manager UI and actual generated business deployment remain required.

EForge generated business API template stage (uncommitted, 2026-10-06): actual
CRUD/tree/sub bundles now additionally render concrete /api/v1 business DTO/read/
write/export controllers, keeping original permissions and compatibility routes.
Actual source compilation and Spring MVC+MethodSecurity/XLSX validation pass for
all three categories; business compilation excludes boot classes, API compilation
uses boot assembly. Full verify606 (596boot+10scope, one OS skip) passes. These
service-witness tests do not prove actual SQL module deployment/transactions or
new generated OpenAPI/client/React flows. Existing API regression is sequential
session67710, no-browser default then enabled consoles/custom output, still pending.
React frontend remains Vue fallback and must be replaced, complete generator UI
and generated real CRUD/tree/sub HTTP/browser remain incomplete. See
security-review-generator-eforge-api-templates.md; form builder remains deferred.

Existing API regression progress: default generator-eforge-api-disabled-runtime.log
ends in complete PASS; actual exported OpenAPI exactly matches existing contract
D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
The same sequential authority67710 is now running the explicit enabled profile.
Do not restart or package while its local app is live. This first regression has
no browsers and does not deploy the newly generated business module API routes.

Final existing API regression:67710 ended0. Both default and explicit enabled
consoles/custom-output profiles end in complete API PASS, and both exported
OpenAPI files exactly equal D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
No local app is retained. This was a no-browser regression of the framework and
existing generator endpoints; generated business modules were not installed.
Frontend source/contracts remain unchanged from accepted7d05634 (79units/64mocked/
two43real browser profiles). The new three-category actual module compiler/MVC/
method-security/XLSX tests and full606 verify are green. Saving this template
checkpoint does not accept module SQL/transactions/audit/deployment, new module
OpenAPI/client, actual React/EForge output or complete generator UI.

Actual generated business SQL module stage (2026-10-06, new scripts uncommitted):
verify-generator-business-module.ps1/probes/GeneratorBusinessModuleMysqlProbe.java
render and compile actual CRUD/tree/sub modules into an exclusively owned temporary
class directory, register the real generated MyBatis Mapper/Service and canonical
controller in Spring method-security/transaction context, and issue actual MVC
requests against isolated MySQL. Modes0/1 each52 assertions pass in
generator-business-module-native-0/1.log. Exact Long/decimal/string SQL round trips,
real filtered query/paging, denied create before physical writes, persisted create/
update/delete and child FK assignment pass. A real strict parent UPDATE failure
occurs after child deletion/reinsertion: both parent and child content roll back
under the actual generated controller/service/DataSourceTransactionManager chain.
Owned containers and generated directories are cleaned; cleanup validates the
resolved temporary root and owned prefix. The new native check is included in CI.

This extends the earlier service-witness evidence with actual SQL and transaction
proof, but does not prove concurrency, persisted LogAspect audit, actual network
server/OpenAPI/client or browser deployment. React frontend is still Vue fallback;
complete React/EForge templates, manager UI and generated browser flows remain.
Initial failures were only fixture startup (unquoted JVM option parsed by PowerShell,
then missing mapper factory import); no product logic was altered to pass them.
The previous implementation87b3f3f cloud still runs;79642 observation alone failed
with annotations unexpected EOF while authoritative GH jobs remained live. A single
reconnected observer now follows the same workflow; no tests were rerun or restarted.

Exact template-source cloud acceptance (2026-10-07):87b3f3f391614f0bd4cef247d663f79c95669d5e,
server37489735710 all three jobs SUCCESS. Direct generator-eforge-api-cloud-accepted.log
proves606 backend (596boot+10scope, one OS-specific skip), both MySQL modes each66
actual snapshot assertions (two new template outputs increase the former64),
each474 output contexts, default/enabled each43 real browsers, complete existing
APIs and exact committed OpenAPI comparisons. Original observer79642 ended1 only
because GH annotations returned unexpected EOF; authority stayed live. Reconnected
observer77573 ended0 after the same run succeeded; no tests were rerun.

The newer native SQL scripts/CI are commit e8a637fffba3487a1357c9f393435f2be7dbeebc;
they have local modes0/1 each52 actual generated module SQL/rollback assertions,
but their own server37492073073 remains pending. They are not covered by the older
87b source cloud acceptance. Its unique observer43975 follows
 generator-business-module-cloud-server.log. Complete generator/network/client/React/
UI acceptance remains incomplete. No frontend source changed or new web workflow.


2026-10-07 generated module loopback HTTP checkpoint: actual compiled CRUD/tree/sub
modules are served by embedded Tomcat with original mapper/service and real MySQL;
both modes each80 assertions passed, including no-role network refusal, precise IDs,
physical writes/deletes and immediate permission withdrawal. Owned servers/databases
exit cleanly. Controlled test LoginUser does not prove deployed JWT/Redis auth;
persisted audit/concurrent writes/OpenAPI/client/React/UI/browser remain pending.
The new probe is locally verified only; e8a637f cloud37492073073 still runs and does
not include this new HTTP code. Form builder remains deferred, not complete.


2026-10-07 native SQL e8a637f cloud37492073073 all three SUCCESS, direct accepted
log proves two52 SQL/two66 snapshot/two474 text/two43 real browser/full API checks.
New generated API OpenAPI/client checkpoint is locally verified: actual HTTP springdoc
contracts exposed and fixed numeric exact-ID/decimal-filter and inferred success-code
bugs; pinned client reproduces twice, strict types and real CRUD/tree/sub HTTP/filter/
XLSX checks pass with actual SQL (each116 assertions in both modes). Full Maven606,
frontend79 units/repro/lint/types/build pass. Product JWT/Redis, persisted audit and
concurrency, actual canonical group inclusion of generated packages, real React/EForge
output/manager/browser remain pending. Network7c5e041 cloud37493510404 is separately
pending and cannot accept these latest fixes. Form builder remains deferred.


Latest client-contract local final regression: sequential process20597 exited0;
default/enabled custom-output complete existing real API checks both PASS in
generator-business-client-disabled/enabled-runtime.log (no local browser run).
Both live OpenAPI hashes equal committed D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
No live local app remains. This verifies existing product APIs, while generated
module network/client evidence remains the independent two116 native checks;
production auth/group integration and full React generator remain pending.


2026-10-07 generated client764d36b server37496589462 three jobs/web37496589426 all
SUCCESS; direct logs verify two116+three actual generated client checks each mode,
606backend/two66/two474/two43 main real browser/frontend79units64mock/full API.
New production canonical documentation fix: actual YAML/multi-group regression failed
before the package filter was removed and passed after; /api/v1/** includes installed
generated packages while original compatibility remains usable and excluded. Both
modes122 checks, Maven606 and both complete actual API profiles pass; live contracts
remain exactly D316... . Its own cloud acceptance is pending; JWT/Redis generated
module/audit/concurrency/React templates/generator manager/browser remain incomplete.
Form builder is still deferred, not completed.

Exact canonical group cloud acceptance (2026-10-07): 08771cd604d9f17c321884cede68850bc2e7b472,
server37499013614 all three jobs SUCCESS. Observer24489 ended0; direct
generator-business-group-cloud-accepted.log proves both122 generated HTTP/SQL/
group assertions, actual generated clients, both43 real browsers/full API and both
unchanged canonical OpenAPI comparisons. This accepts the YAML group fix only,
not the later actual Boot deployment and user-session changes.
Actual original Boot generated deployment (2026-10-07, final cloud pending):
The actual generator-rendered CRUD/tree/sub Java and mapper XML compile and install
into the original Boot assembly through a disposable owned classpath. Original
JWT/Redis/method permission/MyBatis/LogAspect chains and actual canonical group
produce real generated clients with exact long/decimal HTTP CRUD/filter/XLSX.
Real no-role grant initially failed because canonical user allocation left cached
permissions stale. UserController now reuses the existing refresher after commit
for allocation/update/status/delete, preserving TTL and logout and skipping rollback.
Full Maven607 (one OS skip), frontend79/repro/lint/types/build and both122 native
generated client regressions pass. Final default and enabled/custom complete API regressions both pass; session19503 ended0. No local app remains. New exact-commit cloud/browser acceptance remains pending.
See security-review-generated-business-boot.md. React frontend templates, full
generator management and generated browser flows remain incomplete.
### Original Boot generated module acceptance (41ce1b4)
Exact implementation 41ce1b4296a704ef72231bf030f92f58b689116d is accepted:
server37505004687 all three jobs and web37505004677 terminal SUCCESS. Direct
generated-business-boot-cloud-accepted.log and generated-business-boot-web-accepted.log
prove Maven607 (597 Boot +10 data-scope, one OS-specific skip), actual generated
module installation/JWT/Redis/MyBatis/client/persisted audit, and both configuration
profiles with43 existing real browser cases/full API/OpenAPI. This accepts the
user-session refresh patch and original Boot integration, not later React output
or generated browser work. The React stage is currently uncommitted and under
real browser validation; full generator management and remaining parity are pending.
### Actual React generator page stage
eforge-react now emits actual pinned EForge CRUD/tree/sub pages, static route exports
and reproducible clients from installed canonical OpenAPI; Vue fallback for this
target is removed. Strict page types/lint and real original Boot/JWT/Redis/SQL
browser create/edit/detail/search/reset/tree/sub update/bulk selection/XLSX/delete,
exact identifiers/decimals/root-parent/FK, hostile text and no-role denial pass in
both focused profiles (42073 terminal0). Final Maven607 passes. Full default
framework43/browser/API regression passes before the final template-only root
default patch; paired enabled run intentionally exposes pre-fix null-versus0 and
is not accepted as full enabled success. Final focused rebuilt root0 passes both.
Installed module schemas agree at615CC710...; main contract is preserved. Exact
new cloud acceptance is pending. See security-review-generator-react-pages.md.
Production route/menu registration, actual dictionary/upload/rich-text variants,
full manager UI and remaining original parity are required; form builder deferred.
### React page stage exact cloud acceptance
Implementation aa5259521c8ee5779468be03c32910de160de8cb is accepted:
server37516887733 all three and web37516887676 terminal SUCCESS, observer82771
ended0. Direct generator-react-cloud-accepted-server/web.log prove607 backend,
81 unit/64 mocked, both full43 real browser/API profiles and unchanged main OpenAPI,
plus both focused real generated CRUD/tree/sub pages/clients/auth/SQL/audit and equal
installed schemas. This accepts the actual page stage, not full generator parity.
Production static routes/canonical menu install, all dictionary/upload/rich-text
variants, full generator manager and remaining original capabilities still required.
### Generated React host and canonical menu installation
Actual emitted packaged route declarations, static host registry and transactional
menu SQL now integrate CRUD/tree/sub pages with original Application navigation.
Local Maven610 (600boot+10scope),83 units and both actual installed-host profiles
pass, including production builds, MySQL post-root rollback/duplicate protection,
navigation, no-role host403 and backend403, original generated actions/audit.
See security-review-generator-route-install.md. Exact new cloud is pending.
This is an installation stage; full generator manager, control variants, shared
shell and final active parity remain required. Form builder remains deferred.
### Generated route installation exact cloud acceptance
Implementation8157b87c7bed2cf4b3e1f52d6507bb11e73c85f7:
server37522840964 all three and web37522840972 terminal SUCCESS, observer29769
ended0. Direct generator-route-cloud-accepted-server/web.log prove610 backend,
83 unit/64 mocked, both full original43/browser/API/main-OpenAPI profiles and both
real installed host production-build/navigation/CRUD/tree/sub/auth/SQL/audit runs.
The installation stage is accepted. New template-selection contracts under
development are separate; full manager, control variants and active parity remain.
### Canonical generator template-selection prerequisite
The editor's fixed four template choices now survive canonical metadata updates;
omitted/null retains the previous React default and arbitrary resource paths are
rejected before SQL. Actual MVC19/full Maven615, reproducible generated optional
enum,83 units/build and both complete43/browser/API/MySQL/Redis profiles pass.
See security-review-generator-template-choice.md. Main live/committed schema hash
7C431ED9D0876F95649E9432A6B06759BF741E93BE8B58BE9AD1FC33B4EE5E5D.
Exact new cloud is pending. This prerequisite does not implement the full manager
page or prove all generated control variants; those remain active.
### Generator template selection accepted; manager implementation in progress
Exact4664f31556edf7428bf2eb9cd7b324c9b78781c8 server37526251402 all three
jobs and web37526251594 succeeded. Direct accepted logs prove615 backend,
83 unit/64 mocked browser, both43 real framework profiles, actual four-choice
metadata/preview retention, installed generated-host profiles and identical
main OpenAPI. Observer78862 terminated0. See template-choice security review.
Uncommitted manager UI now has four preliminary mocked browser checks and85
units passing; it is not accepted as a complete manager or real page regression.
Remaining parent/dictionary pickers, original controls, migration/real browser
verification, generated control variants, shell and final active parity remain.
Form builder remains deferred and the specific Quartz approval boundary persists.

### Generator manager implementation and local verification
The static /gen manager and V026 route binding now implement discovery/import,
admin batch creation with honest partial DDL outcomes, metadata/field/output
editing, drag ordering, scoped parent and dictionary choices, tree/sub relations,
synchronization, inert highlighted preview/copy, ZIP and configured output,
confirmed deletion, filters/calendar/order/paging and column visibility.
Menu choices use the original authenticated user-scoped SQL projection and generated
contracts; JWT remains in headers. See security-review-generator-manager-ui.md.
Full local Maven618 (608boot+10scope), targeted20 MVC,89 frontend units,71 mocked
browser, lint/types/build/reproducible client pass. Default full47 real browsers
have passed and SQL proves retained original rows/created tables with failed,
unattempted and unauthorized tables absent. The full two-profile API/browser
sequence and exact new cloud remain pending; no full acceptance is claimed yet.
All emitted control variants, shared shell and final active parity still remain.
Form builder is deferred, not completed; the specific Quartz boundary persists.

### Generator manager final local two-profile verification
Exact implementation d569f33d2ddba9ae4a07f34115a5bcf77511388e has now passed
both final default/enabled profiles: 47 real browsers each plus the complete API,
MySQL/Redis/Quartz/OSHI/ACL/captcha/permission/data-consistency regression.
Sequential observer94994 ended0; generator-manager-final-disabled/enabled-runtime.log
and their live OpenAPI match the committed36EE572B... hash. Post-browser SQL proves
original business rows, retained first/tree/sub tables, absent failed/unattempted/
unauthorized tables and removed metadata. Exact web37533050094 is terminal success;
server37533050064 remains live under unique observer62282, not yet accepted.
Next generated-control matrix fixture is independent uncommitted verification work;
its emitted controls are not accepted merely because the manager stage passed.

### Generator manager exact cloud acceptance
Implementationd569f33d2ddba9ae4a07f34115a5bcf77511388e: server37533050064 all
three jobs and web37533050094 terminal SUCCESS; unique observer62282 ended0.
Direct generator-manager-cloud-accepted-server/web.log prove618 backend (608boot,
10scope, one existing OS skip),89 units/71 mocked, both47 real framework/browser/
API profiles, actual installed generated-host profiles and matching OpenAPI.
The manager stage is accepted. The next expanded emitted-control matrix remains
independent local work; its first default actual run now passes after fixture-only
JSON transport and absolute file-request fixes, with no product source change.
All control variants, shared shell and final active audit remain; form builder is
deferred and the specific Quartz runtime rejection remains effective.

### Generated controls and explicit empty-string correction
Actual installed generated CRUD now covers all nine original control kinds and
seven Java types, including dictionary query select/radio, PNG/text upload with
real serving, millisecond dates, numeric zero/Boolean false, rich text and legal
__proto__. A real optional String clear failed before the template correction and
passes after; optional input/select now retain explicit empty strings instead of
omitting them. Original Vue dictionary-query dropdown behavior is preserved.
Full Maven618/89 frontend units/lint/types/repro/build and both default/enabled
installed Java/TS/EForge production host/browser/HTTP/MySQL/Redis/audit profiles
passed; sequential observer99052 ended0. See control-parity review and
control-clear-locator-before/fixed-disabled/fixed-enabled-runtime logs.
Exact new cloud is pending. Tree/sub control permutations, required/disabled/auto
key variants, calendar/XLSX edges, shared shell and final active audit remain.
Form builder stays deferred; the specific Quartz runtime boundary is unchanged.

## Expanded root and child matrix checkpoint

The deployment fixture now emits all nine control kinds and seven Java types on
all three CRUD/tree/sub root pages and on the actual subtable row. Child physical
columns and typed record fields are compiled from real metadata. The child PK and
parent FK retain their original identity/ownership behavior; added fields do not
replace that relationship.

The actual browser adds and edits a sub row with independent dictionary choices,
multi-selection, Unicode multiline text, rich text, PNG and UTF-8 file uploads,
millisecond dates, Long and BigDecimal beyond JavaScript integer precision, numeric
zero and Boolean false, and a legal __proto__ field. It serves and compares child
file contents, clears optional child strings/uploads/rich text, clears the child
date to a real SQL null through the original delete/reinsert transaction, verifies
changed exact Long/decimal and zero/false values, and retains the exact parent FK.
Every root page also executes its own actual select/radio wire-filter/reset checks,
including the tree's list response rather than a PageResponse assumption.

Root-only observer64197 passed default; it is superseded by final expanded
observer69262, terminal0 for default and enabled-console/custom-output profiles.
Generator-child-control-matrix-disabled/enabled-runtime.log prove actual Java and
TypeScript compilation, host production build, browser CRUD/tree/sub behavior,
HTTP/client/SQL/Redis authorization and audit. The two changed verification
sources pass lint; production templates remain the prior709865e implementation.
Exact expanded-matrix cloud is pending. Required/disabled/auto-PK variants and
other remaining groups above have not been marked complete.

### Explicit-string correction exact cloud accepted
709865e1e654be77fd477cd350da0bd472170f1c: server37536091699 all three and
web37536091726 terminal SUCCESS; unique99910 ended0. Direct accepted logs prove618
backend/89 unit/71 mocked, both47 real framework/API profiles, both actual
installed generated hosts, original query dropdown and string-clear correction,
main OpenAPI/client agreement. Expanded root/child matrixaafa28d remains separately
pending under server37537425688/web37537425654 and observer39583; new Boolean
numeric-choice correction remains local work. Full active objective is incomplete.

Expanded generated root/child control matrix aafa28d cloud accepted (server37537425688 and web37537425654). Continue Boolean dictionary correctness, required/readonly/auto-PK variants and the remaining active parity inventory; form builder remains deferred.

Generated Boolean dictionary correction: actual before-fix radio failure reproduced; after-fix default/enabled CRUD/tree/sub and child browser/HTTP/SQL/Redis/audit regressions pass. Exact cloud pending. Continue required/readonly/auto-PK variants and remaining original capability audit; full goal incomplete.

### Generated required fields and logout correction under verification

The exact Boolean3266157 server run37539853310 failed in generated logout with
AbortError; its web and other two server jobs succeeded. This is a product race,
not an infrastructure retry. Logout now finishes its captured-token revocation
through the bounded transport even if a concurrent401 or new login changes local
state; generation guards still preserve newer sessions.

Generated required checkbox validation, insert-only/edit-only phases, valid
zero/false values and own-property reads for legal __proto__ fields have actual
before-failure/after-success browser evidence. Final618 backend and91 unit/71
mocked browser checks pass. Final generated default/enabled profiles pass actual
Java/TypeScript/host/browser/SQL/authorization/audit. Both real focused login
profiles pass3 cases including the controlled logout race. Complete final enabled
API profiles now pass (observer52071 terminal0); new exact cloud acceptance is pending.
Full47-browser framework profiles passed before this final template/live-test
change; the updated complete live suite has48 cases and requires exact CI proof.
Continue automatic-key variants and the remaining original capabilities.
Form builder is deferred and the specific Quartz runtime rejection is preserved.
## Exact correction accepted

6b1e375ffd1c41012e93c0af0194399d8aebf650: server37547032711 all three jobs and
web37547032673 terminal SUCCESS. Unique observer83989 ended0. Direct
generator-required-logout-cloud-accepted-server/web.log prove618 backend
(608Boot +10scope),91 units/71 mocked browsers, both48 real framework browser and
complete API profiles, both actual installed generated host profiles, native
MySQL checks and both exact OpenAPI contract gates. The controlled real logout
test passes in both full live suites. Old3266157 remains failed; the corrected
exact source supersedes it. Automatic-key expansion is separate uncommitted work
and is not included in this acceptance. Full active parity goal remains incomplete.
### Automatic generated primary keys verified locally

Root automatic PK rendering/required validation now respects auto even when the
original import sets insert=1 and required=1. Actual browser92022 failed before
the fix; final six-module observer28066 ended0 in default and enabled profiles.
Manual and automatic CRUD/tree/sub, exact SQL-generated root/child Long IDs,
tree parent references, preserved old child IDs plus appended new IDs, no-role
denial and actual SQL zero-orphan bulk deletion pass.618 backend,91 units/71
mocked, generated production host builds and both matching installed OpenAPI
snapshots pass. New exact cloud acceptance is pending. Continue remaining typed
control/value cases and full original shell/auth/shared capability audit.
Form builder remains deferred and the prior specific Quartz rejection remains.
### Generated String primary-key selection verified locally

Actual installed browser59941 reproduced Delete selected being enabled without
selection for legal String PK __proto__. Generated UI row identities now use an
opaque prefix and only own true selection properties; API IDs remain original.
Final618 Maven/91 units/71 mocked browsers and42172 both actual seven-module
profiles pass. The new String prototype-name CRUD/edit/XLSX download/exact bulk
request/no-role flow and all prior manual/automatic CRUD/tree/sub regressions
pass with matching installed OpenAPI D203057072F9DADB7D936EEB5109D69E3976F1B98D15F17DD7A8D608B575A386.
Exact cloud is pending; shared shell and final active capability audit remain.
Form builder stays deferred, and the specific Quartz runtime rejection remains.
Automatic generated key implementation00d73a4314278eda7c61e88d36698b4d5ecc3514
is exact-cloud accepted: server37550410563 all three jobs and web37550410644
terminal SUCCESS, observer81717 ended0. Direct accepted logs prove618 backend,
91 units/71 mocked, both48 real framework browsers/full API profiles, both six
installed manual/automatic CRUD/tree/sub hosts with exact root/child keys and
SQL zero-orphan counts, and exact framework OpenAPI gates. Later String key
correction77c43dc remains separately cloud pending. Full active goal incomplete.
String primary-key selection77c43dc9045c1780cb919ad111212f916c6a051c is
exact-cloud accepted: server37551876095 all three jobs and web37551876119
SUCCESS; observer20828 ended0. Direct accepted logs prove both seven-module
installed generated hosts with legal prototype-name IDs, both48 full framework
browsers/API profiles,618 backend,91 units/71 mocked and exact OpenAPI gates.
Shared breadcrumb/search code remains separately local under verification;
full shell and active parity goal remain incomplete. Form builder is deferred.
### Authorized breadcrumbs and navigation search verified locally

Original fixed v3.9.2 Fuse6.4.3 title/path fuzzy search, layered labels/icons,
literal safe highlight, keyboard wrap/Enter/Escape, clear/empty/mobile, backdrop
closing/focus recovery and no-opener external opening are implemented. Authorized
menu hierarchy and static internal parameter route ancestry form breadcrumbs;
groups remain non-links and React components never come from database strings.
Actual focus and Unicode highlight failures were fixed, with before/after proof.
94 units/all74 mocked, final3 expanded mocked cases and83456 both real focused
navigation plus complete API profiles pass; exact live OpenAPI remains36EE572B...
No server source change; existing618 Maven/DataScope10 proof remains applicable.
Exact cloud/full49-case framework suites are pending. Continue original menu
query/cache/embedded metadata, tabs/cache/pin/context menu, collapse/topnav and
settings. Full active parity remains incomplete; form builder stays deferred.
### Breadcrumb/search exact cloud acceptance
072df8d server37554481245 all three jobs and web37554481231 are terminal
SUCCESS. Direct shell-navigation-cloud-accepted-server/web.log proves both49
framework browsers, both7 installed generated cases, complete real API/SQL/
permission/console/captcha regressions,618 Maven (10scope),94 units/74 mocked
and both exact OpenAPI equality gates. This stage is accepted; newer menu query
and cache metadata remains under verification. Tabs/cache, other shell functions
and final active capability audit remain incomplete; form builder stays deferred.
### Original menu query defaults integrated and verified locally

Canonical authorized ROUTE bootstrap metadata now includes original query JSON
and cache preference. Registered links, header search and parent breadcrumbs
carry exact Unicode/quoted long IDs/prototype-name keys/arrays/null; registered
paths retain correct active state. Invalid query roots show a fixed configuration
message and cannot create an executable link. GROUP/EXTERNAL metadata stays absent.
619 Maven including10scope,98 units/all75 mocked and both final2 focused real
navigation plus complete API profiles20514 pass. Both live OpenAPI snapshots
match65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
See security-review-navigation-metadata.md. Exact cloud/full50 framework cases
remain pending. Actual page retention/tabs/cache/pin/context, sidebar icons/
collapse/topnav/embedded, settings and final active audit remain incomplete.
Form builder stays deferred; the specific Quartz runtime denial still applies.
### Route metadata exact cloud acceptance
71a53e1 server37556646644 all three jobs and web37556646684 are terminal
SUCCESS. Direct navigation-metadata-cloud-accepted-server/web.log proves both50
framework browsers,619 Maven including10scope,98 units/all75 mocked, complete
real API/SQL/permission/session/console/captcha regressions and both exact
OpenAPI gates. Query propagation/cache preference delivery is accepted;
separate dirty tabs/actual page retention remains under verification.
### Actual page tabs and retained reads: local phase
Implemented affixed dashboard, per-path visited tabs/latest query, close/current/
others/left/right/all/middle-click, context/dropdown, remount refresh, keyboard/
scroll/fullscreen and per-account optional remembered links. Actual React Activity
retains cached pages; twelve completed built-in reads preserve data/selection/
drafts while aborted reads rerun. Resource close controls remove their tag/cache.
Account/role/grant/navigation transitions evict retained pages; display-name-only
profile refresh preserves save feedback. Real denied role403 plus permitted profile
save proves same-document bootstrap eviction and cleared unrelated drafts.
Both complete52-browser/API profiles47449 pass,98 units/build and final83 mocked
71098 pass; live OpenAPI exactly matches65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
See security-review-page-tabs.md for actual failure/repair and exact-request abort
proof. Exact cloud remains pending. Generated/action/remaining resource cache
lifecycle, sidebar/topnav/embedded/settings and final active audit remain open.
No rejected Quartz runtime plan was implemented; form builder stays deferred.
### Page tabs exact cloud acceptance
Exact5cfa35ab5b5322d749ef5234d84371572e5e2d55 server37562002947 all three
jobs and web37562002771 are terminal SUCCESS. Direct accepted server/web logs
prove both52 framework browsers, native/generated Boot verification, complete
API/SQL/session/permission regressions, exact OpenAPI gates,98 units and83 mocked
browsers. This accepts the committed tab/read stage; the following dictionary
action interruption patch is independently under verification. Remaining
generated/action/monitor/embedded cache, sidebar/topnav/settings and final active
audit are not complete. Form builder remains deferred.
### Dictionary retained-action recovery: local acceptance
An actual cancelled editor GET no longer leaves the cached dictionary page busy.
Completed reads retire their controller, so returning to a tab cannot falsely
unlock an unrelated pending cache-refresh POST. Both defects have browser
before-failure/after-success evidence; the new real case proves exact GET abort,
explicit genuine200 recovery, pending-write lock and exactly one genuine204.
Frontend reproducibility/lint/typecheck/98 units/build/all85 mocked pass.
43066 ended0 with default/enabled complete real API regressions and53 browser
cases each; both OpenAPI exports exactly match65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
See security-review-dictionary-cached-actions.md. Exact cloud remains pending.
Other action/generated/monitor/embedded lifecycle and shell settings remain open;
no automatic mutation retry or rejected Quartz runtime change was introduced.
### Dictionary action recovery exact cloud acceptance
Exact4349cd39c3d35ba564bf44977552e6f3838722b8 server37564226305 all three
jobs and web37564226259 are terminal SUCCESS. Direct accepted server/web logs
prove both53 real framework browsers, complete native/generated/API/SQL/grant/
session regressions, both exact OpenAPI gates,98 units and85 mocked browsers.
This accepts the dictionary read/write ownership patch only. The subsequent
task/log request-lifecycle source remains an independent pending stage.
### Task/log retained actions: local acceptance
Cancelled task/log exports release only their own busy state on tab restoration;
an explicit click produces the actual new XLSX. Pending log delete/clear requests
continue once across browser history navigation, keep their confirmation locked,
then display the actual acknowledgement and refresh SQL-backed results.
Four actual browser failures before repair become23 targeted passes. Final
frontend reproduction/lint/typecheck/98 units/build/all89 mocked browsers pass.
99088 ended0 with default/enabled complete API regressions and53 real browser
cases each. The original real Quartz case retains exact XLSX/sort/ID/paging/
SQL404/zero-row checks and adds both cancellation and pending-write navigation.
Both live OpenAPI exports equal65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
See security-review-job-cached-actions.md. Exact cloud for this patch is pending.
No Java scheduler/SQL authorization changes or automatic mutation retries were
introduced. Generated/upload/other lifecycle, sidebar/topnav/settings and the
final active capability audit remain open; form builder stays deferred.
### Task/log action recovery exact cloud acceptance
Exact66a910b5758fa54a5a655ce67982de92075bacdd server37566079776 all three
jobs and web37566079777 are terminal SUCCESS. Direct accepted logs prove both53
framework browsers, complete native/generated/API/SQL/session/grant regressions,
both exact OpenAPI gates,98 units and89 mocked browsers. Maven declares619
cases; each host executes618 with the platform-specific filesystem skip: local
Windows real junction protection passes while symlink privileges are unavailable;
Linux executes symlink protection and skips the Windows-only junction case.
This accepts the committed task/log action source. The subsequent actual
generated-list retention template is independently under verification.
### Actual generated-page list retention: final local phase
The real React Page.tsx.vm now retains completed generated lists through the host
read ticket; interrupted/changed-input/explicit-refresh reads still rerun.
The original installed CRUD checkbox reset was reproduced before repair. Final
current-template StrictMode/default/enabled profiles each pass all seven actual
compiled CRUD/tree/sub/automatic/String-key pages:exact request abort, genuine200
retry, retained selection/draft and zero completed-list reloads. Original
CRUD/controls/uploads/XLSX/precision/tree/sub/SQL/grant/logout/audit checks pass.
619 Maven cases are declared,618 applicable cases execute locally with only the
Windows symlink privilege skip; actual Windows junction protection passes.
Frontend reproducibility/lint/typecheck/98 units/build/all89 mocked pass.
32374 ended0 with both complete API profiles; framework live contracts match
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
50996 ended0 with both final StrictMode generated deployments; their additional
fixture API contracts independently match1B92C88E2974AAF19BA152C4D97847802BA7DFCBAC716771EAF1CBA9022CB0C0.
See security-review-generated-cached-reads.md. Exact cloud is pending.
Generated upload/editor/actions and other resource/monitor/embedded lifecycle,
sidebar/topnav/settings and final active capability audit remain open. The
specific Quartz runtime denial remains unchanged; form builder stays deferred.
### Generated reads accepted; raw uploads locally verified
Exact c3a77832eaf322c0ba9044c769f62b88e8bf6d7d server37568415792 all three
and web37568415642 are SUCCESS. Direct logs prove both53 framework browsers,
both seven StrictMode generated pages, complete API and exact contract gates,
98 units/89 mocked and complementary Windows-junction/Linux-symlink protection.
Raw image/file upload hide cancellation was separately reproduced with the
actual browser adapter; Save unlocked while the upload field remained busy.
The template now retains sent uploads and releases their own count/controller
on actual settlement. Both seven-page profiles pass eight gated real upload
checks each, including child files:history return preserves the form lock,
exactly one POST completes, and saved paths/served contents are verified.
Maven619 declared/618 locally applicable,10 scope, frontend reproducibility/
lint/typecheck/98 units/build pass. See security-review-generated-cached-uploads.md.
This new upload source still requires exact cloud acceptance. Rich-text/editor/
other actions, remaining shared lifecycle, sidebar/topnav/settings and final
active audit remain open; form builder is deferred and Quartz denial unchanged.
### Generated raw upload exact cloud acceptance
Exact d492318a1424f2cd93d3e547b5f2f9f1ea4187ec server37570013535 all three
jobs and web37570013470 are terminal SUCCESS. Direct accepted logs prove both53
framework browsers, complete APIs and contract gates, both seven generated pages
with eight real raw-upload history checks each,98 units/89 mocked browsers and
complementary platform filesystem cases. This accepts only the committed raw
upload source. Subsequent rich-text owner/content/cursor changes remain under
independent genuine browser and full-environment verification.
### Shared rich-text upload, retained content and cursor: final local phase
Sent rich uploads now retain independent request ownership across Activity hide;
hidden results queue only inside their original editor instance. Counted notice
upload ownership prevents older settlement from unlocking a newer upload. Local
emitted HTML/received parent value/cursor survive StrictMode reconstruction;
real [3,10,4] image order failure was repaired to [4,3,10] without weakening SVG
checks. Existing formats, paste/video sanitization, readonly and backfill remain.
Final authority1488 ended0:actual notice/all APIs, both seven generated categories
with11 held upload writes each, both53 full framework browsers and full APIs.
619 Maven declared/618 locally applicable/10 scope, client reproduction/lint/
types/98 units/build/all91 mocked pass. Cache confirmation500ms test race uses
response ownership instead, with original busy/Escape/error/clear checks retained.
Both framework and generated contract scopes match their own exact hashes.
See security-review-rich-text-cached-uploads.md. Exact2bf7c2d server37574541663 all three jobs and web37574541644 are terminal SUCCESS; direct accepted logs prove both53 framework profiles/full APIs/OpenAPI and both seven installed generated categories,91 mocked and98 units.
Remaining editor/actions and resource/monitor/embedded cache behavior, nested-rich
final audit, sidebar/topnav/settings and final active audit stay open. Form builder
is deferred; the specific Quartz runtime denial remains unchanged.
### Cache entries and online sessions: retained reads locally accepted
Completed cache names/keys/value and online list/filter draft now survive actual
cached tab return without new GETs. Interrupted reads cancel and retry; explicit
refresh/search still reaches real Redis. Two actual mocked cases failed before
and passed after. Final reproducibility/lint/types/98 units/build/all93 mocked,
focused9 genuine browsers plus complete API, default/enabled profiles each55
browsers plus complete API passed; authority90787 ended0. All live OpenAPI hashes
match the contract. StrictMode's interrupted replay is checked as genuine aborts
with exactly one successful resumed response, not a fixed attempt count. The
filtered Windows verification launcher now passes regex to native Node CLI.
See security-review-monitor-cached-reads.md. Exact new-source cloud remains
pending. No new clear/revoke write lifecycle acceptance, backend/runtime changes,
form-builder completion or full-goal completion is claimed. Server/cache stats,
embedded console lifecycle, other editor/actions, nested rich-image audit,
sidebar/topnav/settings and remaining active final audits stay open.
### Cache entries and online-session exact cloud acceptance
Exact947f70681587d0c518ebd6506ffcb96a51b0f765 server37577784305 all three
jobs and web37577784304 are terminal SUCCESS. Direct accepted logs prove both55
framework browsers and complete API/OpenAPI,619 backend declarations/10 scope,
98 units/93 mocked, and complementary filesystem platform gates. This accepts
only the committed cache-list/online-read source. Subsequent server/cache-statistics
retention source has independent actual before/after and genuine-browser gates;
its complete profiles and exact cloud are still pending. Full active goal remains
open, form builder deferred and the specific Quartz runtime denial unchanged.
### Server and Redis statistics retained reads: final local verification
Two actual App/StrictMode tab-return cases failed before this product source and
pass after. Completed OSHI samples/Redis counters and graphs now survive cached
return without a GET; interrupted sampling really aborts and resumes with one
genuine200, while explicit refresh samples again. Original graph keyboard/resize,
units, thresholds, safe text, failures/denial/retry and permissions remain intact.
All17 scoped mocked cases and repro/lint/types/98 units/build/all95 mocked pass.
Final authority72134 ended0:focused9 genuine cases/full API and both default/
enabled profiles each57 genuine browsers/full API pass. Contract hashes are
exact. The initial real server case used a page title as its SQL menu tag label;
only that evidenced test locator was corrected, with no assertion or timeout
relaxation. See security-review-statistics-cached-reads.md. New exact cloud remains
pending. Embedded console lifecycle, other editor/actions, nested rich-image audit,
sidebar/topnav/settings and active final audits remain. Form builder is deferred
and the specifically rejected Quartz runtime scheme unchanged. Goal not complete.
### Exact source cloud acceptance — f583a38
Server 37580421117 all three jobs and web 37580420897 are terminal SUCCESS
for f583a38e7cd9d764c9480a83badcb75539ada884. Direct
statistics-cached-reads-cloud-accepted-server/web.log confirms both profiles of
57 actual framework browsers and complete runtime API regressions, exact live
OpenAPI checks, 98 unit and 95 mocked browsers, and backend 619 declarations
including all 10 data-scope cases with one platform-specific skip. The unique
observer49937 is terminal0. This accepts the statistics-read phase only;
embedded consoles and the remaining active capability audit are unfinished.
### Embedded console cached ownership: final local acceptance
Valid Druid and Swagger native documents retain their state and exact scoped/native
cookies on cached return, without ticket POST or native reload. Current JWT grants
and a cookie-only fixed-entry probe complete before retained HTML is revealed.
Hidden absolute expiry, lost scoped ticket with valid main JWT, actual role
withdrawal and late native load require the appropriate discard/explicit retry.
Five before-failure scenarios and12 scoped/102 full fixture browsers,98 units,
client reproducibility/lint/types/build and final two profiles of57 genuine
framework browsers/fullAPI pass. Authority66413 is terminal0 and both live
contracts exactly match65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
See security-review-console-cached-session.md and console-cached-native-owned-*
logs. New exact source cloud is pending; unchanged Java/old f583 cloud cannot
substitute for it. Full active goal is incomplete: other shared lifecycles,
nested rich-image audit, sidebar/topnav/settings and dates/timezones/XLSX/final
capability audits remain; form builder is deferred and the specific Quartz
runtime proposal remains unapproved.

Exact console-source acceptance (2026-10-07):431b56fb2cec333416edbd50557f4cba4c493618
has server37586911642 all three jobs SUCCESS and web37586911636 SUCCESS.
Direct console-cached-native-cloud-accepted-server/web.log proves both57 real
browsers with full MySQL/Redis APIs and unchanged live OpenAPI,619 backend test
declarations including10 data-scope cases (one platform-specific skip),98 unit
and102 mocked browser tests. The earlier pending status above is superseded.
Observer93462 exited1 while authoritative jobs succeeded; that observation exit
is not a product failure. No new source or test rerun was needed for acceptance.
This accepts scoped native console ownership only; sidebar/layout and the full
active parity audit remain unfinished. Form builder remains deferred.
Sidebar GROUP disclosure implemented (2026-10-07), final acceptance pending:
native keyboard buttons, per-level unique opened groups, route ancestry,
retained dashboard return, safe static icons and actual ROUTE parent child toggle.
Frontend lint/typecheck/reproducible client/98 units/build and105 mocked browsers
pass. Initial real run55 passed, two old page-tabs fixture entry steps failed;
conditional system-GROUP disclosure now preserves original strict assertions.
Final sequential owned authority80422 is active; real and exact-source cloud
acceptance must still finish. See security-review-sidebar-disclosure.md.
Desktop collapse/mobile drawer and remaining layout modes/settings are not
completed by this change. Full active parity remains unfinished.