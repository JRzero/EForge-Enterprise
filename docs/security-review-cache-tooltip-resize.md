# Cache tooltip resize race — verified local fix, cloud pending

The creation/client commit 27a26e48128eb99322b932860828e0f311fca553 passed
server-ci 37408353480 in all three jobs, including 47 Spring/MyBatis assertions
per MySQL case mode, both 43-case real browser profiles, both complete HTTP
regressions and exact live OpenAPI checks. Its web-ci 37408353499 failed the
existing mobile cache tooltip assertion; 63 other simulated browser cases passed.

The failed cloud trace shows the unnamed ECharts HTML tooltip wrapper outside
the 390px viewport after SVG resizing, with a retained 0.4-second transform
transition. ECharts refreshes tooltip position on a queued timer. A CPU-throttled
continuous desktop/mobile resize scenario with delayed zero-time timer delivery
reproduced the same DIV overflow locally at right=441.7677 before the fix.
The original DOM/scroll-width, inert command markup and exact-counter assertions
remain intact. No polling delay or overflow assertion relaxation hides the issue.

The resize callback now captures the current tooltip's series/data index, resizes
the chart, then restores that same tooltip in the resize turn. Show/hide events
track each pie/gauge independently; hidden tips are removed from the map.
Tooltip positioning has no transition, so its previous location cannot animate
across the viewport boundary. Series animation, rose/gauge shapes, safe text DOM,
exact large counters and keyboard controls remain. Maps/listeners stay within
the chart effect lifetime; observer disconnection and instance disposal retain
their cleanup path, and callbacks skip disposed instances.

The controlled test resizes through 390/1100/360/800/390 under CPU throttling and
delayed queued refresh, verifies every viewport/DOM boundary and retains the
same command/count text. It passed after the fix and eight consecutive repeats.
Full generated-client reproduction, lint/typecheck, 73 unit tests, build and
64 simulated browser tests passed on the patch. Backend source and contracts
are unchanged from the accepted 27a26e4 server source.

Local logs in server/eforge-boot/target:
- cache-tooltip-resize-gated-before-fix.log: real overflow failure.
- cache-tooltip-resize-gated-after-fix.log: the same scenario passed.
- cache-tooltip-fix-repeat.log: eight passed.
- cache-tooltip-fix-test-e2e.log: all 64 passed.
- generator-create-http-server-accepted.log: exact first server acceptance.

The fix still requires final exact-commit web and server cloud acceptance.
Generator output/UI and the overall objective remain unfinished; form builder
is explicitly deferred.
