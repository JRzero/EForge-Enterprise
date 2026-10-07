# Current scope acceptance index — 2026-10-07

This index reconciles the original inventory with actual later acceptance. The
chronological checkpoints remain historical evidence; an earlier “pending” does
not override a later accepted exact source. An inventory mapping is not proof
that every source-file utility has identical semantics. The complete objective
is still incomplete.

Verifier source `22f88957653b758042eea68140c35188197b0f96` is accepted in
[server37637943620](https://github.com/JRzero/EForge-Enterprise/actions/runs/37637943620)
(all three jobs) and
[web37637943781](https://github.com/JRzero/EForge-Enterprise/actions/runs/37637943781).
Direct `calendar-xlsx-cloud-server-accepted.log` and
`calendar-xlsx-cloud-web-accepted.log` prove both62 real browser/full API profiles,
661 backend test declarations including10 data-scope cases and one existing
platform skip,98 frontend units,139 mocked browsers, generated clients and
compiled/installed generated hosts. Both live contracts equal
`CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C`.
The native dialog geometry stage is subsequent and is not covered by this SHA.

| Current capability | Actual browser/API evidence | Current boundary |
| --- | --- | --- |
| Account lifecycle | live login, registration, remember-login, password-reminders, screen-lock; verify-registration/screen-lock integration; corresponding security reviews | Accepted; real SQL password, CAPTCHA, Redis logout/revocation, no-role profile, optional credential expiry and reminder priority |
| Shell/navigation | live navigation-tools/page-tabs/menus; e2e navigation-tools/page-tabs; bootstrap-security-review and layout/navigation/sidebar reviews | Accepted named capabilities: permissions, literal query defaults, cache ownership, three navigation modes, mobile drawer, title/settings/theme/density, fullscreen, safe links, search/breadcrumbs/tabs |
| Dashboard | live/e2e dashboard; security-review-dashboard-parity | Accepted original chart variants, interactions, disposal/resizing and labelled demonstration data |
| Profile/avatar | live/e2e profile; verify-profile-integration; security-review-profile-v1/header-avatar | Accepted actual password and bitmap crop/rotation/upload, current actor and header avatar |
| User administration/import | live/e2e users; verify-users/excel-identity integration; security-review-users-v1/canonical-excel-precision | Accepted CRUD, assignments/status/reset, actual XLS/XLSX/import/template, partial outcomes, scope and exact exported IDs |
| Roles/allocation | live/e2e roles; verify-roles/excel-identity integration; security-review-roles-v1 | Accepted grants/tree linking, department scope, allocated/unallocated batch users, SQL/Redis withdrawal and exact XLSX |
| Departments/posts | live/e2e departments/posts; corresponding integration scripts/reviews | Accepted tree/reparent/sort/deletion protection and post paging/bulk/uniqueness/export |
| Menu administration | live/e2e menus; verify-menus integration; security-review-menus-v1/navigation-metadata | Accepted stable GROUP/ROUTE/EXTERNAL identities, icons, ordering, scoped parents and exact query/cache projection |
| Dictionary types/data | live/e2e dictionaries; verify-dictionaries integration; dictionary API/cached-action reviews | Accepted full paging/preview/export, compatibility keys/styles, original invalidation, read cancellation and owned pending-write recovery |
| Configuration | live/e2e configurations; verify-configurations integration; configuration review | Accepted typed key/cache behavior, built-in deletion protection, rename/duplicates/dates/paging/bulk/XLSX |
| Notices | live/e2e notices; verify-notices/notice-images integration; notices/rich-text-cached-upload reviews | Accepted actual JPG/PNG/static SVG, inert rich content, retained upload/cursor, newest five/readers and actor-isolated read state |
| Operation/login logs | live/e2e logs; verify-logs integration; logs review | Accepted actual audit payload, safe JSON/copy, sorting/calendar/paging/deletion/clear/XLSX and real Redis password unlock |
| Online sessions | live/e2e online-sessions; verify-online-sessions integration; online/cached-monitor reviews | Accepted scoped filters, twelve-session paging, exact revocation and own force-logout |
| Task reads/logs/Cron editor | live/e2e jobs/cron-editor; verify-job-logs integration; job-read/pages/log/calendar/cron/cached-action reviews | Accepted read/detail/sort/export, real Quartz success/failure logs, date boundaries/DST and actual special Cron preview. **Task mutations remain unimplemented** |
| Server/cache monitoring | live/e2e server-monitor/cache-monitor; corresponding integration scripts/reviews | Accepted actual OSHI/Redis values, thresholds, charts, all clearing levels/session isolation/SQL retention and retained read/retry behavior |
| Native consoles | live/e2e consoles; verify-consoles integration; diagnostic/cached-session/viewport reviews | Accepted both default-disabled and enabled Druid/Swagger, original authenticated HTML/resources/actions, viewport, expiry/revocation/logout and production defaults |
| Generator management/output | live/e2e generator; generator integration scripts; manager/creation/sync/canonical/custom-output reviews | Accepted read/import/create/config/delete/sync, immutable preview/ZIP, guarded custom files, permissions, physical partial DDL reporting and retained original rows |
| Generated business pages | verify-generated-business-integration and verify-generator-react-browser/pages; controls/required/automatic/String-key/calendar reviews | Accepted compiled installed CRUD/tree/sub, root/child controls/uploads, readonly/write phases, auto/String keys, exact IDs/decimal/XLSX and UTC/Shanghai/NewYork insert/refill/edit/DST |
| Shared controls | named real editors plus e2e control regressions; dictionary/upload/editor/icon/Cron ownership reviews | Existing controls accepted by actual uses. Original registered dialog move/width/corner facilities were separately discovered; new implementation currently awaits its own aggregate and precise-cloud acceptance |
| Online form builder | original inventory preserved | User-deferred; excluded from current development/acceptance and never marked implemented |

All19 original API modules now have an operation-level current acceptance entry
in `ruoyi-frontend-parity.json`. The five task mutation operations are explicitly
pending: `addJob`, `updateJob`, `delJob`, `changeJobStatus`, `runJob`. Task-log
operations are independently accepted and are not incorrectly held incomplete
because task CRUD is pending. Historical source/operation lists are unchanged.

Remaining active work is the independent shared-dialog stage, final reconciliation
of its acceptance with the source inventory, and canonical task mutation APIs,
invocation whitelist, database/Quartz fault/concurrency consistency, generated
client and create/edit/status/run/delete controls integrating the Cron editor.
The specific execution-gated runtime proposal was rejected by automatic approval
review because it can delay/block dispatch under slow or unavailable SQL. It has
not been implemented or retried equivalently; explicit approval remains pending
in [proposed-task-mutation-boundary.md](proposed-task-mutation-boundary.md).

Local generated1545 and framework default40541/sequential-enabled38045 completed
successfully. The failed same-root parallel enabled run is retained; generated
route fixture writes trigger host HMR and invalidate concurrent framework frozen
browser evidence. Run them sequentially in one checkout or in separate worktrees.
Cloud observer2948 and resumed20097 both ended on GitHub API unexpected EOF;
authoritative terminal jobs and direct logs establish actual success, not their
observer exit codes. Earlier actual password-focus and viewport failures remain
recorded in their reviews and were superseded by corrected-source acceptance.
