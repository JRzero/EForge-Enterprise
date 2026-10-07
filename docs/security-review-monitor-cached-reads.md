# Cache entries and online-session retained reads

## Scope and implementation
The actual PageWorkspace Activity kept these pages mounted, but their effects
cleared completed data and reread whenever a cached page became visible. The two
actual App/StrictMode mocked cases failed before the product change.

CacheEntriesPage now owns three independent completed-read tickets for names,
keys and value. The value ticket also includes the keys refresh version. Online
sessions owns one ticket for API, applied filters, page, page size and refresh
version. A successful or displayed failed read completes its own ticket; aborted
reads never complete it. Returning to completed inputs preserves the current
state. Explicit refresh, search, reset, paging, namespace/key changes and existing
post-mutation versions still invalidate their respective inputs. No completed
request controller is reused as a mutation owner. The original permissions,
force-logout and scoped/all Redis clearing semantics are unchanged.

This accepts no new pending clear/revoke lifecycle behavior. The backend, SQL,
Redis session authentication, generated templates and shared hook are unchanged.

## Evidence and honest test failures
- monitor-cached-reads-before-browser.log: both completed-read cases failed on
  actual tab return with new GETs held, rather than fulfilled with identical data.
- monitor-cached-reads-targeted.log: lint/typecheck and all16 scoped mocked cases
  passed after the product fix.
- monitor-cached-reads-final-frontend.log: reproducibility/lint/typecheck/98 units,
  build and all93 mocked browsers passed on the final product source.
- monitor-cached-reads-final-static.log: final genuine-browser assertions pass
  lint/typecheck.
- The first filtered launcher failed before any selected browser ran because
  Windows npm.cmd interpreted the literal regex pipe as command syntax. Only the
  filtered verification branch now invokes the installed Playwright CLI through
  Node directly; the full-suite branch and disposable ownership are unchanged.
- The first online resumed-read count assertion expected two total attempts.
  monitor-cached-reads-diagnostic-runtime.log proved two ERR_ABORTED requests and
  exactly one genuine200. React StrictMode may replay interrupted effects. The
  final assertion requires exactly one successful resumed response and cancellation
  of every other observed request. Completed tab return still requires zero GETs;
  the next explicit search must add exactly one request.
- monitor-cached-reads-focused-accepted-runtime.log: all9 genuine cache/online
  browsers passed. Cache uses an owned SQL configuration warmed into actual Redis;
  completed names/keys/value and online filter draft survive tabs without GETs.
  Captured interrupted requests really abort, return reads receive genuine200,
  and explicit names/keys/value refresh plus online search reach the server.

## Final local and exact cloud acceptance
Sequential authority90787 ended0. Focused9 browsers plus complete API, default55
and enabled-console/custom-output55 browsers plus complete API all passed.
Final logs are monitor-cached-reads-focused-accepted-runtime.log,
monitor-cached-reads-disabled-runtime.log and monitor-cached-reads-enabled-runtime.log.
Real MySQL/Redis/Quartz/OSHI/ACL, permissions, role/account invalidation, SQL faults,
rollback, owned data retention, captcha and enabled console authentication pass.
Both live contracts and contracts/openapi/api-v1.json have exact SHA256
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.

Exact947f70681587d0c518ebd6506ffcb96a51b0f765 server37577784305 all three
jobs and web37577784304 are terminal SUCCESS. Direct
monitor-cached-reads-cloud-accepted-server/web.log prove both55 framework browsers,
complete API/OpenAPI gates,619 declared backend cases with10 scope cases and the
existing platform-specific skip,93 mocked browsers and98 frontend units. Real
Linux symlink protection passes; the Windows-only junction case is skipped by
its OS assumption. The existing local Windows real-junction case passed; its
symlink privilege skip must not be confused with the Linux OS-only skip.
No fresh local Maven run is claimed for this frontend-only phase. New statistics
source under separate verification is not accepted by this committed cloud.

Server/cache statistics, embedded console lifecycle, other resource/editor/action
lifecycles, nested rich-image-specific audit, sidebar/topnav/settings, date/timezone
and XLSX final audits remain open. Form builder is deferred-not-complete. The
specific rejected Quartz runtime scheme is unchanged. The complete goal remains
open.