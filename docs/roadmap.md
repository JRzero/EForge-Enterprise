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

- [ ] user management (administration/import and profile verified in CI; shared status/sex dictionaries integrated and verified locally; current CI and full capability audit pending)
- [ ] role management (canonical API/client, administration/allocation pages and grant/department trees verified in CI; shared status dictionaries integrated and verified locally; current CI and full capability audit pending)
- [x] department management (canonical hierarchy API, EForge page, live CRUD/sort/data-scope verification)
- [x] post management (canonical API, EForge page, live CRUD/permissions/download verification)
- [ ] menu/permission management (canonical API/client and React tree/icons/scope/session refresh verified in CI; status/visibility dictionaries verified locally; query/cache shell behavior pending)
- [ ] dictionary (type/data pages, paging/dates, whole preview, CRUD/bulk/export and shared integration verified locally; remaining field/abort/cache browser acceptance and current CI pending)
- [ ] configuration (canonical API/client and page passed CI; filters/CRUD/bulk/XLSX/cache, permission/error/mobile and real persistence verified; final acceptance audit pending)
- [ ] notices (canonical API/client, rich editor/rendering, administration/top-feed/readers UI and JPG/PNG/static-SVG upload passed local verification and exact-commit CI at c7605fe: server 37237590148, web 37237590166; full capability audit remains pending)
- [ ] operation/login logs (ten canonical operations/client and both React pages verified locally and in exact-head CI, including real audit detail/copy/sorting/XLSX/deletion/password-lock/unlock/session preservation; final capability audit pending)
- [ ] online session management (canonical API/client and page verified locally and in exact-head CI, including exact filters/paging, scoped/self force logout, twelve-session isolation and Redis ACL faults; final capability audit pending)
- [ ] server/cache monitoring and authenticated consoles (server/cache APIs, clients and pages passed full local regression and exact commit CI; cache page c597d44 server 37259840797 all three jobs/web 37259840781 success, local 312/65/52/37 and actual charts/clearing/SQL/session acceptance; consoles and final capability audit pending)

Diagnostic console canonical APIs, generated client and scoped authentication
transport pass local 336 backend/67 unit/52 fixture/37 real browser regression,
including actual enabled servlet resources, grant/logout revocation, ACL faults
and expiry. Exact-commit CI and both React console pages remain pending.

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
