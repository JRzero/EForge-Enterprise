# Backend Migration Map

This document maps the RuoYi backend modules into EForge Enterprise.

## Upstream baseline

- Repository: `yangzongzhuan/RuoYi-Vue`
- Version: 3.9.2
- Reference branch: `springboot3`
- Java: 17
- Spring Boot: 3.5.x

Pin the exact upstream commit when Phase 1 import begins.

## Module mapping

| RuoYi module | EForge Enterprise target | Initial action |
| --- | --- | --- |
| `ruoyi-admin` | `server/eforge-admin` | import and rename |
| `ruoyi-framework` | `server/eforge-framework` | import and rename |
| `ruoyi-system` | `server/eforge-system` | import and rename |
| `ruoyi-common` | `server/eforge-common` | import and rename |
| `ruoyi-generator` | `server/eforge-generator` | import, then replace frontend templates |
| `ruoyi-quartz` | `server/eforge-quartz` | import, keep optional |

## Capability classification

### Keep with minimal semantic change

- Spring Security configuration
- JWT/token parsing
- Redis login state
- user/role/dept/post persistence
- permission evaluation
- data scope
- dictionary/configuration
- operation/login logs
- common validation utilities
- PageHelper/MyBatis persistence foundations
- Quartz scheduling

### Keep but wrap behind new contracts

- `AjaxResult`
- `TableDataInfo`
- login/getInfo transport
- menu assignment responses
- file upload/download responses

### Replace

- `getRouters()` Vue Router payload contract
- `RouterVo.component` dynamic component path semantics
- Vue frontend generator templates
- Vue frontend source
- frontend branding links such as RuoYi website menu entries

## Package naming

Target root package:

```text
io.eforge.enterprise
```

Recommended server packages:

```text
io.eforge.enterprise.admin
io.eforge.enterprise.framework
io.eforge.enterprise.system
io.eforge.enterprise.common
io.eforge.enterprise.generator
io.eforge.enterprise.quartz
```

Do not perform a blind global rename before the imported baseline compiles. Import first, establish a green baseline, then rename in controlled commits.

## Database strategy

Phase 1 should preserve the RuoYi schema wherever possible to reduce migration risk.

Intentional schema change:

```text
sys_menu
+ route_id varchar(100)
```

During migration:

- `component` remains for upstream compatibility.
- React code never depends on `component`.
- new EForge navigation uses `route_id`.
- existing `perms`, `visible`, `status`, `parent_id`, and `order_num` remain useful.

Later, once Vue compatibility is no longer required, obsolete route/component fields can be reevaluated in a separate migration.

## Import sequence

1. Copy backend-only modules from the pinned upstream commit.
2. Preserve upstream LICENSE.
3. Verify unmodified backend Maven build.
4. Move into `server/`.
5. Rename Maven coordinates.
6. Rename Java package/application identity.
7. Add EForge-specific integration API.
8. Add `route_id` migration.
9. Replace `getRouters` with the EForge navigation contract.
10. Harden OpenAPI.
11. Only then modify generator output.

Each step should leave the branch buildable.
