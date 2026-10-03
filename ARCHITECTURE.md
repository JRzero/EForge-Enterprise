# EForge Enterprise Architecture

## 1. Positioning

EForge Enterprise is a reusable full-stack enterprise application framework.

It combines:

- **EForge** as the independently versioned React frontend foundation.
- **RuoYi-derived backend capabilities** as the initial enterprise server baseline.
- **OpenAPI** as the canonical frontend/backend contract source.
- **MySQL + Redis** as the initial infrastructure baseline.

It is intentionally a **modular monolith**. The goal is not to recreate RuoYi with a React frontend, but to keep proven backend enterprise capabilities while replacing frontend-specific coupling and establishing a cleaner contract boundary.

## 2. System architecture

```text
Business Applications
CRM / ESG / Project / Quality / Internal Systems
                    │
                    ▼
┌────────────────────────────────────────────────┐
│ Product Layer                                  │
│ domain pages / domain services / domain rules  │
├────────────────────────────────────────────────┤
│ EForge Frontend Foundation                     │
│ @eforge/app / patterns / data / forms / ui     │
├────────────────────────────────────────────────┤
│ Generated Client + Integration Layer           │
│ OpenAPI TS client / auth / query adapters      │
├────────────────────────────────────────────────┤
│ EForge Enterprise API                          │
│ /api/v1/**                                     │
│ typed DTOs / PageResponse / ProblemDetail      │
├────────────────────────────────────────────────┤
│ Enterprise Services                            │
│ IAM / org / menu / dict / config / logs / job  │
├────────────────────────────────────────────────┤
│ Backend Foundation                             │
│ Spring Security / MyBatis / data scope / Redis │
├────────────────────────────────────────────────┤
│ Infrastructure                                 │
│ MySQL / Redis / Object Storage                 │
└────────────────────────────────────────────────┘
```

## 3. Repository model

Two repositories are maintained:

```text
JRzero/EForge
└─ reusable React frontend foundation

JRzero/EForge-Enterprise
└─ full-stack enterprise framework
```

EForge source is not copied into this repository.

### EForge Enterprise layout

```text
EForge-Enterprise/
├─ server/
│  ├─ pom.xml
│  ├─ eforge-boot
│  ├─ eforge-framework
│  ├─ eforge-system
│  ├─ eforge-common
│  ├─ eforge-generator      # optional
│  └─ eforge-quartz         # optional
│
├─ web/
│  ├─ app/
│  ├─ features/
│  ├─ generated/
│  └─ integration/
│
├─ contracts/
│  ├─ openapi/
│  └─ *.md
│
├─ sql/
├─ deploy/
├─ docs/
│  └─ adr/
├─ AGENTS.md
├─ ARCHITECTURE.md
└─ README.md
```

## 4. Technology baseline

### Backend

Initial baseline:

- Java 17
- Spring Boot 3.5.x
- Spring Security
- MyBatis
- PageHelper
- Redis
- MySQL
- springdoc-openapi
- Maven multi-module

Pinned RuoYi reference:

```text
repository: yangzongzhuan/RuoYi-Vue
version:    3.9.2
branch:     springboot3
commit:     a51a838b71b446ea27256900efe7ed2faa2a02fd
```

Spring Boot 4 is an explicit future upgrade path, not part of the first baseline.

### Frontend

Architecture baseline:

- React 19
- TypeScript
- EForge v0.4+ architecture
- TanStack Query
- EForge Application Runtime
- generated OpenAPI TypeScript client

Pinned EForge architecture reference:

```text
repository: JRzero/EForge
commit:     a7b644b724f4264c1ca015ce4c686ca94476d62f
```

A floating dependency on EForge `main` is not allowed in CI.

## 5. Server architecture

The server is a modular monolith.

### Module intent

```text
eforge-boot
  executable application + web entry point

eforge-framework
  Spring/Security/web/runtime infrastructure

eforge-system
  user/role/dept/post/menu/dict/config/log services

eforge-common
  shared primitives/utilities

eforge-generator
  optional developer tooling

eforge-quartz
  optional scheduling capability
```

The module split initially follows proven RuoYi boundaries to minimize migration risk.

Do not create Maven modules for every business entity.

Future domain modules such as `eforge-module-esg` or `eforge-module-crm` belong in product repositories until repeated reuse proves they belong in the framework.

## 6. RuoYi inheritance strategy

RuoYi is an upstream implementation source, not the architectural identity of the new framework.

### Preserve first

- Spring Security method authorization
- JWT/Redis login-state behavior
- user / role / department / post persistence
- permission evaluation
- dictionary/configuration services
- operation/login logs
- MyBatis/PageHelper foundations
- optional Quartz behavior

### Preserve but classify as security-critical migration code

- data-scope implementation
- token/session implementation
- security filters
- security exception handling

These require parity tests before redesign.

### Keep only for migration compatibility

- `AjaxResult`
- `TableDataInfo`
- legacy `/login`
- legacy `getInfo`
- legacy `getRouters`
- Vue-oriented generator output

### Replace

- Vue Router payload generation
- database-driven component path loading
- Vue frontend source
- Vue page templates
- public production Swagger/Druid defaults
- framework/demo branding not relevant to EForge Enterprise

## 7. API architecture

New APIs are versioned:

```text
/api/v1/**
```

New endpoints use:

- concrete request/response DTOs
- HTTP status semantics
- `PageResponse<T>` for paged lists
- Spring `ProblemDetail` / RFC 7807 for errors

Legacy RuoYi response wrappers are migration-only.

### Contract flow

```text
Spring Controller
      ↓
OpenAPI
      ↓
Generated TypeScript Client
      ↓
Integration / Query Adapter
      ↓
EForge Data Layer
      ↓
Business Page
```

Generated TypeScript types/functions are never manually duplicated.

## 8. Authentication bootstrap

The canonical app startup contract is:

```text
POST /api/v1/auth/login
        ↓
access token
        ↓
GET /api/v1/app/bootstrap
        ├─ user
        ├─ roles
        ├─ permissions
        └─ navigation
        ↓
EForgeApplication
```

The initial token implementation may preserve RuoYi's Redis-backed login state.

Backend authorization is authoritative:

```text
Spring @PreAuthorize / data scope = security boundary
EForge PermissionGate / route UX = frontend behavior only
```

## 9. Navigation and route model

The backend navigation tree and frontend route registry are intentionally separate models.

### Navigation nodes

```text
GROUP     navigation grouping only
ROUTE     maps to a frontend routeId
EXTERNAL  explicit external URL
```

Example:

```json
{
  "key": "system-users",
  "type": "ROUTE",
  "routeId": "system-users",
  "label": "Users",
  "order": 10,
  "children": []
}
```

Frontend:

```ts
defineAppRoutes([
  {
    id: 'system-users',
    path: '/system/users',
    title: 'Users',
    access: {permission: 'system:user:list'},
    component: UsersPage
  }
])
```

### Database additions

```text
sys_menu
+ menu_key varchar(100) unique
+ route_id varchar(100) null
```

Rules:

- `menu_key` identifies every navigation node.
- `route_id` is present only for ROUTE nodes.
- `component` remains temporarily for upstream compatibility.
- React never executes component names from database rows.

## 10. Data scope

The existing RuoYi data-scope mechanism is retained for initial behavior parity.

It is security-sensitive because it propagates generated SQL fragments and includes MySQL-specific hierarchy behavior.

Initial policy:

1. preserve behavior
2. add integration tests for every data-scope mode
3. establish a green migration baseline
4. redesign only in a later isolated change

No data-scope rewrite is allowed during the initial backend import.

## 11. Security defaults

Production defaults must be stricter than upstream development defaults.

Required:

- Swagger/OpenAPI UI disabled or authenticated in production
- Druid console disabled or authenticated in production
- explicit CORS origins
- no anonymous monitoring endpoints
- secrets supplied from environment/configuration
- no stack traces/internal exception classes in API responses
- backend permission/data-scope checks on protected endpoints

## 12. Generator direction

The generator evolves from Vue-oriented source generation into EForge Enterprise scaffolding.

Target:

```text
Table / Domain Metadata
        ↓
Generator
        ├─ Backend
        │  ├─ Entity / DTO
        │  ├─ Mapper
        │  ├─ Service
        │  └─ Controller
        │
        ├─ Contract
        │  └─ OpenAPI
        │
        └─ Frontend
           ├─ route registration
           ├─ generated client usage
           ├─ ListPage
           ├─ FormPage
           └─ DetailPage
```

Generated frontend code imports EForge public APIs, never Astryx directly.

## 13. Dependency boundaries

Forbidden:

- server code depending on React/frontend implementation details
- product pages consuming legacy RuoYi Vue contracts
- React business code importing Astryx directly
- backend navigation values resolving arbitrary React component paths
- floating EForge `main` dependencies in CI
- generator output introducing domain-specific components into EForge

## 14. Deferred architecture

Not part of the initial framework:

- microservices
- multi-tenancy
- workflow engine
- MQ
- distributed transactions
- Elasticsearch
- low-code renderer
- business-domain packages

These require evidence from real applications before adoption.

## 15. Architecture completion criteria

Architecture v0.1 is complete when these decisions are fixed:

1. modular-monolith server boundary
2. pinned technology/upstream baselines
3. RuoYi migration boundary
4. EForge dependency boundary
5. typed versioned API contract
6. authentication/bootstrap contract
7. navigation vs route contract
8. security/data-scope migration policy
9. generator boundary
10. upstream attribution strategy

Implementation then proceeds through the roadmap in `docs/roadmap.md`.
