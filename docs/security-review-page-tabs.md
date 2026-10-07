# Page tabs and retained reads review

## Implemented scope
PageWorkspace matches compiled EForge route declarations and current permissions.
Components never come from backend strings. Visits deduplicate concrete paths and
retain the latest query/hash. The authorized dashboard is affixed. Actual controls
support close/current/others/left/right/all, middle-click, refresh by remount,
dropdown/context positioning, keyboard focus, horizontal scroll and fullscreen/Escape.

The pinned React19.2 Activity public API preserves cached state and stops hidden
effects; uncached pages unmount. Native ResourceDialog cleanup removes hidden
top-layer dialogs. Primary reference: https://react.dev/reference/react/Activity.
useRetainedRead is integrated into twelve reads across eleven built-in resource/
profile files: identical completed inputs preserve fetched state and selection;
interrupted or changed filter/page/sort/version inputs execute again. Completion
tickets ignore superseded operations. Explicit refresh still reloads/remounts.
Resource close buttons remove their actual tag/cache before opening the parent.

Account ID/username, roles, permissions or navigation changes remount the workspace.
A display-name-only profile refresh preserves its form and save acknowledgement.
Logout, expiry and restoration unmount retained pages. Backend authorization is
authoritative for every operation; historical cached data does not grant SQL access.
The real withdrawal test checks list403 and then an independently authorized
self-profile save triggers actual bootstrap refresh. Removed route DOM/tags, other
draft invalidation and logout are checked in the same member document.

Remembered tags are optional and scoped by exact bootstrap account ID. Storage
contains only links, never tokens, forms, records, permissions or React objects.
Restore revalidates compiled internal paths and current grants; malformed/external/
missing routes are ignored and titles/cache metadata rebuilt. Opt-out removes the
record. Storage failures do not prevent normal navigation.

## Failure and repair evidence
- page-tabs-selection-before.log:18 passed, completed selection failed on resume.
  After retained-read integration page-tabs-selection-after.log passes all19.
- page-tabs-full-before-runtime.log (20907):45/52. Hidden-label ambiguity,
  header stacking blocking notice/logout-race refresh, and profile remount were
  repaired in actual product code/visible-page test locators.
- page-tabs-second-before-runtime.log (66820):50/52. Original notice, logout,
  dictionaries and profile save/close pass. Remaining task statistics text is
  scoped to the visible page. The other test attempted an editor whose options
  permission had been withdrawn; cleanup masked the denied-editor locator error.
  This was not an infrastructure failure or a backend authorization regression.
- page-tabs-withdrawal-disabled-runtime.log (24921):both actual tab cases and
  complete disposable MySQL/Redis API regression terminal success. The permitted
  profile write proves real bootstrap withdrawal and eviction without reload.
- 19212 passes13 targeted mocked page/profile/notice cases, including save feedback
  and closing/remounting the profile with no retained password draft.
- page-tabs-strict-mode-before-frontend.log (63431):lint/typecheck/reproduction,
  98 units and build pass;82/83 browsers. A newly added request-count assertion
  assumed one incomplete read. Actual app/main.tsx uses StrictMode. The repaired
  test proves a successful new HTTP read after abort, then exact zero new reads
  and preserved selection after a completed read is hidden/restored.
- 59451 never ran a browser: Windows npm interpreted a pipe in a filter argument.
  Subsequent whole suites avoid that invocation issue.

## Final local evidence and exact cloud acceptance
47449 ended0:final lint/typecheck/reproduction/all83 mocked browsers, then
both52 full framework browser profiles and both complete disposable MySQL/Redis/
Quartz/OSHI/ACL/permission/session/captcha/API regressions are terminal PASS.
The two live OpenAPI snapshots exactly match contract
SHA25665642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
98 units/build passed on the same production source in63431. Backend source/jar
remains accepted71a53e1 with619 Maven including10scope; no Java change was made.
After the two real profiles completed, only the interrupted-read fixture was
strengthened:it refreshes an already completed list and matches the exact captured
request's abort after navigation, avoiding an initial StrictMode cleanup false
positive.71098 ends0 with lint/typecheck and all83 mocked browsers. No production
source changed after the two full real profiles.
Actual desktop screenshot live-admin-dashboard.png was visually inspected:
authorized affixed home, scroll controls, context/refresh and opt-in persistence
render without header overlap. Mobile/fullscreen/keyboard behavior is exercised
by browser assertions.

Exact5cfa35ab5b5322d749ef5234d84371572e5e2d55 cloud server37562002947 all three jobs and web37562002771 are terminal SUCCESS. Direct page-tabs-cloud-accepted-server/web.log proves both52 framework browsers, native/generated Boot regressions, both exact committed OpenAPI gates,98 units and83 mocked browsers. This evidence covers committed5cfa35a only, not the later dictionary action patch. This stage changes no Quartz runtime, SQL
mutations, templates or API contracts. Generated installed-page selection and
additional resource/action/embedded/monitor lifecycle fidelity remain separate
verification. Sidebar collapse/topnav/settings and final capability audit remain
open. This accepts the listed local tab/read flows, not the full shell or goal.
Form builder remains deferred; the specific rejected Quartz runtime plan remains denied.