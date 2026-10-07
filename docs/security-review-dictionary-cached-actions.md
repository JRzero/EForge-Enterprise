# Dictionary action lifecycle under retained page tabs

## Scope and ownership
This follow-up changes only the dictionary editor GET lifecycle. Hiding a cached
React Activity cancels its editor read; restoring the page clears the cancelled
read's busy state so the user can explicitly retry. It does not automatically
retry writes or change Quartz, SQL, authorization or canonical contracts.

A normally completed editor read retires its own controller. This prevents a
later hide/show cycle from aborting an old controller and falsely unlocking an
unrelated cache-refresh POST that is still pending. An aborted read keeps its
controller until activation consumes that cancellation. Existing write locks
and completion feedback remain owned by their actual operation.

## Reproduced failures and targeted repair
page-cache-editor-interruption-before.log: five cases passed; actual cancelled
editor GET left the modify control disabled after returning to its cached tab.
page-cache-editor-interruption-after.log: fifteen targeted browsers passed.

page-cache-operation-owner-before.log: six passed, one failed. After a completed
editor GET, a separately pending cache POST incorrectly became enabled on tab
restoration. Retiring the completed GET controller repairs this ownership issue.
page-cache-operation-owner-after.log: lint/typecheck and all sixteen targeted
dictionary/tab/profile browsers passed, including both cancellation recovery
and exactly one still-locked pending mutation.

The real browser case forwards genuine requests to the disposable backend.
Only request delivery is gated: the first GET is cancelled by tab navigation;
the next genuine GET returns200 with the original dictionary detail. A cache
POST stays locked while switching tabs, then is delivered once and returns204.
No mocked response substitutes for either successful backend response.

## Acceptance boundary
page-cache-owner-final-frontend.log is terminal success: reproducible generated client, lint/typecheck,98 unit tests, production build and85 mocked browsers. Sequential process43066 ended0: default and enabled profiles each pass53 actual browser cases and their complete MySQL/Redis/Quartz/OSHI/ACL/permission/session/captcha/API regressions. Logs page-cache-owner-disabled-runtime.log and page-cache-owner-enabled-runtime.log are terminal PASS. Both live OpenAPI snapshots exactly match the committed contract SHA25665642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC. Backend source/jar remains unchanged from the accepted619-test source. Exact cloud for this patch is pending.
Previous exact5cfa35a page-tab cloud evidence does not validate this source patch.
Additional resource actions, generated-page cache fidelity, monitor/embedded
lifecycle, sidebar/topnav/settings and the final capability audit remain open.
Form builder is deferred, not completed. The rejected Quartz runtime proposal
remains untouched.