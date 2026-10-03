# EForge Enterprise Architecture

## 1. Positioning

EForge Enterprise is a full-stack enterprise application framework.

It combines:

- **EForge** as the frontend foundation.
- **RuoYi-derived backend capabilities** as the server foundation.
- **OpenAPI** as the front/back contract boundary.
- **MySQL + Redis** as the default infrastructure baseline.

It is not a direct merge of EForge and RuoYi-Vue. The goal is to preserve the strongest reusable capabilities of each side while replacing the tight Vue-specific coupling in the original RuoYi architecture.

## 2. System layers

```text
Business Applications
CRM / ESG / Project / Quality / Internal Systems
                    │
                    ▼
┌──────────────────────────────────────────────┐
│ Enterprise Application Layer               │
│ Product routes / pages / domain services   │
├──────────────────────────────────────────────┤
│ Frontend Foundation                        │
│ EForge                                     │
│ app / patterns / data / forms / ui / core │
├──────────────────────────────────────────────┤
│ Integration Contract Layer                 │
│ auth / permissions / menu / API / paging   │
│ OpenAPI + generated TypeScript client      │
├──────────────────────────────────────────────┤
│ Backend Enterprise Services                │
│ user / role / dept / menu / dict / config  │
│ audit / notice / job / generator           │
├──────────────────────────────────────────────┤
│ Backend Foundation                         │
│ Spring Boot / Spring Security / MyBatis    │
│ Redis / data-scope / logging / validation  │
├──────────────────────────────────────────────┤
│ Infrastructure                             │
│ MySQL / Redis / object storage             │
└──────────────────────────────────────────────┘
```

## 3. Repository model

The repository is a **full-stack integration repository**.

```text
EForge-Enterprise/
├─ server/
│  ├─ eforge-admin
│  ├─ eforge-framework
│  ├─ eforge-system
│  ├─ eforge-common
│  ├─ eforge-generator
│  └─ eforge-quartz
│
├─ web/
│  ├─ app/
│  ├─ features/
│  ├─ generated/
│  └─ integration/
│
├─ contracts/
│  ├─ openapi/
│  └─ schemas/
│
├─ sql/
├─ deploy/
├─ docs/
│  └─ adr/
├─ AGENTS.md
├─ ARCHITECTURE.md
└─ README.md
```

### Repository boundaries

- **EForge source is not copied into this repository.**
- EForge remains independently versioned in `JRzero/EForge`.
- `web/` consumes EForge packages.
- Backend code derived from RuoYi keeps required upstream attribution/license notices.
- Domain-specific components remain in product projects until repeated reuse proves a shared abstraction.

## 4. Technology baseline

Initial baseline:

### Backend

- Java 17
- Spring Boot 3.5.x
- Spring Security
- MyBatis
- PageHelper
- Redis
- MySQL
- springdoc-openapi
- Maven multi-module

Why Spring Boot 3.5.x first:

- RuoYi 3.9.2 maintains an official `springboot3` branch.
- Spring Boot 3 has broader ecosystem compatibility for an initial enterprise foundation.
- Spring Boot 4 remains an explicit upgrade path after the framework stabilizes.

### Frontend

- React 19
- TypeScript
- EForge v0.4+
- TanStack Query
- EForge Application Runtime
- Generated OpenAPI TypeScript client

## 5. Backend inheritance strategy

RuoYi is treated as an **upstream backend implementation source**, not as the product architecture.

### Preserve initially

- authentication flow
- Spring Security permission checks
- JWT/token session model
- Redis-backed login state
- user / role / department / post
- menu and permission model
- dictionary and parameter configuration
- operation/login logs
- data-scope mechanism
- scheduled tasks
- code generator foundation
- common validation / exception handling utilities

### Refactor or replace

- Vue-specific route payloads
- component-path based dynamic routing
- frontend request assumptions
- ad-hoc `AjaxResult` consumption in React business code
- `TableDataInfo` consumption in React business code
- Vue templates in the generator
- framework branding and non-essential demo/navigation entries

### Deferred

- microservices split
- multi-tenancy
- workflow engine
- low-code renderer
- distributed transactions
- message queue
- Elasticsearch

These are added only after a real project proves the need.

## 6. Front/back contract boundary

Business React code must not directly depend on RuoYi response structures.

### Backend compatibility objects

RuoYi currently exposes shapes such as:

```text
AjaxResult
code / msg / data

TableDataInfo
code / msg / rows / total
```

### EForge Enterprise frontend contract

The integration layer normalizes them into stable application contracts:

```ts
export interface ApiResult<T> {
  data: T;
  message?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Long term, OpenAPI-generated clients become the canonical transport surface.

### Rule

```text
Spring Controller
      ↓
OpenAPI
      ↓
Generated TypeScript Client
      ↓
Integration Adapter
      ↓
EForge Data Layer
      ↓
Business Page
```

Do not hand-write duplicate API types when they can be generated.

## 7. Authentication and authorization

Backend authorization remains the security boundary.

```text
Login
  ↓
Spring Security
  ↓
JWT/session token
  ↓
Redis login state
  ↓
getInfo
  ├─ user
  ├─ roles
  └─ permissions
```

Frontend EForge permissions are UX controls only.

```text
Backend @PreAuthorize = security
Frontend PermissionGate = visibility / interaction UX
```

Never treat frontend permission checks as authorization.

## 8. Menu and route architecture

This is a major deliberate divergence from original RuoYi Vue routing.

### Original coupling

```text
sys_menu
  ↓
component = "system/user/index"
  ↓
getRouters()
  ↓
Vue dynamic component resolution
```

This couples backend database rows directly to frontend implementation file paths.

### EForge Enterprise model

Backend menu data controls:

- visibility
- ordering
- hierarchy
- permission assignment
- optional external links

Frontend route registry controls:

- URL path
- React component
- page metadata
- route component binding

Recommended contract:

```json
{
  "routeId": "system-users",
  "visible": true,
  "order": 10,
  "permission": "system:user:list"
}
```

Frontend:

```ts
defineAppRoutes([
  {
    id: "system-users",
    path: "/system/users",
    title: "Users",
    access: { permission: "system:user:list" },
    component: UsersPage
  }
])
```

Integration:

```text
Database Menu Assignment
        ↓
Current-user navigation grants
        ↓
routeId
        ↓
EForge Route Registry
        ↓
React Page
```

### Critical rule

The backend must not send React component paths and the frontend must not execute component names received from the database.

## 9. Enterprise module boundaries

Initial system modules:

```text
Identity & Access
├─ User
├─ Role
├─ Department
├─ Post
├─ Permission
└─ Menu

Platform Configuration
├─ Dictionary
├─ Parameters
└─ Notices

Operations
├─ Login Log
├─ Operation Log
├─ Online Sessions
├─ Server/Cache Observability
└─ Scheduled Jobs

Developer Productivity
├─ OpenAPI
└─ Generator
```

## 10. Generator direction

The generator must evolve from RuoYi's Vue-oriented generator into an EForge Enterprise generator.

Target output:

```text
Database Table / Domain Metadata
        ↓
Generator
        ├─ Backend
        │  ├─ Entity
        │  ├─ Mapper
        │  ├─ Service
        │  └─ Controller
        │
        ├─ Contract
        │  └─ OpenAPI
        │
        └─ Frontend
           ├─ Route registration
           ├─ generated API client usage
           ├─ ListPage
           ├─ FormPage
           └─ DetailPage
```

Generator templates must use EForge public APIs, never Astryx directly.

## 11. Dependency direction

```text
business feature
      ↓
integration contracts
      ↓
EForge frontend packages

business service
      ↓
system/framework/common server modules
      ↓
Spring Boot infrastructure
```

Forbidden dependencies:

- `server` depending on frontend implementation details.
- business pages importing RuoYi Vue contracts directly.
- React business code importing Astryx directly.
- generator producing domain-specific abstractions into EForge core packages.

## 12. Initial delivery milestone

Architecture v0.1 is complete when these contracts are fixed:

1. technology baseline
2. repository/module structure
3. authentication contract
4. permissions contract
5. menu/route contract
6. API response/paging contract
7. OpenAPI strategy
8. generator boundary
9. upstream attribution strategy

Implementation begins only after these are reviewed.
