# Task and log actions under retained page tabs

## Request ownership
The frontend action slot records whether its current request is an export or a
mutation. Hiding a cached Activity cancels only the export. Activation consumes
that cancelled export and releases its busy state; a new export is sent only
after an explicit user click. Completed actions retire only their own controller.

Already-sent log delete/clear requests stay pending across Activity hiding and
browser history navigation. The confirmation stays locked until that request
settles, then displays its actual result and refreshes the list. No automatic
mutation retry, scheduler lock, execution check, Java/SQL contract or permission
change is introduced. Closing a page does not manufacture cancellation/rollback
of a server write; backend authorization and transaction handling remain decisive.

## Actual failure/repair
page-cache-jobs-export-before.log:4 original browsers pass; both task and log
exports fail to become enabled after their exact captured GET is aborted.
page-cache-jobs-actions-before.log:4 pass/4 fail. The two additional history
cases prove actual net::ERR_ABORTED for sent delete/clear requests. This is a
product lifecycle failure, not a hosted-runner problem.

page-cache-jobs-actions-after.log:lint/typecheck and23 related browsers pass.
The four new cases prove explicit export retry, exactly two reads including the
cancelled request, and one non-aborted locked write whose eventual acknowledgement
closes its dialog and refreshes the list. Existing dictionary ownership and tab
tests remain green.

page-cache-jobs-final-frontend.log is terminal success:lint/typecheck/reproducible
client,98 unit tests, production build and89 mocked browsers.

## Real environment acceptance
Process99088 runs the default then enabled complete API/browser profiles.
The original real Quartz test now gates request delivery without substituting
HTTP responses. It proves both exact export cancellations and genuine later XLSX
content, plus history navigation while actual delete/clear delivery is pending.
Both writes must return genuine204 once; existing SQL404/zero-row, sorted export,
exact IDs, paging and inert-detail assertions remain intact.

Process99088 ended0. Both default and enabled profiles pass53 real browsers and their complete MySQL/Redis/Quartz/OSHI/ACL/permission/session/captcha/API regressions. Direct page-cache-jobs-disabled-runtime.log and page-cache-jobs-enabled-runtime.log are terminal PASS. Both live OpenAPI snapshots exactly match contract SHA25665642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC. Backend source/jar remains unchanged from the accepted619-test source. Exact cloud acceptance for this patch is pending. Separate4349cd3 dictionary stage cloud does
not validate these later job-page changes.

## Remaining scope
Generated-page cache/selection and file-upload/action lifecycle, other retained
resource/monitor/embedded behavior, sidebar/topnav/settings and the final active
capability audit remain open. Form builder is deferred. The specifically rejected
Quartz runtime proposal remains unchanged and denied.