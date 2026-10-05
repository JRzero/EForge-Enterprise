# EForge Enterprise Roadmap

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