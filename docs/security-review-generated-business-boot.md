# Generated module Boot deployment and canonical user session refresh

## Boundary
Actual generator-rendered CRUD/tree/sub Java and MyBatis XML are compiled into an
exclusive parent-owned integration output directory and loaded through Spring Boot's
standard PropertiesLauncher. The original Boot application, security filter,
JWT/Redis token service, method permissions, transaction managers, SQL mappers and
LogAspect remain active. Physical fixture tables are created only in the parent-owned
disposable MySQL database; no business database or table is dropped. Only the owned
classpath directory and containers are cleaned. The test does not install runtime
test-authentication filters into the product.

The actual authenticated canonical OpenAPI document includes installed modules.
Pinned generated clients are generated twice and strictly compiled, then execute
real HTTP CRUD/filter/XLSX for all three categories. The JWT is passed via a
temporarily scoped process environment/header, never a URL or generated contract.

## Discovered authorization defect
Before repair, canonical user role allocation updated SQL but left existing Redis
LoginUser permissions unchanged. The real Boot regression passed all three generated
clients but failed when the already-authenticated no-role user's newly allocated
SQL query grant still returned403 (generated-business-boot-runtime.log).

UserController now reuses the existing RoleSessionRefresher only after the user
transaction commits, for role allocation, user update, status and deletion.
Rollback callbacks never refresh. The refresher reloads committed SQL state under
its existing department-root mutation boundary, updates only affected users,
preserves remaining TTL and uses setIfPresent so logout is never undone. Missing,
disabled or deleted users lose their cached token. Password reset policy is unchanged.
No DataScopeAspect semantics, permission names, API shape, transaction isolation
policy, Quartz behavior or production console default is changed.

The targeted controller test proves no refresh before commit or after rollback.
Existing refresher tests cover fresh SQL roles, remaining TTL and logout preservation.
Actual Boot verification proves grant isolation, immediate role withdrawal, actor
logout and persisted successful INSERT/UPDATE/DELETE/EXPORT audit. Final expanded allocation-withdraw/regrant/disable and complete default/enabled custom-output regressions pass; sequential process19503 ended0. Logs: generated-business-boot-final-disabled/enabled-runtime.log. No local browser was run; precise new-commit cloud/browser acceptance remains pending.

## Evidence and remaining scope
Full Maven607 (597 Boot and10 data-scope; one OS-specific skip) passes.
Frontend lint/typecheck/generated reproducibility/79 unit/build passes.
The generated-module test is installed in server CI after compilation and native probes.
The preceding canonical-group commit08771cd is separately accepted by all three
server37499013614 jobs and does not accept this later patch.
React/EForge frontend templates, complete generator management UI and actual
generated browser flows remain incomplete. Form builder is deferred.
### Original Boot generated module acceptance (41ce1b4)
Exact implementation 41ce1b4296a704ef72231bf030f92f58b689116d is accepted:
server37505004687 all three jobs and web37505004677 terminal SUCCESS. Direct
generated-business-boot-cloud-accepted.log and generated-business-boot-web-accepted.log
prove Maven607 (597 Boot +10 data-scope, one OS-specific skip), actual generated
module installation/JWT/Redis/MyBatis/client/persisted audit, and both configuration
profiles with43 existing real browser cases/full API/OpenAPI. This accepts the
user-session refresh patch and original Boot integration, not later React output
or generated browser work. The React stage is currently uncommitted and under
real browser validation; full generator management and remaining parity are pending.