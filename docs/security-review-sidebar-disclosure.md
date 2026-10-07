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