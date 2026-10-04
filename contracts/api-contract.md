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

Breaking changes to `/api/v1` require either:

- an additive backward-compatible migration, or
- a new versioned endpoint/namespace

Do not silently change generated-client contracts.
