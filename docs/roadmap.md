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
- [x] remove Vue/static frontend assumptions from the canonical API/navigation path
- [x] add data-scope parity tests
- [x] verify MySQL initialization
- [x] verify Redis-backed authentication
- [x] harden Swagger/Druid/CORS/secrets defaults

## Phase 2 — Typed API and EForge web shell

- [ ] establish reproducible EForge package consumption
- [ ] initialize React application
- [ ] consume pinned/versioned EForge packages
- [x] add `/api/v1/auth/login`
- [x] add `/api/v1/app/bootstrap`
- [ ] generate TypeScript client from OpenAPI
- [ ] login/logout/session integration
- [ ] route registry + backend navigation projection
- [ ] permission-aware navigation
- [ ] 403/404
- [ ] system dashboard

## Phase 3 — Core enterprise modules

- [ ] user management
- [ ] role management
- [ ] department management
- [ ] post management
- [ ] menu/permission management
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

- [ ] server unit/integration tests
- [ ] frontend lint/typecheck/test/build
- [ ] Playwright login/RBAC/CRUD E2E
- [ ] Docker Compose local MySQL + Redis
- [ ] CI verification
- [ ] seeded route-contract validation
- [ ] reference CRUD module generated end to end

## Deferred until proven

- multi-tenancy
- microservices
- workflow engine
- MQ
- distributed transactions
- low-code renderer
- business-domain packages
