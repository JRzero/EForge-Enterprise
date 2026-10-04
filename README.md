# EForge Enterprise

The Phase 2 React shell is implemented under `web/`: login, captcha, session
restore, bootstrap navigation, dashboard, 403/404 and confirmed logout. See
[web setup and verification](web/README.md). EForge is consumed as pinned package
artifacts; canonical API DTOs and functions are generated from Spring OpenAPI.

EForge Enterprise is a full-stack enterprise application framework built on:

- **EForge** for the React frontend foundation.
- **RuoYi-derived backend capabilities** for the enterprise server foundation.
- **Spring Boot + MyBatis + Redis + MySQL** for backend infrastructure.
- **OpenAPI** as the typed frontend/backend contract boundary.

## Current status

The RuoYi-derived Spring Boot 3 server foundation is implemented and runtime-verified with MySQL 8.4 and Redis 7.4. Module identity and Java namespace migration to `io.eforge.enterprise` are complete. Canonical login/bootstrap, isolated ProblemDetail errors, and stable navigation identity migration are implemented. The next milestone is reproducible EForge React package consumption, frontend routes and their navigation bindings.

Key documents:

- [Architecture](ARCHITECTURE.md)
- [Architecture review](docs/architecture-review-v0.1.md)
- [Roadmap](docs/roadmap.md)
- [Backend migration map](docs/backend-migration-map.md)
- [API contract](contracts/api-contract.md)
- [Application bootstrap contract](contracts/bootstrap-contract.md)
- [Navigation contract](contracts/navigation-contract.md)
- [Architecture decisions](docs/adr/)

## Repository boundary

- `JRzero/EForge` remains the independently versioned React frontend foundation.
- This repository owns the full-stack integration, RuoYi-derived server foundation, enterprise modules, contracts, deployment assets, and reference application.
- A separate EForge-Server repository will not be created until independent backend reuse is proven.

## Architecture direction

```text
Business Application
        ↓
EForge frontend foundation
        ↓
Generated OpenAPI client
        ↓
EForge Enterprise /api/v1
        ↓
Spring Security + application services
        ↓
MyBatis / data scope
        ↓
MySQL / Redis / Object Storage
```

The server is intentionally a **modular monolith** for the initial framework.

Read `AGENTS.md` before implementation work.
