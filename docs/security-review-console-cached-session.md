# Embedded console cached ownership security review

Cached console returns recreated native documents and renewed scoped tickets,
losing Druid/Swagger state. Valid native frames now survive cached navigation.
Every return hides retained HTML before paint and checks both current JWT grants
and its independent scoped cookie. No ticket POST or iframe document reload is
performed on a valid return. Expiry/revocation discards the frame; explicit
refresh/retry is required to renew an expired owner.

## Authentication and ownership boundary
Frame ownership includes API identity, target, explicit refresh version and a
unique native frame identity. Load/expiry deadlines use the original monotonic
start, never time since return. Expiry is recorded synchronously before clearing
the frame so StrictMode effect replay cannot silently reopen it. Activity cleanup
aborts only that activation's read/probe and timers; it retains established native
state. A late native load/error affects only its own frame.

The activation readiness flag is set only after JWT status, cookie-only fixed-entry
probe, owner and deadline checks succeed. Native onLoad cannot reveal HTML while
any current authentication check remains pending. A scoped native401/403 rejects
that owner without revoking the independently valid main login. Cookie probes
never contain JWT headers or token URLs, do not extend ticket lifetime, and keep
original no-store, entry allowlist, response validation, sandbox and timeout.

No Java, SQL, API contract, pinned EForge dependency or production console default
changes. Backend checks remain authoritative. The specific rejected Quartz runtime
proposal is unchanged. Form builder remains deferred, not completed.

## Reproduced failures and regression evidence
- console-cached-session-before-browser.log: original native document/input loss
  for both targets and silent hidden-expiry renewal, three actual App failures.
- console-cached-scoped-ticket-before-browser.log: a valid main JWT incorrectly
  allowed cached HTML after the independent native ticket became unusable.
- console-cached-native-gate-before-browser.log: actual iframe navigation/load
  revealed retained HTML while its scoped HTTP probe was held. This is native
  document navigation, not a synthetic load event.
- console-cached-native-gate-after-browser.log: all12 scoped fixture cases pass;
  unchanged native nonce/input, no implicit ticket/document renewal, original
  absolute expiry, held revoked/disabled checks, lost scoped ticket and genuine
  late native navigation remain protected. Original faults/retry/mobile/no-role/
  main-session expiry and native JSON-problem handling stay green.
- console-cached-native-owned-static.log: final lint/types pass.
- console-cached-native-owned-frontend.log: client reproducibility, all98 units and
  production build pass. console-cached-native-owned-mocked.log: all102 pass.

## Final local runtime acceptance
Unique sequential authority66413 ended0. Both enabled consoles/custom output and
production-default disabled profiles passed all57 genuine framework browsers and
complete MySQL/Redis/Quartz/OSHI/ACL/captcha/API/data-consistency regressions:
console-cached-native-owned-enabled-runtime.log and
console-cached-native-owned-disabled-runtime.log.

Actual native Druid login/SQL/JSON windows and Swagger authorization/Try it out are
retained. Returns preserve the exact native DOM/SQL/response state and scoped plus
JSESSIONID cookies, with no ticket POST or native document reload. The genuine
Druid SQL HTML late-navigation case holds an actual cookie-only HTTP probe,
proves HTML remains hidden after native load, then releases the real response.
Both targets separately lose only their own scoped browser cookie and observe
actual native401 with the original JWT still valid, no implicit POST and explicit
renewal. Hidden role withdrawal is verified through the universally accessible
personal-center route, actual role mutation, retained Druid tag return and denied
native/protected resources. Logout and scope isolation remain verified.

The hidden frontend deadline case advances only the frontend monotonic clock.
It is not evidence of server wall-clock expiry. The full actual servlet/API suite
separately expires its owned Redis ticket and proves native401 while the main
session remains valid and its TTL is not extended. Cookie comparisons emit only
booleans. Original trace-off and Swagger DOM-removal cleanup prevent credential
snapshots on failure.

Both actual live contracts exactly match contracts/openapi/api-v1.json:
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
No fresh local Maven run is claimed: unchanged Java has exact f583a38 acceptance
for619 declarations including all10 data-scope cases and one platform skip.
New-source cloud acceptance is pending and must pass its own three server jobs
and web checks; prior-source cloud does not accept this change.

The initial real test used PageHeader接口文档 instead of original menu系统接口.
The extra no-menu role fixture could not use a sidebar it had not been granted;
using personal center preserves that role and real cached navigation. Neither
correction changes product labels, seed, permissions, timeout or assertions.
The interrupted76679 and deliberately superseded31968 authorities are not final
acceptance. Their own process/container/directory identities were checked before
cleanup; foreign preview/business resources were preserved. Final66413 cleaned
its own disposable resources and no Boot app remains.

Full active parity remains unfinished: other editor/resource/action ownership,
nested rich-image audit, sidebar/topnav/settings, dates/timezones/XLSX and final
original-capability audit remain. Task mutations still require the specific
runtime authorization boundary. This phase is not completion of the full goal.
