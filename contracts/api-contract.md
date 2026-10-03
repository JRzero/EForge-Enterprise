# API Contract

## Goals

- make frontend contracts explicit
- keep RuoYi compatibility details isolated
- generate TypeScript types from OpenAPI
- support consistent error and paging behavior

## Application success response

Preferred long-term HTTP/API design uses HTTP status codes plus typed bodies.

For migration compatibility, a server adapter may still translate legacy RuoYi `code/msg/data`.

Frontend-facing conceptual type:

```ts
interface ApiResult<T> {
  data: T;
  message?: string;
}
```

## Page response

```ts
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Legacy mapping:

```text
TableDataInfo.rows  → items
TableDataInfo.total → total
request.pageNum     → page
request.pageSize    → pageSize
```

## Error model

Recommended normalized error fields:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "traceId": "..."
}
```

Do not expose stack traces or internal exception class names in production responses.

## OpenAPI rules

- every public controller endpoint must appear in OpenAPI unless intentionally internal
- request and response DTOs should be concrete classes where generation quality benefits
- generated TypeScript code lives under `web/generated/`
- generated files are not manually edited
- application adapters may wrap generated clients for pagination/auth/query convenience

## Authentication

Generated clients do not own token persistence.

EForge integration config supplies the authorization header/token through the shared HTTP/auth layer.
