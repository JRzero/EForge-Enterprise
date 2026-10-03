# EForge Enterprise

EForge Enterprise is a full-stack enterprise application framework built on:

- **EForge** for the React frontend foundation.
- **RuoYi-derived backend capabilities** for the enterprise server foundation.
- **Spring Boot + MyBatis + Redis + MySQL** for backend infrastructure.
- **OpenAPI** as the front/back contract boundary.

## Current status

Architecture design v0.1 is in progress. Implementation has not started yet.

Key documents:

- [Architecture](ARCHITECTURE.md)
- [Roadmap](docs/roadmap.md)
- [Backend migration map](docs/backend-migration-map.md)
- [API contract](contracts/api-contract.md)
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
Integration contracts
        ↓
RuoYi-derived Spring Boot backend
        ↓
MySQL / Redis / Object Storage
```

Read `AGENTS.md` before implementation work.
