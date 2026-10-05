# API Contract

## Goals

- make the frontend/backend boundary explicit
- generate TypeScript clients from OpenAPI
- isolate RuoYi compatibility objects
- use HTTP semantics for new APIs
- provide predictable paging and error behavior

## Canonical API namespace

New framework APIs use:

```text
/api/v1/**
```

Legacy RuoYi endpoints may remain temporarily during migration but are not the target contract for new React features.

## Resource responses

New resource endpoints return concrete DTOs rather than a generic success envelope.

Example:

```http
GET /api/v1/system/users/1
200 OK
Content-Type: application/json
```

```json
{
  "id": "1",
  "username": "admin",
  "displayName": "Administrator"
}
```

Create/update/delete endpoints should use standard HTTP statuses where practical.

## Page response

`/api/v1/system/departments` returns scoped flat `DepartmentResponse[]` for the
client's hierarchy projection. Name/status filters and optional `excludeId`
preserve scoped roots while excluding an edited subtree from parent choices.
GET `/{id}`, POST (201/Location), PUT `/{id}`, DELETE `/{id}` (204), and PUT `/sort`
(`{items: [{id, sort}]}`, 204) reuse the original department permissions and data
scope. Sort batches contain 1–1000 distinct string IDs and are checked completely
before mutation. Parent cycles and protected/duplicate/disabled-parent operations
return explicit 409 problems; missing resources return 404 and scope denial 403.

The first canonical resource is `/api/v1/system/posts`: GET lists typed pages,
GET `/{id}` reads a post, POST returns 201 with Location, PUT `/{id}` updates,
DELETE accepts `{ids: string[]}` and returns 204, and POST `/export` downloads a
filtered XLSX workbook. Identifiers remain decimal strings in requests/responses
to preserve 64-bit database identities. Pages are one-based (size 1–100), bulk
deletion accepts 1–100 IDs, and filters are code/name/status. Ordering is stable
by post sort and ID. Duplicate and assigned-user conflicts return 409, missing
rows return 404, and invalid input returns 400 ProblemDetail. Existing backend
permissions remain authoritative for every operation.

Paged endpoints return:

```ts
interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Example:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

During migration:

```text
TableDataInfo.rows  → items
TableDataInfo.total → total
request.pageNum     → page
request.pageSize    → pageSize
```

## Error model

Use Spring `ProblemDetail` / RFC 7807 for canonical `/api/v1` errors.

Example:

```http
400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "https://eforge.dev/problems/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more request fields are invalid.",
  "instance": "/api/v1/system/users",
  "code": "VALIDATION_ERROR",
  "traceId": "..."
}
```

Production responses must not expose stack traces, SQL, secrets, or internal exception class names.

## Legacy compatibility

RuoYi types are migration-only:

```text
AjaxResult
TableDataInfo
```

Rules:

- legacy controllers may continue returning them during Phase 1
- new `/api/v1` controllers do not
- React features target `/api/v1` when an equivalent endpoint exists
- compatibility adapters are deleted after migration coverage is complete

## OpenAPI rules

- `/api/v1` is the canonical OpenAPI surface
- public request/response bodies use concrete DTO classes
- generated TypeScript code lives under `web/generated/`
- generated files are never manually edited
- application/query adapters may wrap generated clients
- internal/operational endpoints must be explicitly separated from public app APIs

## Authentication

Canonical application startup:

```text
POST /api/v1/auth/login
        ↓
token
        ↓
GET /api/v1/app/bootstrap
        ↓
user + roles + permissions + navigation
```

Generated clients do not own token persistence.

The web integration layer supplies the authorization header from EForge auth state.

## Contract compatibility

Role administration uses `/api/v1/system/roles`: typed filtered/date-ranged
pages, detail with raw and linked-tree checked menu keys, scoped menu/department
options, create (201), edit/status/data-scope (204), delete batch (204), scoped
assigned/unassigned user pages, idempotent user assignment/cancellation (204),
and filtered binary XLSX export. Menu grant identities are stable `menu_key`
values; no database component strings or fictitious routes cross the boundary.
Scope modes 1–5 reuse the original data-scope algorithm; only custom mode 2
accepts selected department IDs. All target objects in a batch are checked
before writes. Role changes refresh affected existing Redis sessions after
commit, including fresh scope metadata and active permissions. See
`docs/security-review-roles-v1.md` for guards and consistency limitations.
The generated TypeScript client includes these contracts. The React role page
and internal user-authorization route consume them. Editors preserve exact raw
associations for unchanged selections/linking-only edits; explicit tree selection
changes submit full/half-checked keys. Validation evidence is tracked in the
frontend parity inventory, separately from shared dictionary integration.

Authenticated self-service contracts live under `/api/v1/me`: GET returns a
safe concrete profile with department, role/post labels, creation date and local
avatar URL; PUT accepts only displayName, required phone/email and sex and returns
204. PUT `/password` accepts write-only oldPassword/newPassword, checks the fresh
database hash, rejects an unchanged password (409) or wrong old password (400),
and returns 204. POST `/avatar` consumes multipart `file` and returns avatarUrl
after decoded raster validation and normalization. All IDs come from the current
authenticated session; administration permissions are unnecessary. Disabled or
deleted accounts return 401 and revoke the current session. The React profile
page and crop flow have passed local fixture/live browser and keyboard/mobile
validation; implementation CI is tracked in the parity inventory.

User administration core contracts now live at `/api/v1/system/users`: typed
page/filter results, scoped departments/editor options, concrete detail/role/post
identifiers, create with separate write-only password, profile update, delete
batch, status/password/role operations and filtered XLSX export. IDs remain
decimal strings. Editor options use `Cache-Control: no-store` for the original
configured initial-password behavior; account/detail responses contain no hash.
POST `/import` consumes multipart `file` and optional boolean
`updateExisting` (default false), returning typed total/created/updated/failed
counts and per-row ordinal, username, outcome and safe failure code. Non-empty
XLS/XLSX files are limited to 10 MB and 1000 data rows. Successful rows commit
independently; overwrite preserves existing department, grants and password.
New rows use the configured initial password with BCrypt and receive no implicit
role/post grants. POST `/import-template` returns the original binary XLSX
template. Both operations require import permission. The React administration
page consumes generated contracts. Personal-profile APIs now have a separate checkpoint;
this administration checkpoint does not establish full user capability parity.

Breaking changes to `/api/v1` require either:

- an additive backward-compatible migration, or
- a new versioned endpoint/namespace

Do not silently change generated-client contracts.

## Menu administration

`/api/v1/system/menus` provides concrete flat menu reads with name/status/visibility
filters, scoped parent options, registered navigation-route options, detail,
201 creation, 204 update/delete and atomic batch sort. GROUP/ROUTE/EXTERNAL/FUNCTION
are explicit types; IDs are strings and stable keys cannot be silently renamed.
Only ROUTE nodes bind actual registered IDs with matching backend permissions.
Existing unimplemented legacy route rows may retain null bindings. The boot
artifact packages the exact web navigation route contract; internal profile and
allocation routes are excluded. No database component expressions are accepted
or returned. Query/cache metadata stays data behind the compatibility boundary.
Writes enforce original operation permissions, active-role object grants,
hierarchy/depth constraints, identity/name uniqueness and child/role deletion
protection. Menu permission/status changes refresh affected existing sessions
after commit with preserved TTL. See ADR-0013 and the explicit menu security
review for privilege boundaries and the separate Redis consistency limitation.
This API checkpoint does not establish React menu page or full shell parity.

## Dictionaries

`/api/v1/system/dictionaries` provides typed filtered paging, detail, create/update,
atomic batch deletion, authenticated type options/consumer lookup, XLSX export
and cache refresh. `/api/v1/system/dictionary-entries` provides typed paging for
a concrete dictionary ID, detail, create/update, atomic batch deletion and XLSX.
Management permissions match upstream; consumer option/value reads require a
session without dictionary-management grants. Lookup exposes only presentation
data, never management audit metadata. Values/default flags may repeat as upstream
allows; active entries remain visible even for a disabled type.

Type rename cascades data references and invalidates old/new Redis keys. Redis
invalidation failure rolls back canonical database mutations. Canonical consumer
reads use current DB rows rather than trusting a potentially stale legacy cache;
compatibility concurrency and partial cache-refresh limits are documented in
`docs/security-review-dictionaries-v1.md`. V013 enforces type-code uniqueness.
The API/client checkpoint does not establish dictionary React/shared-control parity.

## Parameter configurations

`/api/v1/system/configurations` provides concrete filtered paging and detail,
201 creation with Location, 204 update/atomic batch deletion/cache refresh,
filtered XLSX export and login-only `/lookup?key=...` consumer reads. Management
permissions retain upstream `system:config:*`; unknown keys return an empty
value. Unicode keys are query data, and IDs remain exact decimal strings.
Builtin flags stay editable; builtin rows cannot be deleted. Every batch member
is checked before mutation. V015 enforces config_key uniqueness in MySQL.

Canonical mutations and compatibility policy reads share the root transaction
mutex. Policy reads obtain committed database values and overwrite stale cache
entries. Redis invalidation failure returns 503 and rolls back database writes;
refresh may partially repopulate Redis and can be retried. Legacy writer limits
and the additional database/lock cost for policy reads are documented in
`docs/security-review-configurations-v1.md`. Parameter values retain upstream
authenticated consumer visibility. The configuration React page and route are
separate required acceptance work.

## Notices and read state

`/api/v1/system/notices` exposes typed paging/detail, 201 creation with Location,
204 update/atomic batch deletion, `/feed`, `/read` and `/{id}/readers`.
Listing/readers retain notice:list, writes retain add/edit/remove. Detail/feed
and per-user marking preserve original authenticated consumer behavior,
including known-ID detail/marking for closed notices. Actor IDs are session data.
The feed returns the newest five active notices and its unread count covers
those five. Reader identities/phones remain behind list permission.

Batch marking is idempotent; every member is checked before writes. Canonical
deletion and read-row cleanup share one database transaction. Content, status,
type and remarks can be updated, with explicit content/remark clearing. Titles
retain upstream validation; rich HTML is preserved as data. Safe editor/rendering
and complete frontend acceptance remain required, as described in
`docs/security-review-notices-v1.md`. No AjaxResult/TableDataInfo or database
mapper maps cross the canonical boundary.

`POST /api/v1/system/notices/images` accepts multipart `file` from notice:add OR
notice:edit authors, returning typed 201 `{imageUrl}` and Location. Source JPG,
PNG or SVG must be smaller than 5 MB. Raster contents are decoded with pixel
bounds and normalized to PNG. SVG is securely parsed and reconstructed as inert
local geometry/text/gradients/references; scripts, foreign content, animations,
external resources, stylesheet instructions and DOCTYPE documents are excluded.
SVG nodes/depth/attributes and expanded local references have explicit resource
budgets before DOM allocation and storage. Files use UUID names in the existing
public `/profile/upload/notices/` namespace. Malformed content returns 400
NOTICE_IMAGE_INVALID; storage failure returns 503 NOTICE_IMAGE_STORAGE_UNAVAILABLE.
Client cancellation does not imply server-side deletion of a committed upload.
The API returns no legacy common-upload wrappers or caller-controlled paths.

### Monitor operation/login logs

Canonical `/api/v1/monitor/operation-logs` and `/api/v1/monitor/login-logs`
provide typed pages, validated calendar/date/status/text filters and enum-only
server sorting. Operation detail uses the original query grant; summaries omit
request/response/error payloads. POST export preserves original XLSX fields and
filters/order while ignoring list paging. DELETE accepts `{ids: string[]}` and
returns idempotent 204 for immutable log IDs. POST clear retains existing full
clear semantics; asynchronous audit records may arrive afterwards. POST login
unlock accepts `{username: string}` and clears only Redis password retry state,
returning 204 or generic 503 LOGIN_UNLOCK_UNAVAILABLE. Original monitor grants
remain authoritative. See `docs/security-review-logs-v1.md` for mutation, payload,
sorting and compatibility boundaries. React pages and generated-client/runtime
verification are tracked separately in the parity inventory.

### Monitor online sessions

GET `/api/v1/monitor/online-sessions` returns `PageResponse<OnlineSessionResponse>`
with optional bounded page/pageSize and exact username/IP filters. It projects
opaque session UUIDs and safe metadata from Redis, skips expired sessions and
sorts cached time/UUID descending before paging. DELETE `/{id}` requires the
original force-logout grant and removes only that login cache key, returning
idempotent 204. Bearer tokens and cached credentials/grants are never exposed.
Redis enumeration/deletion faults return generic 503 ONLINE_SESSIONS_UNAVAILABLE.
The legacy endpoints remain isolated and unchanged. Security and revocation
semantics are documented in `docs/security-review-online-sessions-v1.md`.

### Server diagnostics

GET `/api/v1/monitor/server` returns concrete CPU, RAM, JVM, host and disk records
plus sampledAt, protected by the original monitor:server:list grant. The existing
OSHI probe supplies actual measurements. RAM fields explicitly use GiB and JVM
fields MiB; percentages, disk display sizes, host metadata and JVM diagnostic
strings preserve original behavior. Sampling faults return generic 503
SERVER_MONITOR_UNAVAILABLE. The legacy monitor endpoint stays unchanged.
`docs/security-review-server-monitor-v1.md` describes the privileged diagnostic
boundary. Page and browser acceptance remain tracked in the parity inventory.

### Cache diagnostics and clearing

`/api/v1/monitor/cache` exposes seven generated operations under the original
monitor:cache:list grant: GET statistics, GET `/names`, GET `/keys?name=...`, GET
`/value?name=...&key=...`, DELETE `/names/{name}`, DELETE `/keys` with a concrete
name/key body and DELETE the base for all-cache clearing. Counts/bytes use exact
decimal strings; values are diagnostic text with normalized cached JSON and a
session-credential boundary. Deletes return idempotent 204; expired values 404,
invalid namespace/key selection 400 and Redis faults generic 503. Global clearing
removes all keys in the selected database, including all authenticated sessions.
The seven legacy namespace identities and compatibility endpoints are unchanged.
`docs/security-review-cache-monitor-v1.md` records the privileged boundary and
real fault/invalidation verification; pages and final acceptance remain pending.

### Authenticated diagnostic consoles

GET `/api/v1/monitor/consoles/druid` and `/api-docs` return concrete enabled
statuses under monitor:druid:list and tool:swagger:list respectively. POST each
`/session` returns a fixed entryPath and expiresInSeconds plus a scoped HttpOnly,
SameSite=Strict, Secure-by-default cookie. Disabled issuance returns 404
CONSOLE_DISABLED; missing/revoked sessions return 401, denied grants 403 and
backend failures generic 503 CONSOLE_UNAVAILABLE. Raw Druid/Swagger/schema
resources require fresh account/grant checks and same-origin cookie evidence.
Cookies bind opaque five-minute tickets to existing Redis sessions and never
authenticate product APIs or extend login TTL. Authenticated bearer schema
export remains independent of interactive Swagger enablement. See ADR-0016.
