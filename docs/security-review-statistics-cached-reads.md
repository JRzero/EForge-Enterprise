# Retained server and Redis statistics reads

## Scope
ServerMonitorPage and CacheStatisticsPage previously cleared completed data on
actual cached Activity tab return. Two actual App/StrictMode cases fail before
this source change with subsequent GETs held. The same cases pass after it.
Each page now owns one completed-read ticket keyed by API and explicit refresh
version. Successful or displayed failed reads complete their own ticket; aborted
sampling never does. Tab return preserves completed state, while interrupted
sampling restarts and refresh/retry still reaches the real service. Backend
permissions, polling policy, OSHI/Redis sampling, warning thresholds, binary
units, safe text, charts and controls are unchanged. No console credential or
mutation lifecycle behavior is accepted by this patch.

## Evidence to date
- statistics-cached-reads-before-browser.log:2 completed-return cases failed
  before the product patch, not merely a synthetic hook test.
- statistics-cached-reads-targeted.log:lint/types and all17 scoped mocked cases
  pass, including original loading/failure/retry/denial/abort/safe text/mobile
  and chart keyboard/resize behavior plus actual completed cached return.
- statistics-cached-reads-final-frontend.log:repro/lint/types/98 units/build and
  all95 mocked browsers pass on the final product source.
- statistics-cached-reads-focused-runtime.log:first real run is8passed/1failed.
  Actual Redis retained graph/counter/keyboard/abort/refresh passes. Server failed
  at a test locator, before return/refresh assertions:the seeded SQL menu label
  is 服务监控; the test mistakenly used its page title 服务器监控 as the tag label.
  The rendered error-context proves 页面标签：服务监控. Only that real test locator
  was corrected; no label, seed, timeout, product code or functional assertion
  was changed or relaxed.
- statistics-cached-reads-final-static.log:lint/types of the final actual tests
  pass. The product source is unchanged since the complete95-case frontend run.

- statistics-cached-reads-focused-final-runtime.log:corrected focused9 genuine
  browsers passed in27.1s; actual server sampling and Redis retained state,
  precise abort/recovery, explicit refresh and chart keyboard interaction pass.

## Final local acceptance; exact cloud pending
Unique sequential authority72134 ended0:corrected focused9 genuine browsers and
complete API, default57 and enabled-console/custom-output57 genuine framework
browsers and complete API all pass. Final logs are
statistics-cached-reads-focused-final-runtime.log,
statistics-cached-reads-disabled-runtime.log and
statistics-cached-reads-enabled-runtime.log. MySQL/Redis/Quartz/OSHI/ACL, captcha,
permissions/revocation, real SQL faults/rollback and exact owned data retention
are verified. Both live contracts and the repository contract have exact SHA256
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.

Exact new-source cloud acceptance is pending. The unchanged Java backend has619
existing declarations/618 locally applicable tests; no fresh local Maven run is
claimed here. The preceding947f706 source server37577784305 all three jobs and
web37577784304 are terminal SUCCESS; accepted docs0ee6497 are pushed and its
observer28590 is terminal. That exact cloud cannot accept this new statistics
source; the new commit must pass its own cloud gates.

Remaining original active scope includes embedded console retention/expiry/
revocation, other resource/editor/action lifecycles, nested rich-image-specific
final audit, sidebar/topnav/settings and final date/timezone/XLSX/permission/data
consistency audit. Form builder is deferred-not-complete. The specific rejected
Quartz runtime proposal remains unapproved and unchanged. Full goal not complete.
### Exact source cloud acceptance — f583a38
Server 37580421117 all three jobs and web 37580420897 are terminal SUCCESS
for f583a38e7cd9d764c9480a83badcb75539ada884. Direct
statistics-cached-reads-cloud-accepted-server/web.log confirms both profiles of
57 actual framework browsers and complete runtime API regressions, exact live
OpenAPI checks, 98 unit and 95 mocked browsers, and backend 619 declarations
including all 10 data-scope cases with one platform-specific skip. The unique
observer49937 is terminal0. This accepts the statistics-read phase only;
embedded consoles and the remaining active capability audit are unfinished.