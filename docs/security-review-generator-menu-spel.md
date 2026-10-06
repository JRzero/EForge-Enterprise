# Original generated menu SQL and Java annotation text

The actual original SQL menu template now encodes all dynamic menu names, parent,
path, component, permissions and remarks as exact UTF-8 MySQL literals. Fixed
SQL structure, one original route menu, five button permissions and LAST_INSERT_ID
parent capture remain. This keeps the legacy menu_key/route_id NULL migration
boundary; it does not pretend those legacy components bind to React routes.

The actual original Java controller template encodes @RequestMapping text as a
Java string. Every one of the six PreAuthorize values first encodes the permission
as a SpEL string argument and then the complete fixed @ss.hasPermi expression as a
Java annotation string. Encoding only one of those languages is insufficient.
Metadata is not evaluated again as a template. Original permission actions remain
list/export/query/add/edit/remove.

Local validation (2026-10-06):

- Whole Maven verify533:523 boot plus10 data-scope parity, no failures.
- Four cases compile all actual original Java files for CRUD/tree/sub and hostile
  route/permission text. Reflection reads actual compiled route/audit/Excel
  annotations. Actual SpEL parsing of each compiled authorization annotation
  resolves only the fixed ss bean, passes the complete original permission to a
  witness, preserves all six actions and leaves the payload property unset.
  The witness proves expression text semantics, not production authorization of
  generated HTTP endpoints; that runtime end-to-end evidence remains required.
- One actual Druid AST case parses the original generated menu into exactly seven
  statements (six INSERTs), with no injected DROP or raw hostile SQL fragment.
- Two actual MySQL case modes each230 assertions, terminal72905 exit0, include
  preceding132 actual Mapper/literal checks plus original sys_menu DDL and actual
  V001 navigation/V011 sibling uniqueness ALTER constraints. Four SQL modes each
  execute seven statements; root/child names, parent linkage, component/path,
  permissions, remarks and nullable canonical identities match exact data.24
  menu rows and exactly six owned fixture tables prove bounded effects. No
  production schema/data is touched; only the uniquely owned disposable probe
  container is removed. The preceding JDBC fixture mode correction remains.
- Two actual Spring/MyBatis snapshot profiles each32 pass.
- Final default/enabled complete API/browser profiles both pass, each43 actual
  browsers. Authority88871 ended exit0; both live OpenAPI exports exactly match
  the contract. Exact new-commit cloud acceptance remains pending.

This does not complete Java/OGNL class/type/field/package validation, foreign-key
configured Java field mapping, JS/TS/HTML contexts, immutable file bundles,
ZIP/custom-path safeguards, canonical output APIs, true React/EForge templates,
full management UI or real generated business HTTP/browser acceptance. In
particular the current eforge-react type still falls back to Vue; that target must
be implemented rather than renamed as complete. Online form builder stays deferred.

Evidence: generator-menu-spel-target/verify.log, native-0/1.log and snapshot-0/1.log
under server/eforge-boot/target. No framework authorization/data-scope semantics
or production JDBC settings changed.
Final local menu/SpEL acceptance:88871 terminal exit0, default/enabled each43
actual browsers and both full real API regressions pass. Both live OpenAPI
exports exactly match SHA256481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
Exact new-commit cloud is pending. This stage does not complete generator output,
React/EForge templates, management UI or the full active goal.