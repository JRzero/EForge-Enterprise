# Architecture Review v0.1

## Scope

Review the initial architecture before importing RuoYi backend source.

The review focuses on:

1. module granularity
2. menu/route stability
3. legacy RuoYi design decisions to preserve, wrap, or replace
4. API contract quality
5. security-sensitive migration areas
6. EForge dependency strategy

## Executive conclusion

The overall direction is sound, but five corrections are required before server import.

### 1. Use a modular monolith, not a 1:1 architectural copy of RuoYi

The initial import can retain the proven RuoYi module split to reduce migration risk, but those modules are implementation boundaries, not product/domain boundaries.

Use:

```text
server/
├─ eforge-boot
├─ eforge-common
├─ eforge-framework
├─ eforge-system
├─ eforge-generator   optional
└─ eforge-quartz      optional
```

Do not create separate Maven modules for user, role, department, menu, dictionary, etc.

Business products may later add `eforge-module-<domain>` modules only when a real module boundary is justified.

### 2. Separate navigation nodes from route registrations

The first navigation contract overloaded `routeId` for both route leaves and navigation groups. That does not model RuoYi directory nodes correctly.

Revised model:

```text
NavigationNode
├─ key                stable navigation identity
├─ type               GROUP | ROUTE | EXTERNAL
├─ routeId?           only for ROUTE
├─ children[]
├─ label
├─ order
├─ icon?
└─ externalUrl?       only for EXTERNAL
```

Only `ROUTE` nodes bind to an EForge route registry entry.

### 3. New APIs are typed APIs, not normalized legacy envelopes

`AjaxResult` and `TableDataInfo` are migration compatibility types.

New APIs under `/api/v1` use:

- concrete request/response DTOs
- HTTP status codes
- `PageResponse<T>` for page results
- RFC 7807 / Spring `ProblemDetail` for errors

This produces better OpenAPI and generated TypeScript clients.

### 4. Preserve data-scope behavior first, but classify it as security-critical legacy code

The RuoYi data-scope mechanism injects generated SQL fragments into mapper queries and contains MySQL-specific behavior such as `find_in_set`.

Do not redesign it during the initial import.

Instead:

1. pin existing behavior
2. add integration tests for all data-scope modes
3. keep backend authorization authoritative
4. redesign only after parity is proven

### 5. Harden security defaults during migration

The upstream baseline permits Swagger and Druid URLs broadly. EForge Enterprise must not ship that as the production default.

Production defaults:

- OpenAPI UI disabled or authenticated
- Druid console disabled or authenticated
- explicit CORS origins
- no public monitoring endpoints
- no stack traces in API errors
- secrets supplied from environment/configuration, never repository defaults

## Approved architecture after review

```text
React Product
    ↓
EForge
    ↓
Generated OpenAPI Client
    ↓
EForge Enterprise /api/v1
    ↓
Spring Security
    ↓
Application Services
    ↓
MyBatis + Data Scope
    ↓
MySQL / Redis
```

The framework remains a modular monolith.

Microservices, tenancy, MQ, workflow, and distributed transactions remain deferred.
