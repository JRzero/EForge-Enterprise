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