# ADR-0002: Front/back API contract

## Status

Accepted.

## Decision

RuoYi transport objects are implementation details of the server compatibility layer.

React business code does not consume `AjaxResult` or `TableDataInfo` directly.

Use OpenAPI as the canonical contract source and generate TypeScript client types/functions.

## Boundary

```text
Controller → OpenAPI → generated TS client → adapter/query → page
```

## Rationale

This prevents the frontend from being permanently coupled to legacy response wrappers and removes duplicated hand-written DTOs.

## Pagination

Application-facing shape:

```ts
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

The integration adapter may translate RuoYi `rows/total` responses during migration.
