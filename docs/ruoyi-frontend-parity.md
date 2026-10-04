# RuoYi frontend capability parity

The active objective is **all original frontend capabilities**, with strict
function-by-function verification. A working shell or a green subset of tests
does not prove this objective complete. The architecture baselines in AGENTS.md
remain unchanged.

## Immutable behavior reference

The pinned Spring Boot 3 backend commit has already separated its frontend
repositories. For an inspectable reference of the same RuoYi version, inventory
the official v3.9.2 frontend at
`yangzongzhuan/RuoYi-Vue@0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0`.
This is a read-only **behavior reference**, not a dependency, copied Vue app,
or advancement of the pinned backend commit. The backend's actual controllers,
services and security behavior remain authoritative for supported operations.
The reference contains capabilities absent from the initial Phase 2 shell.

`ruoyi-frontend-parity.json` records every non-asset frontend source path and
exported API operation in that reference. Direct downloads/uploads and component
behavior must also be covered; an API function inventory alone is insufficient.
It is a work inventory, not executable proof of completion.

## Required capability groups

| Group | Required behaviors | Current evidence/state |
| --- | --- | --- |
| Login/account lifecycle | captcha, failed login, remember-account/credential UX, configurable registration, logout, lock/unlock, session expiry, initial/expired password change | Login/captcha/logout/expiry verified; other behaviors missing |
| Application shell | route and button permissions, hierarchical menus, breadcrumbs, header search, tab open/close/refresh/pin/context menu, sidebar collapse, top navigation, embedded/external routes, responsive layout, theme/density settings, notice badge | Initial shell/RBAC/navigation/403/404 verified; full shell parity missing |
| Dashboard | original landing/workbench behavior and chart/dashboard variants with responsive rendering | Initial workbench verified; complete dashboard parity missing |
| Profile | view/update account information, password change, avatar upload/crop, roles/posts/department display | Verified API and React/crop page, no-grant real browser flow, bitmap equality, keyboard/mobile and implementation CI; see evidence below |
| Users | department tree, filtering/date range, pagination, column controls, selection, create/edit/delete/bulk delete, status confirmation, password reset, role assignment, XLSX export, template/download/import with optional updates, account uniqueness and data scope | Administration page and XLS/XLSX import implemented; local security, persistence and browser verification passed; implementation CI passed. Personal profile now has a separate verified page checkpoint; shared dictionary controls remain pending |
| Roles | filtering, CRUD, status, menu/button grants with parent/child selection, data-scope modes and department selection, allocated/unallocated users and batch assignment/cancellation, export | Canonical API/generated client verified locally, including five real scope modes and immediate session revocation; React page and interactive trees pending |
| Departments | hierarchical CRUD, hide/expand rows, parent selection excluding descendants, sort updates, deletion protection, data-scope enforcement | Verified; controller/security tests, real hierarchy/data-scope fixture and live browser tree/CRUD/sort tests; implementation CI passed (see evidence below) |
| Posts | filters, pagination, columns, selection, create/edit/delete/bulk delete, uniqueness, assigned-user deletion protection, export | Implemented; Maven controller/security tests, live browser CRUD/paging/download tests and disposable database checks; see evidence below |
| Navigation/menu administration | tree CRUD, GROUP/ROUTE/EXTERNAL/function identities, permission and icon selection, parent selection, visibility/status/sort, route binding validation, role menu tree | Missing |
| Dictionaries | type and data CRUD, type options, detail navigation, filters/pagination, sort/default/status/style tags, cache refresh, exports | Missing |
| Configuration | filters/CRUD, built-in entry protection, typed key lookup, cache refresh, export | Missing |
| Notices | rich text, type/status/CRUD, pagination/filtering, top notice feed, unread/read/all-read behavior | Missing |
| Operation logs | filters/date range/pagination, detail request/response/status, selection/delete/clear/export | Missing |
| Login logs | filters/date range/pagination, failure/success details, unlock locked login account, selection/delete/clear/export | Missing |
| Online sessions | username/IP filters, active session list, force logout with real Redis revocation | Missing |
| Scheduled jobs | filters/CRUD, invocation validation, enable/disable, run once, details, cron expression editor, logs/filter/detail/delete/clear/export | Missing |
| Server monitoring | CPU/memory/JVM/disk/host data, loading/error states and refresh | Missing |
| Cache monitoring | Redis info/command statistics, names/keys/value lookup, per-key/per-name/all clear with confirmations and permissions | Missing |
| Connection pool/API consoles | authenticated Druid and API documentation entry and errors; disabled console behavior; never anonymous production access | Missing UI; production defaults already hardened |
| Code generator | DB tables search/import/create, metadata editing, field/query/form/list configuration, tree/main-subtable modes, sync, preview, delete, download and custom output, generated API/routes/pages and reproducible validation | Missing React output and UI |
| Online form builder | drag/reorder/configure fields and layouts, field-specific controls, preview, code-type choice, generated code/download/copy, tree/icon configuration | Missing |
| Shared controls | dictionary tags, paging, reset/date ranges, toolbar column/search toggle, image/file upload and preview, rich editor, icon picker, cron editor, keyboard/focus and empty/loading/error/retry states | Missing complete parity |

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

Posts and departments have verified implementation checkpoints. The next slices
cover users, roles and the remaining groups. All groups remain in scope.

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
matches the contract exactly and generated clients are reproducible. CI results
will be recorded after pushing this checkpoint. React role forms, linked tree
controls, scope dialog, user-allocation page and their browser tests remain
pending; neither role frontend parity nor the full objective is complete.
