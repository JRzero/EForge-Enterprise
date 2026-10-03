# Backend Migration Map

This document maps the RuoYi backend into EForge Enterprise.

## Pinned upstream baseline

- Repository: `yangzongzhuan/RuoYi-Vue`
- Version: 3.9.2
- Branch: `springboot3`
- Commit: `a51a838b71b446ea27256900efe7ed2faa2a02fd`
- Java: 17
- Spring Boot: 3.5.x

The import must use the pinned commit, not a floating branch head.

## Module mapping

The server remains a modular monolith.

| RuoYi module | EForge Enterprise target | Initial action |
| --- | --- | --- |
| `ruoyi-admin` | `server/eforge-boot` | import as executable/web entry module |
| `ruoyi-framework` | `server/eforge-framework` | import and rename |
| `ruoyi-system` | `server/eforge-system` | import and rename |
| `ruoyi-common` | `server/eforge-common` | import and rename |
| `ruoyi-generator` | `server/eforge-generator` | import as optional module, later replace frontend templates |
| `ruoyi-quartz` | `server/eforge-quartz` | import as optional module |

Do not split user/role/dept/menu/dict into separate Maven modules in the framework baseline.

## Capability classification

### Preserve first

- Spring Security method authorization
- JWT/Redis login-state semantics
- user/role/dept/post persistence
- permission evaluation
- dictionaries/configuration
- operation/login logs
- PageHelper/MyBatis foundations
- Quartz behavior when the optional module is enabled

### Preserve but treat as security-critical migration code

- data-scope behavior
- token/session implementation
- authentication filters
- security exception handling

These require parity/integration tests before redesign.

### Keep only behind compatibility boundaries

- `AjaxResult`
- `TableDataInfo`
- legacy `/login`
- legacy `getInfo`
- legacy `getRouters`
- legacy upload/download response shapes

### Replace

- Vue Router payload generation
- `RouterVo.component` dynamic component-path semantics
- Vue frontend generator templates
- Vue frontend source
- framework branding and demo links
- anonymous production exposure of Swagger/Druid operational consoles

## Package naming

Target root package:

```text
io.eforge.enterprise
```

Recommended packages:

```text
io.eforge.enterprise.boot
io.eforge.enterprise.framework
io.eforge.enterprise.system
io.eforge.enterprise.common
io.eforge.enterprise.generator
io.eforge.enterprise.quartz
```

Do not perform a blind global rename before the imported baseline compiles.

## Database strategy

Preserve the RuoYi schema initially to reduce migration risk.

Intentional menu additions:

```text
sys_menu
+ menu_key varchar(100) unique
+ route_id varchar(100) null
```

Meaning:

- `menu_key` is a stable environment-independent navigation identity
- `route_id` exists only for rows that map to a React route
- `component` remains temporarily for upstream compatibility
- new React code never consumes `component`
- existing `perms`, `visible`, `status`, `parent_id`, and `order_num` remain useful

Do not drop legacy columns in the first migration.

## Security migration rules

Before production readiness:

- protect/disable Swagger UI in production
- protect/disable Druid console in production
- use explicit CORS origin configuration
- externalize token/database/Redis secrets
- add data-scope parity tests
- prevent stack traces/internal exception details in API responses

## Import sequence

1. Import backend-only modules from the pinned upstream commit.
2. Copy upstream MIT license/attribution.
3. Verify the unmodified Spring Boot 3 backend Maven build.
4. Move modules under `server/`.
5. Rename `ruoyi-admin` to `eforge-boot` and Maven coordinates.
6. Rename Java package/application identity in controlled commits.
7. Re-run compile/tests after each rename stage.
8. Add typed `/api/v1` infrastructure.
9. Add `menu_key` / `route_id` migration.
10. Add `/api/v1/app/bootstrap`.
11. Harden OpenAPI/security defaults.
12. Only after server parity, modify generator output.

Every step must leave the branch buildable.
