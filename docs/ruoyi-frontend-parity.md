# RuoYi frontend capability parity

The active objective is **all original frontend capabilities except explicitly deferred scope**, with strict
function-by-function verification. A working shell or a green subset of tests
does not prove this objective complete. The architecture baselines in AGENTS.md
remain unchanged.

## Current scope adjustment (2026-10-06)

The user explicitly deferred the online form builder. Do not develop or require it for current acceptance. Preserve its original behavior inventory for future work; deferred does not mean implemented or verified. All other capability requirements remain active.

## Immutable behavior reference

The pinned Spring Boot 3 backend commit has already separated its frontend
repositories. For an inspectable reference of the same RuoYi version, inventory
the official v3.9.2 frontend at
`yangzongzhuan/RuoYi-Vue@0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0`.
This remains the immutable **behavior reference**; the Vue application is not
imported. ADR-0014 explicitly reuses its attributed static SVG icon bundle.
The pinned backend commit is unchanged. The backend's actual controllers,
services and security behavior remain authoritative for supported operations.
The reference contains capabilities absent from the initial Phase 2 shell.

`ruoyi-frontend-parity.json` records every non-asset frontend source path and
exported API operation in that reference. Direct downloads/uploads and component
behavior must also be covered; an API function inventory alone is insufficient.
It is a work inventory, not executable proof of completion.

## Required capability groups

| Group | Required behaviors | Current evidence/state |
| --- | --- | --- |
| Login/account lifecycle | captcha, failed login, remember-account/credential UX, configurable registration, logout, lock/unlock, session expiry, initial/expired password change | Exact-cloud accepted through22f8895: registration, reminders, remembered credentials, native screen lock/current SQL password, CAPTCHA/login/logout/expiry. See current-scope-acceptance.md. |
| Application shell | route and button permissions, hierarchical menus, breadcrumbs, header search, tab open/close/refresh/pin/context menu, sidebar collapse, top navigation, embedded/external routes, responsive layout, theme/density settings, notice badge | Typed navigation, retained tabs/resource actions, sidebar/mobile modes, mixed navigation, settings, fullscreen, header avatar and notices have exact-stage cloud acceptance; full capability audit remains open |
| Dashboard | original landing/workbench behavior and chart/dashboard variants with responsive rendering | Workbench and original four metric/line/radar/rose/stacked-bar variant accepted in exact9ad0cb5 cloud, both61 real profiles; demonstration data is labelled; final cross-capability audit remains open |
| Profile | view/update account information, password change, avatar upload/crop, roles/posts/department display | Verified API and React/crop page, no-grant real browser flow, bitmap equality, keyboard/mobile and implementation CI; see evidence below |
| Users | department tree, filtering/date range, pagination, column controls, selection, create/edit/delete/bulk delete, status confirmation, password reset, role assignment, XLSX export, template/download/import with optional updates, account uniqueness and data scope | Administration/import and exact Long/BigInteger XLSX boundaries accepted through22f8895, with actual filtered workbook/persistence and calendar checks. See current-scope-acceptance.md. |
| Roles | filtering, CRUD, status, menu/button grants with parent/child selection, data-scope modes and department selection, allocated/unallocated users and batch assignment/cancellation, export | Administration/allocation/scope and exact Long XLSX accepted through22f8895; actual withdrawal, dates and workbook data preserved. |
| Departments | hierarchical CRUD, hide/expand rows, parent selection excluding descendants, sort updates, deletion protection, data-scope enforcement | Verified; controller/security tests, real hierarchy/data-scope fixture and live browser tree/CRUD/sort tests; implementation CI passed (see evidence below) |
| Posts | filters, pagination, columns, selection, create/edit/delete/bulk delete, uniqueness, assigned-user deletion protection, export | Implemented; Maven controller/security tests, live browser CRUD/paging/download tests and disposable database checks; see evidence below |
| Navigation/menu administration | tree CRUD, GROUP/ROUTE/EXTERNAL/function identities, permission and icon selection, parent selection, visibility/status/sort, route binding validation, role menu tree | Original icons, stable identities, scoped parents, whole-tree sort and query/cache shell projection are accepted; live menus/navigation-tools/page-tabs rerun in22f8895. |
| Dictionaries | type and data CRUD, type options, detail navigation, filters/pagination, sort/default/status/style tags, cache refresh, exports | Full type/data CRUD, compatible keys/style/labels, cache refresh, paging/whole preview/XLSX and interrupted owned actions accepted; current live dictionaries rerun in22f8895. |
| Configuration | filters/CRUD, built-in entry protection, typed key lookup, cache refresh, export | Page/API/persistence/rename/built-in protection/cache, dates/paging/bulk/XLSX and retry accepted; current live configurations rerun in22f8895. |
| Notices | rich text, type/status/CRUD, pagination/filtering, top notice feed, unread/read/all-read behavior | Administration/top five/readers, actor-isolated unread/read/all-read, actual PNG/JPG/static SVG and retained inert rich content accepted; current live notices rerun in22f8895. |
| Operation logs | filters/date range/pagination, operator/time/cost sorting, detail request/response/status with JSON formatting/copy, selection/delete/clear/export | Canonical API/client and React page verified locally and in exact-head CI, including actual audit payload/clipboard/XLSX/last-page deletion; final capability audit pending |
| Login logs | filters/date range/pagination, username/time sorting, failure/success details, unlock locked login account, selection/delete/clear/export | Canonical API/client and React page verified locally and in exact-head CI, including actual password lock/unlock, session preservation and deletion; final capability audit pending |
| Online sessions | username/IP filters, active session list, force logout with real Redis revocation | Canonical API/client and React page verified locally and in exact-head CI, including twelve-session paging, scoped/self force logout and isolation; final capability audit pending |
| Scheduled jobs | filters/CRUD, invocation validation, enable/disable, run once, details, cron expression editor, logs/filter/detail/delete/clear/export | Partial: canonical task reads/log API and actual Quartz preview, read/detail/export and original log pages verified locally and in exact-head CI; Cron editor verified locally and in exact-head CI; task mutations/create-edit integration and full consistency remain pending |
| Server monitoring | CPU/memory/JVM/disk/host data, loading/error states and refresh | Canonical API/client and React page passed local and exact-head CI; original fields/thresholds, safe text, refresh/retry/abort, navigation and no-role denial verified; final capability audit pending |
| Cache monitoring | Redis info/command statistics, names/keys/value lookup, per-key/per-name/all clear with confirmations and permissions | Canonical API/client and both React pages passed complete local regression and exact-head CI, including rose/gauge charts, mobile/keyboard, scoped/global clearing, SQL retention and actual session invalidation; final capability audit pending |
| Connection pool/API consoles | authenticated Druid and API documentation entry and errors; disabled console behavior; never anonymous production access | Canonical API/client and both embedded React pages pass local and exact-head CI enabled/default-disabled runtime and browser acceptance, including original login/SQL/JSON windows, Swagger authorization/Try it out, logout/revocation, no-store and failure recovery; final capability audit pending |
| Code generator | DB tables search/import/create, metadata editing, field/query/form/list configuration, tree/main-subtable modes, sync, preview, delete, download and custom output, generated API/routes/pages and reproducible validation | All original management API operations, React/EForge output/host/manager, guarded custom output and generated CRUD/tree/sub controls/auto/String keys accepted. Explicit UTC/Shanghai/NewYork instant/refill/edit/DST and exact workbook values accepted in22f8895. See current-scope-acceptance.md. |
| Online form builder | drag/reorder/configure fields and layouts, field-specific controls, preview, code-type choice, generated code/download/copy, tree/icon configuration | Deferred by user on 2026-10-06; excluded from current development and acceptance; original inventory retained, not implemented |
| Shared controls | dictionary tags, paging, reset/date ranges, toolbar column/search toggle, image/file upload and preview, rich editor, icon picker, cron editor, keyboard/focus and empty/loading/error/retry states | Named actual dictionary/paging/reset/date/toolbar/upload/preview/rich/icon/Cron/focus/retry uses accepted. Original registered dialog drag/width/corner resizing newly implemented; separate aggregate and precise cloud acceptance pending. |

## Per-feature acceptance gates

For every operation, preserve filters, pagination/sorting, selection/bulk actions,
field validation, success/error behavior, cancel/confirm behavior and existing
authorization/data-scope semantics. New app endpoints must be canonical concrete
DTOs/HTTP statuses/ProblemDetail with generated clients. Keep compatibility
boundaries explicit and never import database-provided component names.

Require actual browser tests with a disposable MySQL/Redis backend for reads and
mutations, and targeted permission, denied-user, cross-department, duplicate,
missing-resource, invalid-input and failure/retry tests. Download/upload tests
must inspect the file contents and server persistence, not just button visibility.
Session/permission mutations must prove the real protected endpoint/session
outcome. Data-scope parity cases stay green.

Every implemented feature must provide an evidence entry identifying its exact
tests and last passing command/run. Source existence, a menu row, a mocked CRUD
test, one happy-path screenshot, or a status label alone cannot mark it complete.
Full completion additionally requires all inventory groups and operations mapped,
frontend lint/typecheck/test/build, live contract/client reproducibility, seeded
route validation, full runtime/E2E suites, and CI at the current pushed commit.

Posts, departments, users/profile, roles/allocation and menu administration have
verified implementation checkpoints below. The next slice covers dictionary
types/data, filtered paging, type detail preview, batch deletion, XLSX export,
cache refresh and shared dictionary tags. It must verify rename/old-key cache
invalidation, child-data deletion guards and existing pages after label/style
changes. All remaining groups stay in scope.

## Posts verification evidence (2026-10-04)

- `PostControllerTest`: production security filters and method permissions;
  concrete DTOs and large string identifiers; invalid paging/bodies/identifiers;
  creation Location; duplicate and concurrent persistence errors; batch missing
  member/assigned-user protection; all six operation permissions.
- `server/scripts/verify-posts-integration.ps1`, called by the disposable runtime
  fixture: actual CRUD persistence, remark clearing, filtering/paging, sequential
  duplicates, eight concurrent duplicate creates (one 201, seven 409), missing
  rows, assigned posts, batch all-or-nothing prevalidation and workbook contents.
- `web/tests/live/posts.spec.ts`: actual browser validation/create/duplicate/edit,
  state after reload, filters/show-hide, column controls, XLSX ZIP/XML inspection,
  cancel/confirm, assigned-post errors, page boundaries/page size and 12-row delete.
- `web/tests/e2e/posts.spec.ts`: failure/retry, read-only operation controls,
  exact string IDs and mobile viewport overflow check. These fixtures supplement
  the real database tests; they do not replace them.
- Runtime integration separately denies every post operation for an ordinary
  account after its role grants are reduced. Data-scope parity tests stay green.

Validation commands are Maven `verify`, all web lint/typecheck/unit/build/client
checks, fixture browser tests and `verify-auth-integration.ps1 -VerifyWeb`.
Implementation commit `9bc400d8d46fef1e0d184dd6752d0370061bb465` passed both [server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37181473129) and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37181473141). The server suite contains 53 tests, the web unit suite 13 tests, and the fixture/live browser suites 10 tests in total. Documentation-only evidence updates do not change the verified runtime.
Posts now use only generated canonical API functions; legacy service entities and
Excel annotations remain behind the server facade. V003 binds the actual React
route; V004 adds database code/name uniqueness. A database with existing duplicate
posts must resolve them before V004 can run; migration never silently deletes data.

## Departments verification evidence (2026-10-04)

- `DepartmentControllerTest`: production permissions, validation, scoped parent
  checks, descendant exclusion, self/descendant cycles, unchanged-parent behavior,
  active-child/delete protection, distinct sort IDs and complete batch prechecks.
- `verify-departments-integration.ps1`: actual hierarchy CRUD, generated identities,
  descendant ancestor-chain persistence, parent name uniqueness, sort persistence,
  soft-deleted 404s, disabled-parent creation and implicit ancestor enable behavior.
  Root deletion, concurrent mutual reparenting, eight duplicate creates and repeated
  name reuse after soft-delete are verified with the actual row lock and unique index.
  An independent account/department-only role proves real allowed and denied
  operations and that a denied mixed-scope sort changes no rows.
- `web/tests/live/departments.spec.ts`: actual tree expand/collapse, forms, duplicate
  error/recovery, searchable parent options excluding descendants, reparenting,
  cleared contact persistence after reload, inline ordering, filters/show-hide,
  cancel/confirm and protected deletion. Existing login and posts suites also pass.
  Same-name parent choices show their permitted ancestor paths so branches remain
  distinguishable when searched.
- `web/tests/unit/department-tree.test.ts`: scoped roots, exact large IDs, hidden
  descendant behavior and cycle termination. Fixture browser tests cover read-only
  actions, network retry and mobile overflow.

See [the explicit security review](security-review-departments-v1.md). The
data-scope algorithm remains unchanged and all ten parity cases remain required.
Implementation commit `a0ef1f2141e9b09f5c6f38e923835ec2d690f091` passed both
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37183617317)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37183617309).
Validation includes 67 backend tests (all ten data-scope parity cases), 18 frontend
unit tests, seven fixture browser cases and five real-backend browser cases,
lint/typecheck/build, seeded routes and live OpenAPI/client reproducibility.
All other frontend capability groups stay in scope.
V006 requires existing active sibling-name duplicates to be resolved before
migration; it never removes data and permits duplicate names on deleted rows.

## Historical user administration core API checkpoint (2026-10-04)

The canonical user facade implements scoped list/date/department filters and
paging, editor options/details, creation, profile editing, batch deletion,
status, password reset, role allocation and XLSX export. The generated client
and authenticated integration wrappers are available. The administrator's
optional department can be cleared; ordinary accounts cannot bypass department
scope with an absent identifier. Disabled existing associations can be retained
while new disabled assignments are rejected.

`UserControllerTest` covers 23 targeted cases with production permission filters.
`verify-users-integration.ps1` verifies actual MySQL associations and cleared
fields, BCrypt login/reset behavior, disabled-user Redis invalidation, filtered
XLSX cells, scoped denial and permission revocation. Raw SQL duplicate inserts
prove all three V007 unique indexes work even without service prechecks; eight
concurrent API creates yield one creation and seven safe conflicts. Soft-deleted
names can be reused repeatedly.

Local Maven verification passes 90 tests including all ten data-scope parity
cases. Frontend lint/typecheck/18 unit tests/build/generated-client check and
seven fixture/five real-backend existing browser cases pass. These browser cases
regress login, posts and departments; they do not prove a user page that has not
yet been implemented. Implementation commit
`fb8d9a0718f51e86fe7abdf2b33b3808a1c6c6e1` passed both
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37184809973)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37184809879).

At that core-only checkpoint, the page and import were pending. See the newer
administration evidence below; personal profile remains incomplete.

## User administration page and import checkpoint (2026-10-04)

The lazy EForge user route now includes scoped department search/expand/collapse,
filters/date ranges, paging/columns, localized select-all/mixed/clear selection,
create/edit, single/batch delete, status confirmation, password reset, role/post
allocation and filtered XLSX download. Read-only permission controls, retry,
large IDs, dialog cancellation and mobile overflow are verified independently.

Canonical multipart XLS/XLSX import and template download retain the original
Excel annotations. Each row commits independently with typed success/failure
results. Overwrite is opt-in, retains existing password/department/role/post
associations, and checks target scope before disclosing account collisions.
New imported users receive the configured BCrypt password and no implicit grants.
The page safely renders partial results and supports file selection/drag-drop.

Evidence: 101 backend tests including all ten data-scope parity cases; 20 frontend
unit tests; lint/typecheck/build/generated-client reproducibility; eight fixture
browser cases; eleven real MySQL/Redis browser cases. Six user browser cases
cover CRUD and persisted associations, full/mixed selection and pagination,
XLSX partial failures and overwrite, actual legacy XLS login, 220-row drag/drop,
and a real committed import response delayed beyond the ordinary request deadline.
The runtime script separately verifies import scope denial, permission revocation,
admin protection, uniqueness, authentication and existing module regressions.
Implementation commit `7c0b3cd439ba7a063adc458f183bdf51f130ab35` passed
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37187426882)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37187426873).
All three server jobs passed, including Linux live browser/runtime verification
and exact exported OpenAPI snapshot comparison.

Personal profile, self password change, avatar upload/crop, dictionary integration
and every other missing capability group remain in scope. This checkpoint does
not assert full user or full frontend parity.

## Self-service profile API checkpoint (2026-10-04)

Canonical authenticated `/api/v1/me` reads/updates the current user's profile,
changes the password with old-password verification, and uploads a decoded,
bounded raster avatar normalized to PNG. Concrete generated clients isolate
legacy service entities. Self-service does not require management grants.
Mutations commit before updating Redis; department/role/post associations are
preserved. Avatar rollback/replacement only removes owned canonical UUID paths.

Twenty-two targeted tests supplement the administration baseline, giving
123 backend tests including all ten data-scope cases. Runtime verification
covers real contact conflicts, database and Redis persistence, old/new
credentials, served PNG bytes, previous-file cleanup and inactive-session denial.
See [the explicit profile security review](security-review-profile-v1.md).

At that API-only checkpoint the React forms and crop controls were pending.
The newer page evidence below supersedes that limitation.
Implementation commit `f319bd7c5c83e47bd122c0bc52bada5dfd20baad` passed
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37188564966)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37188564916).
All three server jobs passed, including concurrent password checks, real PNG
replacement/404 verification, credential audit inspection and exact live OpenAPI
snapshot comparison. The full objective stays active.

## Personal-center page verification checkpoint (2026-10-04)

The authenticated internal `/user/profile` route and header entry implement
account/department/role/post/date display, validated self-profile editing,
password confirmation and visibility, old/unchanged password errors, close,
loading/retry and mobile layout. Bootstrap refresh preserves the mounted page
and prevents an obsolete response from restoring a logged-out session.
Avatar selection, actual decode, square crop, pointer/keyboard pan, zoom,
quarter-turn rotations, preview, reset, cancel and 200-pixel PNG upload are local
to the feature. ADR-0011 documents the internal route/seed distinction.

Local validation: lint, typecheck,
23 unit tests, build, nine fixture browser cases. The complete disposable runtime
then passed twelve live browser cases and all database/Redis integration scripts.
The new profile case uses an actual account with no management grants and checks
profile persistence, unchanged associations, wrong/unchanged/new passwords,
old/new login, actual pointer drag, rotated/cropped output dimensions and the
entire bitmap hash matching the preview, reload, cancel,
replacement HTTP 404, close/reopen and logout. The generated-upload directory is
unique per run and is removed within a checked path in fixture cleanup.

Keyboard tab switching/focus, mobile profile overflow and crop-window bounds
passed after quota recovered. Bootstrap refresh also has a targeted stale-session
test. The live runtime and all existing module regressions passed on the final
page version. Implementation commit `dbd131dd8ab9f89b5dae39e89ba2bb61d76c216c`
passed [server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37196064193)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37196064167).
All three server jobs passed. Other missing groups and shared dictionary-driven
controls remain in scope; full parity is not complete.

## Role API/client verification checkpoint (2026-10-04)

Fifteen canonical operations cover scoped filtered/date-ranged role pages,
options, menu/departments, concrete detail/raw/checked keys, creation, edit,
status, all five data-scope modes, batch deletion, allocated/unallocated users,
idempotent batch assignment/cancellation and real XLSX export. The original
services remain behind the facade; no React route is seeded before its page
exists. V009 enforces active name/key uniqueness and deleted-identity reuse.
See [the role security review](security-review-roles-v1.md) for additive object
guards, bounded new menu grants and separate MySQL/Redis consistency limits.

`RoleControllerTest` adds 18 security/contract cases and
`RoleSessionRefresherTest` adds seven cache/expiry cases. All 148 backend tests
pass, including ten unchanged data-scope parity cases. Final local runtime
verification passes `verify-roles-integration.ps1` and every earlier module's
database/Redis verification. Scope tests use accounts in department 101, its
child 105 and an unrelated branch 108 to distinguish all five actual outcomes.
Existing-session assignment, menu removal and status changes are checked through
protected endpoints without an intervening bootstrap. Mixed-scope/admin batches
do not write associations, and eight duplicate creates yield one 201/seven 409.
Workbook XML, real unique indexes, soft deletion/reuse and safe projections pass.

The stable frontend also passes lint/typecheck, 23 unit tests, build, nine fixture
browser cases and twelve live browser cases. The final live OpenAPI snapshot
matches the contract exactly and generated clients are reproducible. Implementation
commit `fc4d90670db58c413bb8f8f71a5a025ff4792ce5` passed
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37198292747)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37198292813).
All three server jobs passed, including full live browser/role integration and
exact live OpenAPI comparison. At that API-only checkpoint React role forms,
linked tree controls, scope dialog and user-allocation browser tests were pending.
The following page checkpoint supersedes that limitation; the full objective
remains active.

## Role administration and allocation page checkpoint (2026-10-04)

The lazy `/role` page implements filters/date ranges, paging, columns, selection,
CRUD, confirmed status changes/deletion, actual XLSX export and all five scope
forms. Menu/button and department trees support linked/independent selections,
half-checked parents, expand/collapse, select/clear all and keyboard navigation.
Unchanged selections and linking-flag-only edits preserve exact raw associations,
including parent-only menus/departments and button-only grants. Existing grants
outside the operator's available menu tree remain visible and removable.

ADR-0012 documents the individually authorized `/role/users/:roleId` route.
Its allocated/unallocated user tables implement filtering, paging, single/batch
cancellation and batch assignment. IDs remain exact decimal strings, and role
changes reset local state. The server enforces every object and operation guard.
Twelve actual accounts verify another existing session's immediate permission
denial/allowance after assignment, status changes and cancellation.

The feature fixtures cover read-only guards, exact large IDs, deep links, invalid
IDs, load/save retry, keyboard selection, unknown grants and mobile bounds.
A saved mutation followed by a failed bootstrap explicitly reports the saved
outcome and retries only the refresh. The live suite covers real persistence,
raw-association preservation, duplicate identities, paging/bulk deletion,
status confirmations, all scope forms and inspected XLSX workbook contents.

Shared dictionary-driven status tags remain pending. This checkpoint does not
assert full frontend parity.

Final local validation passed Maven verification (148 backend tests, including
ten data-scope cases), frontend lint/typecheck, 30 unit tests, build and twelve
fixture browser cases. The complete disposable MySQL/Redis runtime passed all
fifteen live browser cases and all module integration scripts, including route
seed contracts, login, `/getInfo`, Redis TTL/session state and captcha replay.
The live OpenAPI snapshot is unchanged and the generated client is reproducible.
Implementation `bab6b2e13e63ba1423699fad2ba8139b86bdc1d9` passed
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37201269908)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37201269883).
All three server jobs passed, including Linux live browser/role integration and
exact live OpenAPI comparison. Shared dictionary controls and all other missing
groups remain in scope; the full objective is not complete.

## Menu API/client checkpoint (2026-10-04)

Eight concrete operations provide filtered flat menu reads, parent options,
registered route options, detail, create/edit/delete and atomic batch sorting.
GROUP/ROUTE/EXTERNAL/FUNCTION identities do not expose database components.
The boot artifact packages the same static navigation contract consumed by web;
route bindings require actual registered IDs and matching endpoint permissions.
Hidden/internal routes are excluded. Existing unbound legacy route rows can
remain pending rather than inventing React pages. Keys remain stable, and V011
enforces original sibling-name uniqueness in the database.

`MenuControllerTest` adds nineteen targeted contract/security cases and
`MenuRouteCatalogTest` checks packaging. All 168 backend tests passed, including
the unchanged ten data-scope cases. The disposable MySQL/Redis menu verifier
passed actual CRUD, Unicode and clearing, original database-collation filtering,
sort, parent/cycle/deletion/object guards, route/external safety, bounded new
permissions, real unique indexes and eight concurrent duplicate creates (one
201/seven 409). Existing-session query permission is revoked/replaced/restored
without an intervening bootstrap. Disabling a route preserves the original
independently active child-button permission semantics.

The stable web passes lint/typecheck, thirty unit tests, build and twelve fixture
browser cases. Fifteen live browser cases and every prior module integration
script passed; final filter changes additionally passed the complete API/runtime
suite. Generated clients reproduce and the live OpenAPI equals the snapshot.
See ADR-0013 and the menu security review for the canonical/legacy and
MySQL/Redis boundaries. Implementation `1cc8a539aa139e3f21bfa331f45ceadc1585d31f`
passed [server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37202983366)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37202983373).
All three server jobs passed, including Linux menu/API and live browser
integration and exact live OpenAPI equality on the final implementation.

At that API-only checkpoint the React page, parent/icon controls and browser
acceptance remained required. The next checkpoint implements the page before
seeding its navigation route. Query/cache shell behavior and other missing groups
remain required. The full frontend parity objective stays active.

## Menu administration page checkpoint (2026-10-04)

The lazy `/menu` page implements hierarchical filtering, individual/all-node
expand/collapse, tree CRUD, parent search/exclusion, stable identities, actual
registered route choices, external URLs, button permissions, status/visibility,
field clearing and whole-tree atomic sorting. V012 binds the implemented page.
Parent options exclude all descendants through ungranted intermediate parents;
the backend still validates every write. Batch sorting supports 2000 objects;
real browser verification persists 105 changed nodes in one request.

The complete 88-icon picker supports search, select/clear, keyboard navigation,
Escape/focus return and mobile bounds. Browser checks decode and draw every
normalized asset. ADR-0014 records the immutable attributed SVG bundle, original
MIT license, source/output hashes and normalization. Unknown legacy icon names
remain retainable with a neutral preview.

Fixture tests cover large IDs, scoped/filtered roots, unavailable current parents,
safe external URLs, read-only controls, list/write/sort retry and committed-write
bootstrap failure with refresh-only retry. Live tests cover actual CRUD and
duplicate errors, reparenting, field clearing, assigned/parent deletion guards,
105-row persistence, route metadata and another existing session's immediate
permission revoke/restore without bootstrap. A scoped editor cannot acquire an
unowned permission or select descendants through an ungranted parent.

Local verification passed 170 backend tests including all ten unchanged
data-scope cases; lint/typecheck, 35 unit tests, build, fifteen fixture and eighteen
live browser cases. All disposable MySQL/Redis module integration scripts passed,
including initialization, login, `/getInfo`, session TTL, captcha replay and seeded
routes. Exact live OpenAPI equality and generated-client reproducibility passed.
Final implementation `146915f96d7713539103cfd0349fb8525d8688ea` passed all
three [server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37206236360)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37206236366),
including Linux live browser/module regressions and exact exported OpenAPI equality.
Pinned SVG hashes also survive Windows CRLF checkout settings; `.gitattributes`
fixes their bytes and attribute changes trigger both verification workflows.
Shared dictionary tags, full shell icon/query/cache behavior and all other
missing groups remain in scope.

## Dictionary API/client checkpoint (2026-10-04)

Fifteen canonical operations implement type/data paging, detail, create/update,
atomic batch deletion, authenticated type options and consumer lookup, filtered
XLSX exports and Redis cache refresh. Type filtering preserves name/code/status
and inclusive dates; data order is sort then exact ID. Type rename cascades entry
references and invalidates old/new keys. Child-bearing type deletion is rejected.
Every batch target is checked before any write. V013 enforces real type-code
uniqueness; duplicate entry values and multiple defaults remain permitted.

Consumer reads preserve original login-only access and disabled-type/active-entry
behavior. They expose presentation fields and use current committed DB values
under the canonical mutex rather than trusting potentially stale compatibility
cache values. Styles are typed and CSS fields remain plain class tokens.
Redis invalidation failure rolls back canonical database writes. Cache refresh
can be retried after a partial cache failure; unchanged legacy concurrency
limitations are explicit in the dictionary security review.

Local verification passed 188 backend tests including eighteen dictionary cases
and all ten unchanged data-scope cases. The disposable integration proves Unicode,
filters/paging, defaults/duplicate values, clearing, rename/cache invalidation,
empty-type refresh, filtered XLSX, actual unique indexes and eight concurrent
creates (one 201/seven 409). A real disposable Redis ACL fault proves HTTP 503
and rollback of both actual MySQL type rename and entry reference updates.

Frontend lint/typecheck, 37 unit tests, build, fifteen fixture and eighteen live
browser regressions passed. Generated dictionary transport preserves large IDs,
filters, repeated values and binary exports; cache failure supports session-safe
retry and 401 clears it. All module runtime scripts, login, `/getInfo`, Redis
session/TTL, route seeds, exact live OpenAPI equality and generated reproducibility
passed. Implementation `8d8cea038a1a7ecbd2269af9a055b6157bb9e231` passed all
three [server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37214558469)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37214558391).
Linux verification includes the actual Redis ACL fault/MySQL rollback, all module
scripts and eighteen live browser regressions, and exact exported OpenAPI equality.
React dictionary type/data pages, preview, shared labels and their own browser
acceptance remain required. The full frontend objective stays active.

## Dictionary UI implementation checkpoint (2026-10-05)

Lazy type/data pages now expose filtering, dates, paging, selection, column
visibility, CRUD, exports and cache refresh. The public dictionary route is
bound by V014; data detail is a static internal route requiring dict:list.
Metadata loads independently with cancellation and retry. Preview loads every
100-row page and rejects total drift, duplicate IDs and incomplete intermediate
pages. The shared tag component preserves option order, duplicate labels,
zero/false values, separator input, unknown-value visibility and escaped text.
Data labels use whole keys, including comma-containing values.

Local validation passed 188 backend tests including all ten data-scope cases,
lint/typecheck, 42 web unit tests, build, 18 fixture and 19 live browser tests.
The new live page test proves type/data CRUD, duplicate values/defaults, field
clearing, styled comma keys, type rename with existing data, filtered XLSX content
and child-bearing deletion protection. Fixtures additionally cover read-only
actions, exact large IDs, 205-row preview, deep-link refresh, mobile bounds,
invalid input and draft/cache failure recovery. All disposable module integration
scripts and production-default checks passed; live OpenAPI exactly matches the
committed contract and generated-client reproducibility passed.

This is partial page acceptance. Further live pagination/type switching, type
dates/bulk deletion/export, metadata and preview failure cases, and shared tags
in existing resource pages remain required. Implementation
`29bbe86e13bd86f6ebeeba4a9b779c5c77033188` passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37216715513)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37216715547).
All other missing capability groups retain their original scope.

## Shared dictionary and page acceptance checkpoint (2026-10-05)

Status tags and filter/editor choices now load canonical dictionaries in posts,
departments, roles/allocation, users and menus. Menu visibility and user/profile
sex controls also use dictionary labels. Lookup runs independently of list
loading, aborts on unmount and exposes retry. Existing select values remain
retainable as raw codes when an option disappears. No client cache hides later
dictionary edits. A real mutation/restoration test proves custom labels and CSS
styles reach all five management pages, their filters/editors and sex controls.

Real 12-type/105-entry tests cover date filtering, page boundaries, page size,
whole preview, type switching, columns, filtered type XLSX and batch deletion.
Deleting a last page now returns to the remaining last page. The fixture suite
found and fixed preview consistency errors being mislabeled as network failures;
a dedicated error retains the actual data-change explanation and retry action.
Metadata failure and independent shared-lookup failure/recovery are covered.

Local validation passes 188 backend tests, 42 web unit tests, lint/typecheck,
build, 20 fixture and 21 live browser cases. All disposable module scripts,
production-default checks, exact live OpenAPI and client reproducibility pass.
Implementation `72955cbb22ab2423c3cab2592ecbd31bd5e82dfa` passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37217867739)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37217867731).
Further live editor CSS/style/default/sort
boundaries, cache refresh UI, read-only dictionary grants and preview cancellation
remain in the dictionary acceptance audit. The full shell and other missing
groups remain required; this checkpoint does not complete the overall objective.

## Dictionary editor/cancellation boundary checkpoint (2026-10-05)

The real CRUD browser test now rejects negative sort input and persists the
maximum 32-bit sort value. Reopening the editor proves cleared CSS/remarks,
DEFAULT style and a disabled default flag survive a fresh detail request.
The type page's cache-refresh button completes against real MySQL/Redis.
An intercepted pending preview proves close aborts the active browser request
with ERR_ABORTED and leaves the list refreshable.

Lint/typecheck, 21 fixture and 21 live browser tests pass, along with every
disposable module integration script, including actual Redis fault/MySQL rollback.
Product and backend source are unchanged from the verified 72955cb checkpoint.
Read-only dictionary grants/internal-route denial and removed-option display
remain explicit final acceptance items. Configuration, notices, logs, monitoring,
jobs, generator/form builder and full shell capabilities are still required.

## Dictionary reader and value compatibility checkpoint (2026-10-05)

A real list-only role/account reads dictionary types/data and authenticated
consumer lookup, while backend detail and cache-refresh requests return 403.
Revoking its grant immediately denies the data endpoint with the same token;
direct navigation to the internal data route then renders the 403 state.
The temporary role/account are deleted after verification.

Removed options display the raw unmatched value, and editor selects preserve
their current code rather than switching to another value. Comparison with the
immutable original DictTag exposed a scalar coercion mismatch: numbers/booleans
use numeric comparison against string keys, while array members are stringified.
The implementation now preserves this distinction, including false versus key
0 and scalar 1 versus key 01. String keys still compare exactly.

Validation passed 188 backend tests, 42 web unit tests, lint/typecheck/build,
21 fixture and 22 live browser cases, all module runtime scripts, production
defaults, exact live OpenAPI equality and generated-client reproducibility.
Implementation 9ab0c58 passed all three server jobs and web CI:
[server](https://github.com/JRzero/EForge-Enterprise/actions/runs/37219352848),
[web](https://github.com/JRzero/EForge-Enterprise/actions/runs/37219352862). The preceding boundary
checkpoint 3c81b1f passed all three server jobs and web CI. The full frontend
objective remains active; parameter configuration is the next missing module.

## Parameter configuration API/client checkpoint (2026-10-05)

Eight typed canonical operations now cover list/detail, creation/update, atomic
batch deletion, login-only key lookup, XLSX export and cache refresh. Original
management permissions, editable builtin flags and builtin deletion protection
remain intact. V015 enforces actual database key uniqueness. Canonical writes
and compatibility policy reads share the root transaction mutex; current database
values replace stale configuration cache entries. Cache invalidation failure
returns 503 and rolls back key/value writes. Performance and legacy-writer limits
are explicit in the configuration security review.

Validation passed 209 backend tests (including 18 controller/permission cases,
three policy-reader cases and all ten unchanged data-scope cases), 44 frontend
unit tests, lint/typecheck/build and generated-client reproducibility. All 21
fixture and 22 live browser cases passed with the generated client in place.
The disposable runtime checks passed actual CRUD, inclusive dates/paging,
Unicode/slash/ampersand keys, clearing remarks, batch prevalidation, builtin
editability, XLSX contents, stale Redis reads, cache refresh and a real MySQL
unique-index violation. Eight competing creates yield one 201 and seven 409.
Redis DEL/UNLINK denial produces 503 and preserves actual database key/value
state. Ordinary users retain key lookup and receive 403 for every management
operation. Captcha is enabled through a canonical write before replay checks.
Every preceding module runtime check and production-default check passed.
The final actual OpenAPI snapshot matches the contract exactly.

Implementation 4a20617 passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37220985702)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37220985737).
The configuration React page, static route,
dictionary-driven builtin labels, filters/selection/dialog/export/cache UX and
their browser acceptance remain required. Notices, logs, monitoring, jobs,
generator/form builder and full shell capabilities also remain in the objective.

## Parameter configuration page checkpoint (2026-10-05)

The lazy EForge page binds `/config` to system-configurations through V016 and
the stable system-configuration menu key. Bootstrap now includes seven actual
system routes, and the backend packages the exact eight-route public catalog.
Unimplemented legacy menu compatibility checks use system-notices instead.

The page covers name/key/builtin/date filtering, reset/search visibility,
selection, single selected-row editing, create/update/delete/bulk deletion,
dictionary-driven sys_yes_no labels, column visibility, XLSX download and cache
refresh. Creation retains the original builtin Y default; edits preserve keys,
multiline values and clearable remarks. Failed writes retain drafts; cache
failures are retryable. List and detail requests cancel on unmount, exact string
IDs drive selection, and deleting the last page returns to the remaining page.
Exports use the applied filters rather than unsubmitted draft text.

Validation passed 209 backend tests, 44 unit tests, lint/typecheck/build,
24 fixture and 24 live browser cases, all disposable module runtime scripts,
production defaults, exact live OpenAPI equality and generated-client
reproducibility. New fixture coverage proves list-only access, raw escaped values,
large IDs, retry, mobile bounds, required/length validation, preserved conflicts,
selected edit, builtin labels/defaults, cache retry and applied export filters.
Real browser coverage proves CRUD, builtin rejection then editable removal,
Unicode rename/current lookup, remark clearing, XLSX contents, cache refresh,
dates, pagination, last-page recovery and batch selection/deletion.

Page implementation 728b119 passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37222124701)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37222124702).
The final module acceptance audit remains pending. The
full objective stays active; notices with rich text and per-user read state are
the next missing module, followed by the remaining logs/monitoring/jobs,
generator/form builder and complete shell/shared capabilities.

## Notice API/client checkpoint (2026-10-05)

Eight canonical operations now provide paging/detail/create/update/delete,
newest-five feed, session-owned batch read marking and paginated reader lists.
Original list/add/edit/remove permissions remain, and original authenticated
detail/feed/read behavior is preserved, including known-ID closed notices.
The feed counts unread items only among its five visible active notices.
Exact IDs, typed projections and concrete HTTP semantics replace legacy wrappers.
Rich HTML is preserved as data; content and remarks can be explicitly cleared.
Canonical deletion cleans notices/read rows in one transaction, and read batches
prevalidate every member before mutation. Typed reader persistence fixes the
actual database timestamp projection uncovered by the first runtime pass.

Verification passed 229 backend tests (including 20 notice cases and all ten
unchanged data-scope cases), 46 web unit tests, lint/typecheck/build, 24 fixture
and 24 live browser regressions, every module integration script, production
defaults, exact live OpenAPI equality and generated-client reproducibility.
Actual MySQL checks prove Unicode/rich HTML CRUD and clearing, filters/paging,
five-item order/status/unread behavior, idempotent per-user reads and compatibility
feed visibility, typed readers/search, and full batch guards. A fixture database
trigger fails notice deletion after read-row cleanup; HTTP 500 preserves both
actual notice and read records. Ordinary users can consume/mark their own notices
and receive 403 for every management operation and reader lists.

API implementation b3f2b00 passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37226906315)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37226906322).
At this historical checkpoint the notice page was not bound. The subsequent
rich-editor/security implementation b2fb9e6 passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37230909936)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37230909971).
Neither checkpoint alone establishes notice frontend parity. The full objective
and all remaining modules stay active.

## Notice page/image/read-state checkpoint (2026-10-05)

V017 binds the lazy `/notice` page to the existing `system-notices` route/menu
identity. Bootstrap now exposes eight system child routes and the public catalog
contains nine routes. Legacy pending-menu checks use `monitor-operation-logs`.
The page covers title/author/type filters, reset/search visibility, server paging,
column visibility, selection/single edit/bulk deletion, last-page recovery,
dictionary-driven type/status, required/length validation, drafts on failure,
clearable rich content/remarks, preview and searchable paginated readers.

The authenticated header independently loads the newest five active notices,
opens safe details, marks a session-owned item or all five, and displays unread
state only after server acknowledgment. Ordinary users need no management grants
to consume notices. Account changes remount the feed; read state survives reload
and remains isolated per user. Loading/failure/retry, request cancellation,
keyboard dialogs and mobile bounds are covered by fixture browser cases.

Canonical multipart image upload requires add OR edit permission and returns a
typed 201/location through the generated client. JPG/PNG are decoded and stored as
fresh PNG, while SVG keeps static geometry/text/gradients/local references and
safe simple presentation styles. Scripts/events, external resources and active
SVG are removed; XML, raster and reference-expansion budgets reject hostile
inputs. The static policy and lack of image garbage collection are explicit in
the notice security review. Header previews avoid loading the Quill editor chunk.

Final local validation passed 248 backend tests, including 16 image-store cases,
23 notice controller/permission cases and all ten unchanged data-scope cases.
All 54 web unit, 30 fixture browser and 27 real browser tests passed, together
with lint/typecheck/build and generated-client reproducibility. Actual browser
checks prove JPG/PNG/static-SVG uploads, served image dimensions and gradient
pixels, rich formatting/clearing, newest-five behavior, per-account persistent
read state using an owned account with no roles, authorized reader search,
paging/columns/last-page recovery and batch deletion. The final runtime verifies
all prior modules, real MySQL rollback/cache fault behavior, Redis sessions and
captcha replay. Production defaults and exact live OpenAPI equality passed.
Implementation c7605fecf4fb387af57928dce66215c86ee4d5ce passed all three
[server CI jobs](https://github.com/JRzero/EForge-Enterprise/actions/runs/37237590148)
and [web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37237590166).
Both workflows verify that exact implementation SHA; the Linux runtime also
passes the 27 real browser tests and exact committed OpenAPI comparison.
The final capability audit stays pending; operation/login logs are next, followed
by online sessions, monitoring/jobs, generator/form builder and complete shell
and shared capabilities. The full parity objective remains active.

## Operation/login log API checkpoint (2026-10-05)

Ten canonical operations now cover both typed lists, protected operation detail,
idempotent immutable-ID batch deletion, existing full clear, complete filtered/
sorted XLSX and POST password-retry unlock. Original global monitor grants remain
authoritative. Summaries omit raw operation payloads; detail uses the original
query button grant on the server. Five enum sort fields and two directions map
only to fixed SQL columns, with deterministic ID tie-breakers. Calendar dates
include both day boundaries. Export ignores list page/pageSize. Clear preserves
the original TRUNCATE/ID reset behavior; subsequent asynchronous events can appear.

Validation passed 280 backend tests (32 new log cases plus all ten unchanged
data-scope cases), 56 web unit cases, lint/typecheck/build, 30 fixture and 27 live
browser regressions. Owned MySQL checks prove actual filters/order/paging/detail,
calendar edges, complete sorted XLSX, deduplication/missing-ID deletion and SQL
failure preservation, then clear historical records. An owned no-role account is
denied all ten operations. Five real password failures produce a Redis count/TTL
and reject correct credentials; ACL denial of DEL/UNLINK yields 503 and preserves
retry state, then canonical unlock removes it and permits correct login while
keeping an earlier valid session. All previous module/runtime/captcha and
production-default checks pass. Actual OpenAPI equality and generated-client
reproducibility pass; all 125 existing path/schema entries are semantically
unchanged. The committed snapshot uses the repository's standard OpenAPI
normalizer and only adds the new log paths/schemas.

The security/mutation boundaries are in `security-review-logs-v1.md`. The API-only
commit `5e8b350a720ef23d94424e505041f296111329e7` passed exact-head server CI
`37239622151` (all three jobs) and web CI `37239622127`. At that checkpoint neither
React log route was bound; page acceptance is tracked separately below.
The full original parity objective continues.

## Operation/login log page checkpoint (2026-10-05)

Both lazy React routes now consume the generated canonical client. V018 binds
only the existing operation/login ROUTE nodes; their original `system-logs`
GROUP remains a group. The public catalog contains eleven routes and actual
seeded bootstrap navigation includes both log pages in the nested log group.
Pending legacy-menu checks now use the still-unimplemented online-session node.

The pages retain original filters and inclusive dates, server pagination and
the five sortable fields, two-way sort order, column visibility, exact-ID
selection, guarded delete/clear/unlock and complete filtered XLSX. Operation
detail fetch has its own query grant, cancellation and retry. Request/response
JSON is formatted as escaped text, invalid text remains intact, and copying
reports success only after the real operation completes; unavailable clipboard
support uses a cleaned-up textarea fallback, while rejection allows manual copy.
Dictionary labels and failures remain consistent with the shared lookup layer.

Validation passes 280 backend cases, 56 unit cases, frontend lint/typecheck/build,
generated-client reproducibility, production defaults, 34 fixture and 29 live
browser cases. Four fixture cases exercise no-grant/read-only UX, unsafe strings,
JSON/copy errors and fallback cleanup, cancellation, failure retries, exact
large IDs, all controls and mobile/keyboard behavior. The two new live cases
create twelve actual audited writes, verify inert HTML inside request JSON and
real clipboard/XLSX output, recover after deleting the last page and clear owned
history. An owned no-role account produces five failed passwords plus a locked
attempt; the page unlocks its Redis retry state, permits correct login and
preserves the earlier valid session. Failure rows are deleted and login history
is cleared. Live normalized OpenAPI exactly matches the committed snapshot.

All existing disposable module/runtime checks, including actual SQL deletion
faults and Redis unlock ACL denial, pass in the same run. Evidence logs are
`logs-page-backend.log`, `logs-page-all-fixtures.log` and
`logs-page-runtime-final.log` under the ignored boot target directory. Exact
page commit `fa7e2ebdd783e12cae74526a9371d4df69adaf58` passes server CI
`37241473195` (all three jobs) and web CI `37241473251`. The final capability audit and full parity goal stay
pending. Online sessions, monitoring/jobs, generator/form builder and complete
shell/shared capabilities remain next.

## Online-session API checkpoint (2026-10-05)

Two canonical endpoints now project safe Redis session metadata and revoke one
validated opaque UUID under the original separate monitor grants. They preserve
exact username/IP matching, including combined filters, while providing bounded
server paging and deterministic cached-time/UUID ordering. Expired reads and
partial/mismatched cache records are skipped. No bearer JWT, password hash or
cached grants enter responses. Deletion touches only the selected login key;
missing sessions remain idempotent 204. Redis read/delete faults return generic
503 and retain the target session when deletion is denied. Compatibility
endpoints and TokenService refresh/authentication semantics remain unchanged.

Validation passes 294 backend cases (14 new online cases and all ten unchanged
data-scope cases), 58 web unit cases, lint/typecheck/build, generated-client
reproducibility, production defaults, 34 fixture and 29 real browser regressions.
The owned MySQL/Redis harness creates three sessions of one no-role account,
checks exact combined filters/stable paging and safe projections, rejects both
unauthorized grants, denies KEYS then DEL/UNLINK, and verifies generic 503 with
preserved state. Successful revocation removes exactly the chosen Redis key and
makes its next bootstrap return 401; two other sessions and the caller retain
200. All previous modules, SQL/Redis faults, captcha and runtime checks pass.
Final live canonical OpenAPI exactly equals the committed snapshot; all 140
previous path/schema entries are unchanged. Evidence is `online-backend.log`,
`online-fixtures.log` and `online-final-runtime.log` in the ignored boot target.

The security boundary is in `security-review-online-sessions-v1.md`. API commit
`0cf759c9a6221ef82c896a133f6bd98f0b8cb3c5` passes exact-head server CI
`37242586665` and web CI `37242586687`; no online React route was bound at this checkpoint.
Its page, confirmations, errors/cancellation/mobile/keyboard and actual UI
revocation remain next, followed by monitoring/jobs, generator/form builder and
complete shell/shared capabilities. The full original goal remains unfinished.

## Online-session page checkpoint (2026-10-05)

The lazy EForge page retains original exact username/IP filters, reset, sequence
numbers, all session metadata, paging and per-row force logout. Confirmations
show both account and opaque session identity, support cancellation and retain
errors for retry. Leaving the page aborts list requests; expired authentication
returns to login. V019 binds only the existing online ROUTE; the monitor GROUP
enters navigation because it now has a real child. Public catalog contains twelve
routes. Legacy pending-route editing checks move to the unimplemented job node.

Verification passes 294 backend cases, 58 unit cases, lint/typecheck/build,
generated-client reproducibility, 38 fixture and 31 real browser cases plus the
entire disposable MySQL/Redis module/runtime suite and exact live OpenAPI
comparison. Four new fixture cases cover safe text, list/revoke failures,
read-only/403 UX, encoded exact filters, sequence/paging, confirmations, last-page
recovery, request cancellation, self expiry, keyboard and mobile bounds. A live
case creates twelve sessions, proves exact filters, cancels without revoking,
forces the two last-page sessions and checks their actual 401s, page-one recovery
and ten surviving authenticated sessions. A second live case revokes its own
browser session, removes stored authentication and returns to login with actual
backend 401. Bootstrap proves the monitor GROUP and its single implemented child;
all previously verified module/security/fault cases remain green.

Evidence logs are `online-page-backend.log`, `online-page-all-fixtures.log` and
`online-page-runtime.log` under the ignored boot target. Page commit
`1b29368aa22023b2330891ea5e4880ca290a4001` passes exact-head server CI
`37243330173` (all three jobs) and web CI `37243330093`.
The final original capability audit remains pending. Server/cache monitoring and
authenticated consoles, jobs/cron, generator/form builder and complete shell/
shared capabilities remain required; the full objective is unfinished.

## Server-monitor API checkpoint (2026-10-05)

The canonical server endpoint now returns concrete generated CPU/RAM/JVM/host/
disk contracts and sampling time under the original monitor:server:list grant.
It reuses the original OSHI collector behind a local projection boundary. RAM
values explicitly use binary GiB and JVM values binary MiB. The original disk
size strings, host/path fields and JVM start/uptime/arguments remain privileged
diagnostics. The API neither enumerates environment variables nor returns full
System properties. Sampling faults have fixed generic 503 semantics, and an
interrupted sample preserves interruption. The compatibility endpoint is unchanged.

Validation passes 300 backend cases (six new server cases and ten unchanged
data-scope cases), 60 web unit cases, lint/typecheck/build, generated-client
reproducibility, production defaults, 38 fixture and 31 real browser regressions.
Actual OSHI sampling checks CPU core/percentage bounds, physical RAM, JVM, host
and formatted disks; stable host identity/RAM units agree with the legacy
endpoint. An owned no-role account receives 403, and anonymous access 401.
All prior module, SQL/Redis-fault and captcha/runtime acceptance passes in the
same owned MySQL/Redis run. The final live normalized OpenAPI exactly equals
the committed snapshot; all 144 previous path/schema entries remain unchanged.
Evidence logs are `server-monitor-backend.log`, `server-monitor-fixtures.log`
and `server-monitor-final-runtime.log` under the ignored boot target directory.

The security boundary is in `security-review-server-monitor-v1.md`. API commit
`625831cd27d0a219d704dac813de0a6c4cf6d982` passes exact-head server CI
`37244220088` (verify, runtime-integration and auth-runtime-integration) and
web CI `37244220086`, confirmed on 2026-10-05. The server-monitor React page
remains pending. The page must retain
all original groups, memory/JVM usage warnings above 80%, loading/error/retry,
refresh, safe diagnostic text and actual platform browser acceptance. Cache
monitoring/names/keys/values/clear, protected or disabled consoles, jobs/cron,
generator/form builder and complete shell/shared capabilities remain required.
No server React route is bound at this API checkpoint; the full goal continues.

## Server-monitor page checkpoint (2026-10-05)

The lazy `monitor-server` route at `/server` now consumes the generated canonical
client under the original `monitor:server:list` grant. V020 binds only the existing
server ROUTE; the monitor GROUP remains navigation-only with online/server children.
The page retains every original CPU, physical RAM/JVM, host, Java startup/uptime/
installation/project/argument and disk field. Binary units are explicit GiB/MiB;
disk size strings retain upstream formatting. Physical RAM, JVM and disk usage
retain the strictly-above-80% warning threshold. CPU wait and JVM maximum memory
are also visible. All diagnostic strings render as React text, including paths,
arguments and filesystem names. Loading clears on failure; keyboard retry/refresh
and abort-on-leave avoid stale results. Mobile overflow stays inside the disk table.

Validation passes 300 backend cases (including ten unchanged data-scope cases),
60 unit cases, lint/typecheck/build, generated-client reproducibility, production
security defaults, 42 fixture browser cases and 32 real browser cases. The four
new fixture cases verify all groups/units, inert markup and long paths, strict
memory/JVM/disk 80/81% thresholds, empty disks, 503 retry, 403 clearing, route-denied
no-request behavior, keyboard controls, mobile bounds and request cancellation.
The real browser reads actual OSHI/JVM measurements and all disk fields, checks
fresh sampling after refresh, verifies the seeded GROUP/ROUTE identities and
proves both backend 403 and the denied page for an owned no-role account.
The final owned MySQL/Redis run passes all earlier module/security/fault/captcha
checks; its normalized OpenAPI exactly equals the committed snapshot. Evidence
logs are `server-page-backend.log`, `server-page-unit.log`,
`server-page-all-fixtures.log` and `server-page-final-runtime.log` under boot target.

Page commit `e454399003c9569bb4aa5304413d80145501aede` passes exact-head server CI
`37254967428` (verify, runtime-integration and auth-runtime-integration) and web
CI `37254967427`, confirmed on 2026-10-05. The final original-capability audit
remains pending.
Cache statistics/names/keys/values/all clearing levels, authenticated or disabled
consoles, jobs/cron, generator/form builder and complete shell/shared capabilities
remain required. This page checkpoint does not complete the full objective.

## Cache-monitor API checkpoint (2026-10-05)

Seven canonical generated operations retain the original monitor:cache:list grant
for stats, names, sorted keys, values and single-key/namespace/all clearing. All
original displayed Redis INFO fields, command counts and seven namespace identities
remain available; counters/bytes are exact decimal strings. Unicode/slash/ampersand
keys use query parameters and concrete delete bodies, with namespace membership
guards. JSON diagnostics normalize the pinned serializer's Long/Set notation as
data without Java object restoration, redact nested session credentials and fail
closed on malformed session values. Non-session plaintext remains readable.
The privileged boundary is documented in `security-review-cache-monitor-v1.md`.

Validation passes 312 backend cases (12 new cache cases and ten unchanged data-scope
cases), 62 unit cases, lint/typecheck/build, generated-client reproducibility,
production defaults, 42 fixture and 32 real browser regressions. All 151 previous
path/schema entries are unchanged. The final live normalized OpenAPI exactly
equals the committed snapshot. Actual Redis/MySQL acceptance checks all original
names/grants and compatibility info, special keys/values, exact large integers,
inert JSON/credential projection, missing keys and INFO/KEYS/DEL ACL failures with
preserved data/sessions. Single-key clearing revokes only the chosen session;
login-namespace clearing revokes all sessions while retaining other namespaces;
global clearing empties the entire selected database, including unrelated keys
and both caller/other sessions. Subsequent real login restores cleanup and later
captcha/bootstrap checks. All earlier module/security/fault cases remain green.
Evidence logs are `cache-api-backend.log`, `cache-api-unit.log`,
`cache-api-fixtures.log` and `cache-api-final-runtime.log` under boot target.

API commit `c6d35ed8c8567a6250d02eb2b5f3fd93f483490f` passes exact-head server CI
`37257129432` (verify, runtime-integration and auth-runtime-integration) and web
CI `37257129477`, confirmed on 2026-10-05. Both React pages still require original
statistics/command and memory charts, names/keys/value selection and refresh,
each clearing level with confirmations, all-session invalidation handling,
safe text, loading/empty/error/retry, mobile and keyboard acceptance. No cache
React route is bound at this API checkpoint. Authenticated/disabled consoles,
jobs/cron, generator/form builder and complete shell/shared capabilities plus
the final original-capability audit remain required; the full goal continues.

## Cache-monitor pages checkpoint (2026-10-05)

The canonical statistics page retains every original Redis field, exact key/call
counts, the command rose chart and the memory gauge. Both SVG charts load lazily
from pinned ECharts 6.1.0 public modules (ADR-0015). Command shapes use proportional
geometry while readouts and native text tooltips retain exact counts beyond the
JavaScript safe integer range. Gauge readings use MiB converted from exact Redis
bytes, retain the original human value and expand their range above 1000 MiB.
Keyboard tooltips, inert markup-like command names, zero/empty results, chart
resizing and disposal on data replacement/navigation are covered.

The cache list retains names/remarks, sorted keys, selected name/key/value,
independent refresh and every clearing level under the original monitor grant.
Read-only values and Unicode/slash/ampersand/markup-like keys remain literal text.
Reads abort on selection changes or navigation. Loading, empty, fault and retry
states remain independent; deletion failures preserve the action for retry.
Confirmations support Escape/focus and block cancellation/duplicate writes while
busy. Clearing reloads authenticated data so a genuinely revoked current session
returns to login. Migration V021 binds only the two existing cache ROUTEs.

Frontend lint/typecheck/build, generated-client reproducibility, 65 unit cases
and 52 fixture browser cases pass. Backend verification passes 312 cases including
the ten unchanged data-scope cases. All 37 real browser cases pass, including five
new cache cases for actual Redis fields/drawings, no-role denial, scoped clearing,
SQL record retention, safe values, special keys and rewarming. Single-session
clearing preserves its caller until its own key is cleared. Namespace/global
clearing revokes both actual caller/other tokens; non-global scopes preserve
the configuration namespace and global clearing removes it while SQL records stay.
The live normalized OpenAPI exactly matches the committed snapshot.

Complete runtime verification passes all earlier module/security/fault/captcha
checks. It also proves the browser's global clear invalidates the harness's old
session and fresh login restores authentication before subsequent module checks.
Production security defaults remain protected. Evidence logs are
`cache-page-backend.log`, `cache-page-unit.log`, `cache-page-fixtures.log` and
`cache-page-accepted-runtime.log` under boot target. Page commit
`c597d44aa2f3f0140ab11d4695675a00e615399c` passes exact-head server CI
`37259840797` (verify, runtime-integration and auth-runtime-integration) and web
CI `37259840781`, confirmed on 2026-10-05. Cloud acceptance includes Linux real
MySQL/Redis browser regression and exact live OpenAPI equality.
Consoles, jobs/cron, generator/form builder, complete shell/shared capabilities
and the final original-capability audit remain required. This page checkpoint
does not complete the full goal.

### Diagnostic console API and authentication checkpoint — 2026-10-05

Four canonical status/session operations and their generated client preserve
the original Druid and Swagger grants. Enabled consoles use five-minute opaque
HttpOnly/SameSite=Strict cookies bound to existing Redis sessions, with Secure
enabled by default. Every raw resource checks current account/role grants;
console requests neither renew nor recreate login sessions. Fixed entry paths,
same-origin checks and scoped resolution keep JWTs out of URLs and prevent
console cookies from authenticating product APIs. ADR-0016 and the diagnostic
console security review describe this boundary.

Local verification passes 336 backend tests (including all ten data-scope
parity cases), 67 unit tests, 52 fixture browser tests and all 37 existing real
browser tests. Complete MySQL/Redis regression passes with consoles disabled
and explicitly enabled. Enabled verification fetches actual Druid/Swagger HTML,
nested assets and schema using cookies, exercises immediate grant revocation,
logout, Redis ACL failures and ticket expiry, and proves login TTL does not grow.
Default-disabled verification retains authenticated schema export. Both live
OpenAPI snapshots exactly match the generated contract. Evidence lives in boot
target's console-access-backend/web/fixtures/disabled-runtime/final-enabled-runtime
logs. Implementation commit `3a77fdaffed522db278260fae6acd809273dd4d1`
passes exact-head server CI `37267216665` (all three jobs, including disabled
real browser regression and explicitly enabled console integration) and web
CI `37267216628`, confirmed on 2026-10-05. Both cloud live OpenAPI comparisons
pass. Console React pages, authenticated iframe
browser acceptance and all remaining original capabilities remain required.

### Diagnostic console pages checkpoint — 2026-10-05

Both original console routes now bind actual lazy React pages via migration
V022. The tool GROUP remains a navigation identity without a React route.
Original Druid login, basic/SQL views and its JSON window remain functional;
Swagger retains its authorization dialog and actual Try it out execution.
The parent pages cover disabled/loading/failure/retry/refresh states, expire
scoped tickets without signing out a valid application session, recheck grants
on focus and while active, abort reads/issuance on navigation and remove frames
on application logout or authorization failure. Fixed same-origin paths and
HttpOnly cookies keep console tickets out of entry URLs and parent storage.

Real browser verification exposed Druid's public resource caching. The scoped
filter wrapper now enforces no-store even after imported code resets/overwrites
headers; ordinary resource caching remains intact. Actual default browser fetches
after logout return 401 and after grant revocation return 403. The inner Druid
session cookie and JSON popup are verified independently of the outer grant.
Swagger's actual authorization/HTTP-200 execution is verified; failure snapshots
remove the iframe to avoid capturing bearer input/generated curl text.

All 338 backend tests (including ten unchanged data-scope parity cases), 67 unit
tests, 57 fixture browser tests, lint/typecheck/build and reproducible client
checks pass. Complete MySQL/Redis regression and all 40 real browser tests pass
in both explicitly enabled and default-disabled configurations. Both live
OpenAPI snapshots exactly match the committed contract. Runtime regression
includes all earlier modules, captcha, ACL faults, transaction rollback, SQL
retention and cache clearing/session invalidation. The two earlier monitor
loading fixtures now gate responses explicitly instead of relying on 300ms
timing. Evidence logs under boot target are console-pages-backend,
console-pages-final-static, console-pages-fixtures, console-pages-enabled-runtime
and console-pages-disabled-runtime. Implementation commit
`cb3a25033a2e5a7724ce4c4f358a43e8499a2d0b` passes exact-head server CI
`37273703241` (all three jobs, including both configurations' complete real
browser regression and live OpenAPI equality) and web CI `37273703194`,
confirmed on 2026-10-05. Jobs/cron and
task logs, generator/form builder, complete shell/shared capabilities and the
final original-capability audit remain required; this checkpoint is not full
goal completion.

### Task log API and actual Quartz preview checkpoint — 2026-10-05

Canonical task logs now expose typed list/detail, idempotent batch deletion,
clear and filtered XLSX export under the original task permissions. String IDs
retain full long precision, summary responses omit exceptions, validated time
ordering/date ranges apply before paging, and canonical clear preserves the ID
sequence. The separate preview endpoint uses Quartz's actual parser and server
timezone, including special dates and valid exhausted expressions.

The owned MySQL/Redis/Quartz harness dispatches an actual successful task and
an actual failing task through the retained compatibility API. It checks their
canonical logs/details, filtered XLSX, permission gates, delete-trigger failure
preservation, calendar boundaries/sorting/paging and monotonic IDs after clear.
Canonical task CRUD, scheduler/database mutation consistency, Cron editor and
all task/log React pages remain pending; this is an API checkpoint only.

Full regression also reproduced a Druid session race. Stateless authentication
was rotating the independent servlet session on every request, invalidating
concurrent iframe resources. A new security-chain test fails before the fix and
passes with an explicit null session authentication strategy. Real browser
verification retains the same native cookie across basic/JSON popup/SQL views,
with all existing scoped authorization/logout checks still enforced.

Local verification passes 351 backend tests (including ten unchanged data-scope
cases), 67 unit tests, 57 fixture browsers and all 40 real browser cases in each
enabled/default-disabled console configuration. Lint/typecheck/build, hardened
defaults, seeded routes, full runtime regression and generated-client
reproducibility pass. Both live OpenAPI snapshots exactly match the committed
contract. Evidence logs in boot target use the job-api-backend/unit/build/
fixtures/enabled-runtime/disabled-runtime prefixes.
The initial cloud fixture run exposed a separate retry-test race: consecutive
failures reused the same alert text, so the assertion could accept the preceding
phase and click a disappearing button. The fixture now holds each new response
until the loading state is visible and the previous alert is removed. All 57
local browser cases pass with that deterministic gate; production page behavior
is unchanged.
Final exact commit `e0b4f9770de86381a8a5134317dfe01cc68ebc36` passes
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37280882240)
in all three jobs, including both console configurations' full real browsers and
live OpenAPI equality, and
[web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37280882307),
confirmed on 2026-10-05. Implementation was introduced by `de82188`; the final
commit also contains the verified retry-fixture correction.
The complete original frontend objective and all final capability audits remain
active.

### Task replacement recovery checkpoint — 2026-10-05

An existing compatibility task update could roll back its MySQL row while
permanently deleting its original RAMJobStore key when replacement scheduling
failed. The service now captures the old payload, trigger keys, saved next
execution deadline and pause states; a failed replacement removes the attempted
key and restores the original schedule. An occupied different-group target is
rejected before mutation. Recovery does not replay a historical trigger start.

Four actual Quartz regression cases fail before the repair and pass afterwards;
seven new actual RAMJobStore cases cover group/status variations, partial
creation, collisions and a previously fired trigger. The owned real runtime
harness also verifies checked-exception SQL rollback, the restored original key
actually executing its original target successfully, and failed-key cleanup.
See security-review-task-replacement.md for the precise boundary and remaining
commit/concurrency/batch/precommit/persistent-fault requirements.

Local verification passes 358 backend tests, including the ten unchanged
DataScopeAspectParityTest cases, 67 unit tests, 57 fixture browsers, and all 40
real browser cases in each enabled/default-disabled configuration. Both full
MySQL/Redis/Quartz/OSHI/ACL/captcha regressions pass, as do lint/typecheck/build,
hardened defaults, seeded routes and generated-client reproduction. Both live
OpenAPI snapshots exactly match the committed contract. Evidence logs under
boot target use task-replacement-backend/unit/build/fixtures/enabled-runtime/
disabled-runtime prefixes. An existing dictionary browser race is corrected by
waiting for the destination heading after returning from its data subpage,
before filling the type-list filter; all deletion/empty-list checks remain.

Canonical task CRUD, full scheduler/database mutation consistency and all
task/Cron/log pages remain pending. Generator/form builder, complete shell and
shared capabilities and the final full original-capability audit remain required.
This repair does not complete the task module or the full parity objective.
Task replacement repair exact commit ec658d1686a2db771d43c4db067af3a5be5c73e8
passes server CI 37295454573 in all three jobs and web CI 37295454526,
confirmed on 2026-10-05. This includes both configurations' complete Linux real
browser/runtime regression and exact live OpenAPI equality.
### Canonical task read API checkpoint — 2026-10-05

Task list/detail and full filtered sorted XLSX export now use canonical DTOs,
string long IDs, validated paging/status/filter lengths and fixed sort enums
under the original list/query/export grants. Actual Quartz-derived next execution
and original task fields remain available. Compatibility entities stay behind
projection/export boundaries; PageHelper state is always cleared and SQL errors
are sanitized.

Thirteen new MVC cases pass. Full local regression passes 371 backend tests
(including ten unchanged data-scope parity cases), 67 unit tests, 57 fixture
browsers and all 40 real browser cases in each default-disabled/enabled console
configuration. The real MySQL/Redis/Quartz harness checks combined filters,
ordering before paging, task detail/next time, invalid/missing long IDs, full
sorted XLSX and anonymous/no-role denial. Existing rollback/session/ACL/OSHI/
captcha coverage passes. Lint/typecheck/build and generated-client reproduction
pass; both live OpenAPI snapshots are exactly equal. Evidence logs under boot
target use job-read-api-backend/unit/build/fixtures/disabled-runtime/enabled-runtime.
Cloud verification of this new read API remains pending until its exact commit
results are checked.

Automatic approval review rejected a proposed scheduler-wide mutation boundary
and then a narrower affected-ID mutation/execution-gate implementation because
of potential task interruption, latency or SQL-dependent availability. Neither
rejected runtime implementation was written. The abandoned wide proposal will
not be pursued. proposed-task-mutation-boundary.md records the narrower concrete
proposal and risks; explicit approval is pending. Canonical task mutations and
full consistency remain incomplete. Independent task-log pages and the remaining
original generator/form builder/shell/shared capabilities can proceed while this
specific proposal waits. Full frontend parity and final audits remain active.
Canonical task reads exact commit 13378346239029ad05cb40f17ea81406c348b5df
passes server 37298378311 in all three jobs and web 37298378298, confirmed on
2026-10-05. Both configurations' full Linux browsers/runtime and exact OpenAPI
remain green. This acceptance does not cover canonical task mutations or pages.
### Task read and original task-log pages checkpoint — 2026-10-05

The task menu now opens its implemented read/detail/export page; migration V023
binds the existing stable ROUTE only. The internal /job/log/:jobId page preserves
original task context and close-to-parent behavior, name/group/status/date
filters, ordering, selection/paging, detail and exception text, delete/clear
confirmations and full filtered sorted XLSX. A failed task-context lookup never
falls back to querying all logs. All product requests use generated canonical
API functions; fixture setup uses the owned legacy backend directly.

Four new fixture browser cases and two real browser cases pass. Real verification
creates twelve paused owned tasks, dispatches actual Quartz success/failure,
checks stored normalized text without HTML execution, whole sorted XLSX, filters,
context/close, paging deletion, cancelled/confirmed clearing, SQL results and
actual no-role route/API denial. Large string IDs, retry faults, keyboard/mobile
bounds and original grant visibility are covered by the fixture/transport suites.
Exact navigation assertions now include the task leaf; the legacy pending-route
compatibility test still strictly checks an unimplemented generator entry.

Full validation passes 371 backend tests (including ten unchanged data-scope
parity cases), 69 unit tests, 61 fixture browsers and all 42 real browser cases
in each enabled/default-disabled console configuration. Both complete disposable
MySQL/Redis/Quartz/OSHI/ACL/captcha/data-consistency regressions pass, and both
live OpenAPI snapshots exactly match the committed contract. Frontend lint,
typecheck/build, generated-client reproduction and hardened defaults pass.
Evidence logs under boot target use job-pages-backend/unit/build/fixtures/
disabled-runtime/enabled-runtime prefixes. Exact-head cloud acceptance is pending.

Task mutations, status/run controls, Cron editor and full scheduler/SQL consistency
remain incomplete. The explicitly approval-pending affected-ID mutation proposal
is unchanged and unimplemented; neither rejected runtime patch was written.
Generator/form builder, complete shell/shared capabilities and final audits
remain required. This checkpoint does not complete task management or full parity.

Task read and original log pages exact implementation commit
94f1b1889150cc8e257245294b88e74c9517c650 passes
[server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37304885110)
in all three jobs and
[web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37304885166),
confirmed on 2026-10-05. Both configurations' complete Linux real browser/runtime
regressions and exact live OpenAPI equality pass. Task writes/Cron editing/full
scheduler consistency and final original-capability acceptance remain incomplete.

### Cron editor and task-read handoff checkpoint — 2026-10-05

The independently implemented React editor preserves the original seven fields,
every/range/interval/specified-value modes, optional years, day/week exclusion,
nearest workday/month end/nth or last weekday, manual expression refill and the
original '* * * * * ?' reset. Named or advanced Quartz fields remain intact until
explicitly edited. The existing generated canonical preview provides five
actual Quartz instants and server-zone display. Exhausted valid expressions can
be confirmed; invalid/failed/stale previews cannot. Confirmation returns an
expression to the caller/read tool and never mutates a task or schedule. The task
read detail can hand its current expression to the editor. Future task create/
edit forms must still integrate this component; task management is not complete.

The first browser failures proved local validation errors were incorrectly
reported as network failures and cancellation lost focus after detail handoff.
Both are repaired without weakening assertions. Tool cancellation also explicitly
restores its opener. A whitespace-only input change now revalidates the normalized
expression; bounded/empty fields disable confirmation. The slow-request test
registers its listener before editing, and list-only denial waits for the actual
page heading before asserting the missing control.

Full local verification passes 371 backend tests (including ten unchanged data
scope cases), 73 units, 64 fixture browsers and all 43 real browser cases in each
default-disabled/enabled console configuration. Actual Quartz browser cases
compare L/W/#/last weekday/named-range previews with protected API instants,
verify invalid/expired expressions, context/reset/confirmation/mobile, persisted
task field equality and actual no-role denial. Both complete disposable MySQL/
Redis/Quartz/OSHI/ACL/captcha/data-consistency regressions pass. Lint/typecheck/
build, generated-client reproduction, production security defaults and both
exact live OpenAPI snapshots pass. Logs under boot target use cron-editor-
backend/unit/build/fixtures/disabled-runtime/enabled-runtime prefixes.
Exact-head cloud acceptance is pending until checked.

Task canonical writes/white-list validation, schedule/SQL commit/concurrency/
batch/precommit/persistent-fault consistency and task create/edit/status/run/
delete controls remain required. The execution-gated mutation proposal is still
explicitly approval-pending after automatic review rejection; neither rejected
runtime patch was written. Generator React/EForge output and UI, form builder,
full shell/shared capabilities and final per-capability acceptance remain active.

Cron editor exact implementation commit 06f4fbdf3c891a460e6db38b95eb086e0e61cc20
passes [server CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37310528730)
in all three jobs and
[web CI](https://github.com/JRzero/EForge-Enterprise/actions/runs/37310528660),
confirmed on 2026-10-05. Both configurations' complete Linux real browsers,
runtime regressions and exact live OpenAPI equality pass. This accepts the
editor/read tool/detail handoff only; task create/edit integration, all canonical
task mutations/full consistency and final capability audit remain incomplete.

### Generator canonical read checkpoint — 2026-10-05

Imported table lists, database discovery, configuration/table-choice detail and
fields now use concrete canonical DTOs under the original list/query grants.
Compatibility objects and raw options JSON remain behind the projection boundary.
String long IDs include parent/column ownership, configuration retains tree/sub/
layout/output/author/detail choices, and fields retain every original flag/type.
The unchanged mappers preserve current-schema/import/Quartz/generator exclusions,
bound name/comment/inclusive-date filters and fixed ordering before pagination.
Paging state always clears. Missing imported tables are typed 404; malformed
stored options and SQL failures are sanitized. Reads never execute generation,
DDL, metadata writes or filesystem output. See security-review-generator-read-v1.md.

Seventeen new MVC cases pass. Full validation passes 388 backend tests including
ten unchanged data-scope cases, 73 units, 64 fixture browsers and both console
configurations' 43 existing real browsers/full MySQL/Redis/Quartz/OSHI/ACL/captcha
regressions. Owned real-schema/metadata fixtures prove discovery/import exclusion,
configuration/fields/choices/exact IDs, combined filters and calendar, sort before
page, injection as data, anonymous/no-role denial and actual SQL fault recovery
without metadata loss. Both live OpenAPI snapshots exactly match the new contract;
generated client reproduction, lint/typecheck/build and hardened defaults pass.
Evidence logs use generator-read-backend/unit/build/fixtures/disabled-runtime/
enabled-runtime under boot target. Exact implementation
2ca49b1d66e4be513de5873f765c9e00060af06e passes server 37315345511 all
three jobs and web 37315345434, confirmed on 2026-10-05. Both Linux console
configurations pass the full real regression and exact live OpenAPI checks.

Import/create/edit/delete/sync/preview/download/custom-path APIs, React/EForge
outputs with canonical contracts and static route/page generation, complete
metadata/import/preview/output UI and actual generated-code end-to-end acceptance
remain required. Form builder, shell/shared capabilities, complete task writes/
consistency and final original-capability audits remain active. This read stage
does not complete the generator module or change the pending task-boundary approval.

### Generator canonical import checkpoint — 2026-10-05

POST /api/v1/tool/generator/imports preserves the original import grant and audit
actor. It validates 1–100 selected current-schema tables and every field before
writing, initializes metadata with attributed original utilities, returns created
string IDs in selection order and assigns the React/EForge target. One transaction
owns all table/field writes. V024 enforces a unique physical-table configuration
for concurrent canonical and compatibility imports; existing duplicates stop the
migration without silently deleting user configuration. See
security-review-generator-import-v1.md for the exact boundary and remaining scope.

400 backend tests (12 new MVC cases and 10 unchanged data-scope cases), 73 units,
64 fixture browsers, lint/typecheck/build/client reproduction and hardened defaults
pass. The disabled configuration passed 43 existing real browsers; its first SQL
harness run exposed a trigger syntax issue. After correcting that verifier, the
full database regression passed, including actual insertion-fault rollback without
orphan fields, retry, no-role denial and concurrent import uniqueness. Enabled
configuration also passes all 43 existing real browsers and full runtime regressions.
Both live OpenAPI snapshots exactly match the contract. Exact-head implementation
15d7bcea995be82219d5aaa307762216b3721614 passes server 37333745938 all
three jobs and web 37333746012, confirmed on 2026-10-05. No generator UI or
React/EForge output completion is claimed; all remaining original capabilities,
full task mutation consistency and its pending approval remain in scope.

## Generator configuration API and job-log calendar checkpoint (2026-10-06)

Canonical `PUT /api/v1/tool/generator/tables/{id}` and its generated client retain
original configuration and all field controls through concrete validated input.
The original edit grant and authenticated actor remain authoritative. A complete
owned field set is required; physical identities stay server-owned, duplicate/
foreign/incomplete fields fail before writes, and parent metadata plus every
field update share one transaction. Actual MySQL update failure proves full
rollback and retry. Tree/subtable/menu settings, clearing/order, exact long IDs,
Boolean/query/control choices and legal hyphenated route names are verified.
Explicit write-schema names preserve the complete independent read contract.

The enabled real browser regression exposed a job-log UTC database/Shanghai
calendar mismatch. The product now sends its viewer zone for both list and XLSX
and binds prepared instant boundaries; omitted zones preserve legacy semantics.
Actual SQL proves Shanghai boundaries, the New York 25-hour DST day, exact rows
and matching full export selection. The original failing Quartz browser test
passes after the repair, without replacing browser dates with UTC dates.

416 backend tests (including 14 configuration MVC and ten data-scope cases),
73 units, 64 fixture browsers, both configurations' 43 real browsers and full
MySQL/Redis/Quartz/OSHI/ACL/captcha regressions pass. Lint/typecheck/build,
security defaults, generated-client reproduction and both live OpenAPI snapshots
match exactly. Exact-head cloud verification is pending until its runs succeed.
See `docs/security-review-generator-configuration-v1.md` and
`docs/security-review-job-log-calendar.md` and generator-configuration-calendar-*
logs under boot target.

This completes a local API checkpoint. Shared legacy/sync/reference mutation
coordination, remaining generator writes, React/EForge templates and full pages,
runnable generated CRUD/tree/subtable proof, form builder, shell/shared features,
other modules' calendar/export-time audit and final original-capability acceptance
remain required. The rejected task runtime proposal still requires explicit
approval; no equivalent scheduler mutation change is included here.

Exact implementation `66158a6b7bf7595d6da804a949110b1a4d50e7b2` passes server
`37345364383` all three jobs and web `37345364385`, confirmed 2026-10-06. This
includes both configurations' complete real browsers/runtime and exact OpenAPI.
Configuration API acceptance does not complete generator outputs/pages or the
remaining shared mutation and original-capability audits.

## Generator metadata serialization checkpoint (2026-10-06)

Canonical import/configuration and original HTTP import/update/delete/sync now
share a feature-local InnoDB transaction row through V025. This coordinates writers
across application processes without gating tasks or unrelated business data.
418 backend tests and both complete real API regressions pass. Actual SQL record
locks and waiting requests are observed, then rollback releases the lock and
canonical save/original sync complete normally. Both live OpenAPI snapshots are
unchanged and client reproduction/security defaults pass. This adds no UI change;
new exact-head cloud acceptance remains pending. See the metadata boundary review.

This prerequisite does not complete mutation integrity. Shared legacy ownership,
checked writes, reference-preserving rename and guarded atomic delete/sync and
concurrent outcomes remain required before generator output/templates/full pages
and generated-module end-to-end proof. Full original parity remains active.

Exact metadata serialization implementation ef2ba15041be3954b3f28f53cae7286a4ec695ce
passes server 37347737857 all three jobs, confirmed 2026-10-06, including both
configurations' complete real browsers/runtime and exact OpenAPI. Its frontend
and contracts trees are identical to accepted 66158a6; web-ci's path filter does
not trigger for this backend-only change. This accepts serialization only; all
stated remaining integrity, generator outputs/pages and full-parity work remains.

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

Expanded generated root/child representative matrix aafa28d: exact server37537425688 all three jobs and web37537425654 accepted; Boolean dictionary and remaining variants are separate pending work.

Boolean dictionary0/1 select/radio correction passes both actual generated-host profiles, including root/child refill/display/query and invalid scalar400 preserving draft/SQL.618 backend and89 unit plus frontend checks pass; exact new cloud remains pending. See security-review-generator-boolean-dictionary.md.

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
Explicit ancestry final local evidence (2026-10-07):99065 terminated0 with all
seven actual generated React categories (crud/tree/sub/auto/autotree/autosub/
stringkey), full original Boot/JWT/Redis/MyBatis/audit, actual read cancellation,
retained drafts/selection,11 owned held upload acknowledgements, no-role denial,
role withdrawal, exact long/String PK, decimals, bulk/XLSX and no physical child
orphans passing. This proves the product fix beyond mocked navigation. It does
not add final nested child-rich upload coverage that the full audit still needs.
Both personal-center and explicit parameter-child ancestry regressions pass;
13417 final lint/typecheck and106 full mocked browsers passed.71337 final API
client reproducibility,98 unit tests and production build passed. No temporary
react-probe files remain.80422 both57/fullAPI outcomes and identical framework
OpenAPI belong to the preceding12ec001 source; they are not relabeled as evidence
of this fix. New exact-source server/full57-both-profiles and web cloud acceptance
are pending.12ec001 server verify failed and remains failed historical evidence.
Normal backend Java, schema, permission semantics and denied Quartz runtime were
not changed. This remains a partial sidebar phase, not the full parity goal.
Exact declared-ancestry acceptance (2026-10-07):04ac0f236ff6608587eacbc6116f4ef92b4ec7be
server37593686563 all three jobs SUCCESS and web37593686565 SUCCESS. Direct
sidebar-ancestry-cloud-accepted-server/web.log proves both57 full framework
browsers/API profiles/OpenAPI,619 backend declarations with all10 data-scope
cases and one platform-specific skip,98 units and106 mocked browsers. Both
actual generated React/Boot verification passes including the complete seven
categories and retained upload/read/action/audit assertions also succeeded.
The earlier12ec001 cloud remains failed evidence; it is not relabeled success.
Observer91971 exited1 despite authoritative successful jobs; its observation exit
was not a product failure and no successful job was restarted. This accepts
GROUP disclosure and declared ancestry only. Mobile source subsequently merged
locally remains independently pending; desktop collapse is isolated and also
not yet real/cloud accepted. Original active full parity remains unfinished.

## Responsive sidebar phase (2026-10-07)

The actual Application now consumes EnterpriseShell around the pinned EForge
AppShell. Original 991/992px breakpoint opens a native modal drawer; route,
account and viewport changes dismiss it. Tab boundaries, Escape/backdrop focus
restoration and body scroll restoration are verified. Mobile navigation uses the
same authorized static projection; GROUP nodes remain disclosure controls.
Desktop collapse changes the shell width from 240px to 64px, retains literal
accessible names and provides mouse/keyboard child popups. Escape, outside
pointer, scrolling and resize close popups. Popup bounds are clamped to the
viewport. Local storage keeps only collapsed/expanded preference; unavailable
storage does not prevent navigation. Switching to mobile retains the desktop
preference without presenting a collapsed drawer. PageWorkspace remains mounted,
so toggling does not discard page drafts. Java, schema, authorization and denied
Quartz runtime source are unchanged.

Final frontend lint/typecheck, reproducible client, 98 units, production build
and 109 mocked browser tests pass. Earlier mobile-only authority79194 completed
both57 actual framework browser/API profiles with identical contract OpenAPI;
that evidence is not relabeled as final desktop-collapse verification.
Final combined-source real authority96723 and exact-source cloud are pending.
The full frontend parity goal remains unfinished; mixed/top navigation, settings,
other remaining editor/action audits and full capability acceptance remain.
The user requested pausing after this responsive sidebar task; finish its
verification and commit/push, then pause without starting another module.

## Responsive sidebar accepted; project paused (2026-10-07)

Implementation 2b51493b54f678c429e887e4e80ac367944719d1 is accepted.
Exact server37597012949 all three jobs SUCCESS and web37597012983 SUCCESS.
Direct sidebar-responsive-cloud-server-accepted.log and
sidebar-responsive-cloud-web-accepted.log retain full backend/generated/runtime
and frontend evidence. Local authority96723 terminated0: both enabled/default
profiles57 real framework browsers and complete API/MySQL/Redis/Quartz/OSHI/ACL/
captcha regressions passed. Both live OpenAPI hashes exactly match the contract:
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
Final98 units,109 mocked browsers, lint/typecheck/client reproducibility/build
passed. Real SQL navigation additionally proves desktop64/240px, hover/keyboard
popup/Escape, page draft retention, reload preference and actual route actions;
mobile native focus/backdrop/body scrolling/route/resize behavior also passes.
Both generated React/Boot verification passes and all seven original generated
categories retain strict permission, data, upload/read/action and audit checks.
No fresh local Maven run is claimed; exact cloud backend validation is authoritative.

The user explicitly requested pausing after this task. The responsive sidebar
phase is complete and committed; the complete framework parity goal is paused,
not complete. Do not start another module or automatic development until the
user resumes. Remaining scope includes mixed/top navigation, layout/theme/density
settings, other editor/action ownership, nested child-rich upload final audit,
date/timezone/XLSX audit and final capability acceptance. Form builder remains
user-deferred and not complete. The specifically denied Quartz runtime scheme
remains unapproved. The isolated sidebar worktree was archived after integration
and preservation of needed ignored validation evidence. Local owned ports are
released and the main working tree is clean at pause.

## Development resumed; three navigation modes (2026-10-07)

The user resumed the full current project scope and requested a 1.5x development
pace. This is a workflow target, not a guaranteed execution-time multiplier;
independent work is interleaved while all required acceptance checks remain.
The previous pause instruction is superseded. Form builder remains deferred,
and the specifically rejected Quartz runtime schemes remain unapproved.

Actual EnterpriseShell now offers left, mixed and pure-top navigation. Mixed
GROUP selection changes only the authorized sidebar projection and does not
navigate a fake GROUP route. Registered route ancestry restores the active root.
Pure-top includes multi-level child navigation and reachable overflow groups;
all root entries remain reachable after width changes. Native links retain exact
query strings and external noopener behavior. Mobile991px uses the verified full
native drawer independently of desktop mode. Layout mode can be previewed,
explicitly saved and reset; only an allowlisted local preference is stored.
PageWorkspace stays mounted, preserving page drafts. Permission refresh derives
all shown nodes from the current authorized projection; stored selections cannot
reintroduce revoked routes.

Focused mixed/top tests passed after fixing actual pinned AppShell header flex
compression. Final frozen-source lint/typecheck/build and111 mocked browsers
passed;98 units/client reproducibility passed before the final small popup-close
and active-indicator patch. Exact cloud will independently rerun all checks.
The first full browser run was modified during execution and is not accepted;
it showed a native console nonce mismatch and Cron login failure. Frozen rerun
kept all original assertions and passed111 without changing those tests.
Real authority72605 runs both complete profiles, including actual SQL navigation
mode/draft/reload/route assertions; it is pending, not claimed accepted.
Full theme/density/layout switches, remaining action audits and final active
parity acceptance remain required. This is a navigation mode phase only.

2026-10-07 resumed layout phase: navigation18b9f78 exact cloud server37601222320/web37601222367 accepted; actual theme/layout persistence, density and header fullscreen implemented. Frozen98 units/117 mocked browsers passed. Real authority60953 and exact new cloud pending; menu loading race and mobile notice overlap fixed with behavior regressions. See security-review-layout-settings.md. Form builder deferred; full goal incomplete.

## Exact acceptance of layout implementation 5b4dfa6

Both local profiles completed authority60953 with57 real browsers each and complete MySQL/Redis/Quartz/OSHI/ACL/fault/data-consistency/captcha API PASS. Both live OpenAPI hashes equal the unchanged contract65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC. Exact cloud server37604035780 all three jobs and web37604036011 terminal SUCCESS. Direct accepted logs prove both57 browsers/full API,609 boot declarations (one existing platform skip),10 data-scope tests,98 units and117 mocked browsers. No fresh local Maven is claimed for this frontend-only stage. Main old72605 failure is superseded by the actual loading guard and this final source acceptance, not erased. Full project incomplete; isolated header-avatar stage is not covered by this commit's evidence.
## Exact cloud acceptance

Implementation3aed9a8787798456686cc143d40df3d3fd98ee64: server37606190761 all three jobs and web37606190846 terminal SUCCESS. Direct header-avatar-cloud-server-accepted.log proves610 boot declarations (one existing platform skip),10 scope tests, both57 real browser profiles and complete API/OpenAPI acceptance including actual header image immediately after crop upload. Direct web log proves118 mocked browsers;98 units/reproduction/lint/type/build also passed. Local focused profile evidence remains explicitly one browser. Full project is still incomplete; password reminder work in its separate worktree is not included in this accepted source.

## Password reminders: final real validation in progress

Original initial-password and expiration priority/cancel behavior is implemented
with generated canonical bootstrap metadata and a native personal-profile
password-tab destination. The authoritative read-only repeatable-read SQL
snapshot releases its connection before the existing guarded configuration
reader runs. Final local Maven declares623 tests including10 scope cases and
one existing platform skip; unchanged UI source passed98 units/120 mocked
browsers. Authority13398 is running both58-browser profiles and complete actual
API suites, with32 actual concurrent bootstraps. Earlier transaction and legacy
comparison-fixture failures are retained and are not final acceptance. Cloud
acceptance is pending. Registration/complexity/shared final audit and approved
task management still remain; form builder remains user-deferred. See
security-review-password-reminders.md.

Password reminder implementation b039ab43dae5e59e97c554f27d44a6cedfd75417 exact cloud accepted: server37611280476 all three jobs and web37611280555 SUCCESS. Direct logs prove both58 real-browser/full-API/OpenAPI profiles and32 actual concurrent bootstraps each,613 boot declarations+10 scope cases (one existing skip),98 units and120 mocked browsers. Local13398 default profile passed but enabled concurrency check failed without categories; focused78224 retained32/15 seconds and passed, and diagnostic69991 full enabled retry remains pending. No failure history is erased or inferred to be infrastructure. Independent registration implementation and diagnostic-script edits are outside the accepted SHA. Full goal incomplete; form builder deferred.

## Registration implementation: final real/cloud pending

Optional self-registration now has original-default-off canonical availability and create endpoints plus the full native page, captcha/confirmation, safe success text and separate login. Backend authority prevents request-supplied grants; original hashing/date/audit and captcha service remain behind a migration adapter.25 targeted production security tests,633 full Maven declarations,98 units and123 frozen mocked browsers passed. Actual full API authority46176 terminal0 includes eight-request unique race, single-use captcha, no-role login/logout, SQL fault/privacy/retry and original audit; actual OpenAPI51811E0BB00D0B30658965425019CA8FE7319C26146827C46F95A9B1665B8C8F exactly matches contract. Final authority66393 runs both59-browser/fullAPI profiles; exact cloud is pending. See security-review-registration.md. Password complexity, remembered credentials, remaining shared audits and specifically unapproved task mutation remain outside this stage. Full goal incomplete; form builder deferred.

Registration d4567f25edc5ec77c9fbdeea395479e129a6cb27 is now exact-cloud accepted: server37614190802 all3/web37614190817 SUCCESS, both59 real-browser/fullAPI/OpenAPI profiles,633 Maven declarations,98 units and123 mocked browsers. Local66393 also terminated0 with both profiles. Password-reminder diagnostic69991 terminated0 with58 browsers/fullAPI; earlier failed evidence is retained. The current independent-display/request-redaction implementation has634 local declarations,98 units/124 mocks and seven focused real browsers; its remaining full API tail and precise cloud acceptance are tracked separately in security-review-password-controls.md. Full goal remains incomplete.

Explicit remembered-login behavior now retains original opt-in/pre-login save,30-day expiry, next-visit restore and opt-out. Random non-exportable AES-GCM browser keys replace embedded-key cookies; only a synchronous non-secret opt-out marker uses localStorage. Deletion acknowledgement and the marker fix an observed immediate-reload race without hiding the failed evidence. Final98 units/130 mocked browsers and authority40388 focused1/fullAPI passed; exact source cloud and both60-browser profiles remain required. No fresh Maven run for unchanged Java source. See security-review-remembered-login.md. Dashboard and remaining active audits continue; full goal incomplete, form builder deferred, specific Quartz runtime scheme unapproved.

Password display/redaction49f1ec335bca42820469b7da6e24cd5047e77826 is exact-cloud accepted: server37617297912 all3/web37617297911 SUCCESS. Direct accepted logs prove both59 real-browser/fullAPI/OpenAPI profiles,634 declarations including10 scope/one existing skip,98 units and124 mocks. Independent remembered login b82e873 has130 frozen mocks and focused real1/fullAPI evidence; its exact cloud still pending. Full active goal incomplete.

Original chart workbench variant is implemented with all four metric/trend datasets, count-up, line/radar/rose/stacked-bar charts, keyboard legends, full data tables, owned resize/disposal and actual retry fallback; mobile labels/layout verified and data explicitly marked demonstration. Final98 units/132 mocks and16452 focused1/fullAPI passed; exact source cloud and both61 real-browser profiles remain required. Java and OpenAPI unchanged, no fresh Maven run claimed. See security-review-dashboard-parity.md. Original screen-lock workflow was independently identified in lock.vue/store lock.js/ Navbar; it still requires canonical password verification and the complete native workflow. Full active goal incomplete; deferred form builder and specifically unapproved Quartz runtime proposal retain their distinct states.

Remembered login b82e8731c80912804d39b26d9e9b44b6f1e5d38c is exact-cloud accepted: server37619212493 all3 and web37619212554 SUCCESS, direct logs prove both60 real-browser/fullAPI/OpenAPI profiles,634 declarations (10 scope/one existing skip),98 units and130 mocked browsers. Dashboard9ad0cb5 and the independent screen-lock workflow retain their own pending acceptance. Full active goal incomplete.

Dashboard9ad0cb542d1c0087e5d7773cd3dff5294fe8ff47 is exact-cloud accepted: server37621235869 all3/web37621235851 SUCCESS, both61 real-browser/fullAPI/OpenAPI profiles,634 unchanged backend declarations,98 units and132 mocks directly proven. Current screen-lock workflow requires separate full implementation and acceptance; full active goal incomplete.

Native screen-lock/current-password verification is integrated with generated client. Final main648 backend declarations,98 units and137 mocks, focused real1/fullAPI including explicit SQL/no-role/hash-change/privacy/recovery/unchanged-row/logout verification passed. Scoped mobile contrast correction and final frozen gates are tracked separately; exact cloud/both62 profiles remain pending. Independent XLSX audit reproduced old numeric user-ID9007199254740993 exporting as1; correction is under isolated validation, not included as accepted. Specific Quartz runtime proposal awaits explicit approval; form builder deferred; full active goal incomplete.

## Current aggregate reconciliation (2026-10-07)

See [current-scope-acceptance.md](current-scope-acceptance.md) for current evidence rather than historical pending checkpoints. Exact22f8895 server37637943620 all3/web37637943781 succeeds: both62/fullAPI/OpenAPI,661 backend declarations including10 scope/one existing skip,98 units/139 mocked browsers and both generated hosts. Local sequential enabled38045 also completed0. All19 original API modules have operation-level current acceptance entries; task create/update/delete/status/run remain specifically pending. New independent dialog geometry has2 focused/141 full mocked browser passes, but current real profiles and exact source cloud are still pending. The original inventory and historical failures are retained. Full project incomplete; form builder deferred.
