# EForge Enterprise Agent Contract

This repository is the full-stack enterprise framework built from EForge frontend capabilities and a RuoYi-derived Spring Boot backend.

## Mandatory architecture rules

1. Do not copy EForge source into this repository. Consume EForge packages.
2. Do not import Astryx directly from product code.
3. Backend authorization is authoritative. Frontend permissions are UX only.
4. Do not resolve React component paths from backend database values.
5. Use stable `routeId` values to connect backend navigation grants to the frontend route registry.
6. Prefer OpenAPI-generated TypeScript API types/functions over duplicated hand-written DTOs.
7. Keep RuoYi compatibility wrappers behind the integration boundary.
8. Preserve RuoYi MIT attribution for derived backend source.
9. Do not introduce multi-tenancy, microservices, workflow, MQ, or low-code infrastructure without a demonstrated product requirement.
10. Business/domain abstractions stay local until repeated use proves they belong in the framework.

## Expected validation

Before completion of any implementation change:

- backend Maven compile/test must pass
- frontend lint/typecheck/test/build must pass
- relevant integration/E2E tests must pass
- architecture changes must update ADRs when they change an accepted decision

## Key documents

- `ARCHITECTURE.md`
- `docs/adr/`
- `docs/roadmap.md`
