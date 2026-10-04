# EForge Enterprise Roadmap

## Phase 0 — Architecture

- [x] repository model
- [x] modular-monolith decision
- [x] Spring Boot baseline decision
- [x] pin RuoYi upstream commit
- [x] RuoYi inheritance boundary
- [x] EForge dependency boundary
- [x] versioned typed API/OpenAPI contract
- [x] navigation-group vs route distinction
- [x] application bootstrap contract
- [x] authentication/permission boundary
- [x] security/data-scope migration policy
- [x] generator direction
- [x] architecture review

## Phase 1 — Server foundation import

- [x] import pinned RuoYi Spring Boot 3 backend baseline
- [x] preserve upstream MIT license/notice
- [x] establish unchanged Maven green baseline
- [x] move backend under `server/`
- [x] rename `ruoyi-admin` to `eforge-boot`
- [x] rename Maven coordinates/application identity
- [x] rename Java packages in controlled steps
- [ ] remove Vue/static frontend assumptions
- [x] add data-scope parity tests
- [x] verify MySQL initialization
- [x] verify Redis-backed authentication
- [x] harden Swagger/Druid/CORS/secrets defaults

## Phase 2 — Typed API and EForge web shell

- [x] establish reproducible EForge package consumption
- [x] initialize React application
- [x] consume pinned/versioned EForge packages
- [x] add `/api/v1/auth/login`
- [x] add `/api/v1/app/bootstrap`
- [x] generate TypeScript client from OpenAPI
- [x] login/logout/session integration
- [x] route registry + backend navigation projection
- [x] permission-aware navigation
- [x] 403/404
- [x] system dashboard

## Phase 3 — Core enterprise modules

- [ ] user management (administration/import and profile APIs verified in CI; React profile/crop, keyboard/mobile and real browser checks verified in CI; shared dictionary integration pending)
- [ ] role management (canonical API/client, React administration/allocation pages and interactive menu/department trees verified locally and in CI; shared dictionary integration pending; verification evidence in the parity inventory)
- [x] department management (canonical hierarchy API, EForge page, live CRUD/sort/data-scope verification)
- [x] post management (canonical API, EForge page, live CRUD/permissions/download verification)
- [ ] menu/permission management (canonical API/client and React tree CRUD/filter/sort, full icon picker, scoped parent choices and existing-session refresh verified locally; current page CI pending; shared dictionary tags and query/cache shell behavior pending)
- [ ] dictionary
- [ ] configuration
- [ ] notices
- [ ] operation/login logs
- [ ] online session management

## Phase 4 — Generator

- [ ] remove Vue generator templates
- [ ] generator outputs typed backend DTO/controller contracts
- [ ] generator outputs EForge ListPage/FormPage/DetailPage scaffolds
- [ ] generator outputs route registrations
- [ ] generated pages consume OpenAPI client
- [ ] generator validation tests

## Phase 5 — Full-stack verification

- [x] server unit/integration tests
- [x] frontend lint/typecheck/test/build
- [ ] Playwright login/RBAC/CRUD E2E
- [ ] Docker Compose local MySQL + Redis
- [x] CI verification
- [x] seeded route-contract validation
- [ ] reference CRUD module generated end to end

## Deferred until proven

- multi-tenancy
- microservices
- workflow engine
- MQ
- distributed transactions
- low-code renderer
- business-domain packages

## Full RuoYi frontend parity

The phase checkboxes describe individual milestones, not completion of the full
frontend. Track all original frontend operations, shared controls and remaining
shell capabilities in [ruoyi-frontend-parity.md](ruoyi-frontend-parity.md) and its
machine-readable inventory. The full parity objective remains active.
