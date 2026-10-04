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
