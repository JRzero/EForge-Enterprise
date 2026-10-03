# ADR-0007: Versioned typed API

## Status

Accepted.

## Decision

New EForge Enterprise endpoints live under `/api/v1`.

New APIs do not return RuoYi `AjaxResult` or `TableDataInfo`.

Use concrete DTOs, HTTP status semantics, typed page results, and Spring `ProblemDetail` for errors.

## Examples

Single resource:

```http
GET /api/v1/system/users/u1
200 OK

{
  "id": "u1",
  "username": "admin",
  "displayName": "Administrator"
}
```

Paged result:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

Validation error:

```http
400 Bad Request
Content-Type: application/problem+json
```

## Migration

Legacy endpoints may remain while core modules are migrated.

```text
legacy RuoYi endpoints
AjaxResult / TableDataInfo
        ↓ temporary

/api/v1
typed DTO / PageResponse / ProblemDetail
        ↓ canonical
```

Frontend business features target `/api/v1` only once an equivalent endpoint exists.

## OpenAPI

The `/api/v1` API is the canonical source for TypeScript generation.
