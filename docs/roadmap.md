# EForge Enterprise Roadmap

## Phase 0 — Architecture

- [x] Repository model
- [x] Spring Boot baseline decision
- [x] RuoYi inheritance boundary
- [x] EForge dependency boundary
- [x] API/OpenAPI contract
- [x] menu/route contract
- [x] authentication/permission boundary
- [x] generator direction

## Phase 1 — Server foundation import

- [ ] import RuoYi Spring Boot 3 backend baseline
- [ ] rename Maven coordinates and application identity
- [ ] retain upstream license/notice
- [ ] remove Vue-only/static frontend assumptions
- [ ] verify Maven build
- [ ] verify MySQL initialization
- [ ] verify Redis-backed authentication

## Phase 2 — EForge web shell

- [ ] initialize React application
- [ ] consume EForge packages
- [ ] login/logout/session integration
- [ ] generated route registry
- [ ] permission-aware navigation
- [ ] 403/404
- [ ] unified API adapter
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

## Phase 4 — Contract and generator

- [ ] springdoc OpenAPI hardening
- [ ] TypeScript client generation
- [ ] remove hand-written duplicate API contracts
- [ ] generator outputs EForge pages
- [ ] generator outputs route registrations
- [ ] generator validation tests

## Phase 5 — Full-stack verification

- [ ] server unit/integration tests
- [ ] frontend typecheck/build/tests
- [ ] Playwright login/RBAC/CRUD E2E
- [ ] Docker Compose local environment
- [ ] CI verification
- [ ] reference CRUD module generated end to end

## Deferred until proven

- multi-tenancy
- microservices
- workflow engine
- MQ
- distributed transactions
- low-code renderer
- domain packages
