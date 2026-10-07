# Sidebar disclosure fidelity — verification in progress

Original behavior reference: yangzongzhuan/RuoYi-Vue frontend v3.9.2,
0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0, Sidebar/index.vue and SidebarItem.vue.
This changes product navigation, not backend authorization or either pinned
architecture baseline. It consumes the existing pinned EForge AppShell.

GROUP items now have native keyboard-operable disclosure buttons and never
acquire a route or href. Stable menu keys own the open choice at each recursive
level; one sibling group opens at a time. A route transition expands matching
ancestry, while returning to dashboard preserves the previous expanded menu.
Users can close an active ancestry manually without navigating. ROUTE parents
keep their actual links and have a separate child-menu toggle. Children remain
behind the native hidden attribute and cannot receive keyboard focus when hidden.
Static SVG icons use the existing allowlist; backend strings never resolve React
components. Literal labels, credential-less http(s) external links and modifier
click handling are retained. Unauthorized projected nodes remain absent.

Evidence: sidebar-disclosure-before.log fails on the old missing GROUP button.
The first complete mocked run found an actual regression: dashboard navigation
closed previously expanded cache navigation. The current implementation preserves
that choice; sidebar-disclosure-final105-mocked.log has105 passing browser tests.
The other failure was a new fixture using an incomplete accessible external-link
name: the actual name also contains the existing new-window announcement. Its
assertion now uses the complete name and retains the noopener/noreferrer check.
Tests cover keyboard disclosure, nested sibling isolation, route ancestry on
reload, absence of fake GROUP links, approved icon URLs and original query/error,
search, permission, external-link and cached-resource regressions.

Final frontend lint/typecheck/generated-client reproducibility,98 unit tests and
build passed in authority1894. The actual SQL bootstrap navigation tests now
verify GROUP keyboard behavior and sibling isolation, and explicitly disclose
system management before following its SQL-configured role query link.
Initial authority1393 terminated1 with55 real tests passing and two old
page-tabs fixtures failing: both tried to click a child before expanding its
GROUP. The actual snapshot shows the collapsed system management button.
The helper now conditionally opens that GROUP without changing permissions,
timeouts or cached-state/SQL-restore assertions.1393 cleaned its owned resources.
Final authority80422 sequentially runs consoles/custom-output enabled and
default profiles. Its results are pending: do not claim real
or cloud acceptance yet. Java has not changed and no package was run with a live
application. Scope-sensitive APIs, business rows and Quartz runtime remain intact.

This is the GROUP disclosure part of sidebar fidelity, not a completed sidebar
or full frontend. Desktop collapse/popups, mobile drawer and breakpoint/focus,
left/mixed/top navigation, density/theme/layout persistence and the remaining
original capability audit still require actual implementation and verification.
Form builder is deferred, not complete. The specific denied Quartz mutation
scheme remains outside this change.
Additional generated-page audit (2026-10-07): exact12ec001 cloud server
37589941244 verify failed in actual generated React browser verification;
runtime and auth-runtime succeeded, web37589941214 succeeded. Initial Installed
entry needs its original system-tools GROUP opened, now included in the fixture.
Focused actual authority66817 then exposed a product defect on returning from
personal center: prefix matching treated /user/profile as a child of /user and
switched the open GROUP, hiding the installed business menu. It terminated1 and
cleaned its own environment. This is not an infrastructure failure.

Navigation now uses exact routes plus the pinned getRouteAncestry explicit parent
chain supplied by Application. Personal center has no user-management parent;
real role-user/dictionary/job child routes retain their declared ancestors.
sidebar-ancestry-prefix-before.log proves the original wrong-group result;
sidebar-ancestry-prefix-final.log proves personal center and actual parameter
child ancestry both pass. Final generated authority99065 and full mocked/static
13417 are active. New source remains uncommitted pending verification;12ec001
cloud is failed, not accepted. Original80422 both57/fullAPI/hash success remains
valid only for its original source and does not accept this newer product fix.

Mobile implementation is isolated in managed sidebar-responsive worktree on
codex/sidebar-responsive at12ec001 base; it does not affect main live verification.
It is actual Application/EnterpriseShell integration with original991/992px
breakpoint, native modal, route/account/resize dismissal, static menu projection,
Tab boundary loop, Escape/backdrop focus restore, body scroll restoration and
brand.106 mocked browsers passed before the final brand/body small addition;
final focused mobile test also passed. It is not merged or real/cloud accepted.
Its earlier native focus and old phone-cache entry failures remain evidence;
assertions were retained while actual focus and phone menu steps were fixed.
Explicit ancestry fix must be incorporated before final mobile acceptance.
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