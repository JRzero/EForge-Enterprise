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