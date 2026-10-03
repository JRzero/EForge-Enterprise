# EForge Enterprise Agent Contract

This repository is the full-stack enterprise framework built from EForge frontend capabilities and a RuoYi-derived Spring Boot backend.

## Mandatory architecture rules

1. Keep the server a modular monolith unless an accepted ADR explicitly changes that decision.
2. Do not copy EForge source into this repository. Consume a pinned/versioned EForge dependency.
3. Do not import Astryx directly from product code.
4. Backend authorization is authoritative. Frontend permission checks are UX only.
5. New canonical endpoints live under `/api/v1/**`.
6. New `/api/v1` endpoints do not return `AjaxResult` or `TableDataInfo`.
7. Prefer concrete DTOs, HTTP status semantics, `PageResponse<T>`, and Spring `ProblemDetail`.
8. Prefer OpenAPI-generated TypeScript API types/functions over duplicated hand-written DTOs.
9. Do not resolve React components from backend database strings.
10. Navigation GROUP nodes are not fake React routes.
11. Only navigation ROUTE nodes bind to frontend `routeId` values.
12. Use `menu_key` as a stable navigation identity and `route_id` only for actual frontend routes.
13. Keep RuoYi compatibility objects behind migration boundaries.
14. Preserve RuoYi MIT attribution for derived backend source.
15. Do not rewrite data-scope behavior during initial import; add parity tests first.
16. Production defaults must not expose Swagger/Druid/monitoring consoles anonymously.
17. Do not introduce multi-tenancy, microservices, workflow, MQ, or low-code infrastructure without demonstrated product requirements.
18. Business/domain abstractions stay local until repeated use proves they belong in the framework.

## Upstream baselines

RuoYi import baseline:

```text
yangzongzhuan/RuoYi-Vue
branch: springboot3
commit: a51a838b71b446ea27256900efe7ed2faa2a02fd
```

EForge architecture baseline:

```text
JRzero/EForge
commit: a7b644b724f4264c1ca015ce4c686ca94476d62f
```

Do not silently advance either baseline during an implementation change.

## Expected validation

Before completion of implementation changes:

- backend Maven compile/tests pass
- security-sensitive changes include targeted tests
- frontend lint/typecheck/test/build pass
- relevant integration/E2E tests pass
- seeded navigation-to-route contracts validate
- generated OpenAPI client is reproducible
- accepted architecture changes update/add ADRs

## Migration discipline

For upstream backend import:

```text
import unchanged
→ compile green
→ move modules
→ rename Maven coordinates
→ compile green
→ rename Java packages
→ compile green
→ add /api/v1 contracts
→ integration tests
```

Do not combine all migration stages in one unreviewable rewrite.

## Key documents

- `ARCHITECTURE.md`
- `docs/architecture-review-v0.1.md`
- `docs/backend-migration-map.md`
- `docs/adr/`
- `contracts/api-contract.md`
- `contracts/bootstrap-contract.md`
- `contracts/navigation-contract.md`
- `docs/roadmap.md`
