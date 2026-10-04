# Canonical operation/login log review

Ten `/api/v1/monitor/**` operations cover typed operation/login lists,
operation detail, immutable-log batch deletion, full clear, filtered XLSX export
and login password-retry unlock. RuoYi compatibility controllers, mappers, domain
objects and their MIT attribution remain intact. Architectural baselines and
data-scope behavior are unchanged; no new schema or infrastructure is introduced.

## Authorization and projections

Original monitor:operlog:list/query/remove/export and
monitor:logininfor:list/remove/export/unlock grants are enforced by the backend.
Both lists require their list grant, including authenticated ordinary users.
Operation summaries omit raw request/response/error payloads. The original query
button grant is authoritative on the new detail endpoint, which returns those
payloads as untrusted strings. XLSX retains its original independent export grant
and original fields. The permissions authorize global audit access, as before;
this work does not introduce a new department data scope.

All identifiers are positive exact decimal strings on the API. Lists use concrete
PageResponse DTOs and bounded pages (1..1,000,000, size 1..100). Filter values are
bound mapper parameters, with original contains/status/business-type semantics.
Dates are inclusive database-calendar days, from 00:00:00 through 23:59:59; an
inverted range is a generic 400. SQL sort identifiers never come from request
strings: enum values map to fixed operator/time/duration or username/time columns
and asc/desc. A descending ID tie-breaker gives deterministic pages. PageHelper
state is cleared on success and exceptions. Export retains the same filters/order
but ignores list paging and streams the existing ExcelUtil workbook.

## Mutation and unlock boundaries

DELETE takes a validated, deduplicated list of at most 100 IDs and executes one
InnoDB delete statement. Already-missing immutable logs remain idempotent,
matching the compatibility boundary; numeric overflow is rejected before any
statement. SQL failure leaves the statement's target rows intact. Clear preserves
the existing mapper TRUNCATE behavior, including ID sequence reset. It is not
combined with another write in a transaction. Asynchronous audit events can create
new entries after a successful clear, including the clear action itself; tests
check historical rows rather than claiming a permanently empty table.

Canonical unlock uses POST with a username DTO and 204, replacing the legacy
GET side effect only on the new boundary. It invokes SysPasswordService's existing
pwd_err_cnt namespace, never session or permission keys. Missing/expired retry
state is idempotent. Redis data-access failure returns generic 503
LOGIN_UNLOCK_UNAVAILABLE, with no host/key/exception exposure. Retry is safe;
transport failure does not establish whether a command committed. Correct-password
login and existing-session survival require actual runtime evidence.

Audit annotation request/response payload capture excludes operation results;
log data is never interpolated into SQL or HTML. React details render escaped
text, format valid JSON, preserve invalid/plain text and provide real copy
feedback/failure handling. Original server-side redaction stays
unchanged. Production consoles remain protected by existing defaults.

## Verification scope

LogControllerTest covers production security filters, ten operation grants and
anonymous rejection, summary/detail separation, exact IDs, defaults/filters/dates,
five fixed sorting cases, injection/invalid values, idempotent deletion, clear,
unlock/cache failures, actual XLSX bytes and cleanup after mapper failure.
verify-logs-integration.ps1 runs only inside the owned disposable database/Redis
fixture. It checks actual records, boundary dates, paging/sort/filter projections,
untrusted detail strings, sorted complete XLSX, SQL faults, deletion/clear, all
no-role grants and five failed password attempts followed by real blocked login,
Redis TTL, DEL/UNLINK denial, retry-state clearance and successful login.
Final results, generated-client reproducibility, browser acceptance and CI belong
in the parity inventory. API preparation does not establish completed log pages.

The API checkpoint passes 280 backend cases including all 32 log/security cases
and ten unchanged data-scope cases, 56 web unit cases, 30 fixture and 27 live
browser regressions, full disposable module/runtime checks, production defaults,
exact live OpenAPI equality and generated-client reproducibility. Actual Redis
DEL/UNLINK denial returns 503 and preserves the retry count; recovery permits
correct-password login and retains the earlier valid session. Owned historical
rows disappear after clear. Existing 125 path/schema entries are semantically
unchanged. Logs are `logs-backend.log`, `logs-api-final-runtime.log` and
`logs-api-fixtures.log` under the ignored boot target directory. API commit
`5e8b350a720ef23d94424e505041f296111329e7` passes server CI `37239622151`
(all three jobs) and web CI `37239622127`. React page acceptance is a separate
checkpoint.

Page verification passes 280 backend, 56 unit, 34 fixture and 29 live browser
cases plus the full owned MySQL/Redis module/runtime suite. Real audited request
HTML is inert inside formatted JSON; real clipboard contents and complete XLSX
are checked. Last-page deletion returns to page one, and clear removes owned
historical rows. Page unlock follows actual password locking and preserves a
previous valid session. Fixture cases cover rejected clipboard access/fallback
cleanup, invalid JSON, no-grant controls, failed confirmations, request abort,
dictionary labels, keyboard and mobile behavior. Route binding changes only
the two existing ROUTE nodes; the log GROUP never becomes a React route.
Page-commit cloud verification is tracked in the parity document.
