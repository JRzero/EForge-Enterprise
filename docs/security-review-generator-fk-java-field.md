# Configured foreign-key Java fields in actual generated subtable code

The original generator derived a Java foreign-key setter from the physical SQL
column name. A valid saved Java alias therefore generated a nonexistent
setParentId method. Three complete actual Java generation compilation cases
(ownerReference, oWnerReference, Chinese) failed before the fix.

Actual VelocityUtils subtable rendering now resolves the one persisted child
column, exact physical spelling first and unambiguous SQL case-insensitive alias
second. SQL uses the physical column; Java accessors and MyBatis parameter names
use its saved Java property. Accessor spelling follows the original domain
rule, including its second-uppercase acronym exception. No configuration, field
IDs, physical tables or business rows are changed. Missing/ambiguous associations
fail fixed409; invalid FK Java identifiers fail fixed400 without value echo.
This validates the FK property context only, not every Java/OGNL/type/package,
primary-key accessor, inherited-property or other output semantic.

Evidence (2026-10-06):

- Final whole Maven538 (528 boot+10 data-scope) passes; GeneratorDomainTextTest7
  and actual original MVC14 pass. Three original red compiler cases now pass.
- Actual compiled generated service insert is invoked for each alias; a mapper
  boundary witness verifies the exact Unicode parent value is assigned to the
  actual child before its batch insert call. This is service bytecode behavior,
  not a copied assignment algorithm. The witness does not claim a real generated
  service transaction/HTTP deployment; that final end-to-end evidence remains.
- Native modes0/1 each474 pass. Preserve old CRUD/tree/default sub, add five sub
  scenarios: saved alias, acronym, Chinese property, quoted/dotted XML-sensitive
  physical FK and SQL column case alias. Actual rendered MyBatis statements insert,
  nested-read, inspect exact FK properties and delete under four real SQL modes.
  Earlier literal/menu data checks remain; exact15 pre-menu/16 final owned fixture
  tables bound schema side effects. Only disposable owned containers are removed.
- Actual original controller, actual snapshot loader/service/VM path proves absent
  association code409 and malformed property code400 with fixed messages/no data
  and no metadata write. Original preview grant remains authoritative.
- Native Spring/MyBatis snapshots each32 pass. Final complete default/enabled
  API/browser profiles under58628 ended0: each43 real browsers and full APIs pass. Both live OpenAPI files equal the contract SHA256 481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201. New-source cloud remains pending.

Files/logs: generator-fk-alias-before.log (3 genuine compilation failures),
generator-fk-alias-after.log, generator-fk-final-verify/native-0/1/snapshot-0/1.log,
and generator-fk-generated-service.log under server/eforge-boot/target.

Incomplete final scope: tree option Java aliases likewise still use physical
camel names; general class/type/field/package/OGNL and primary-key accessors need
validation. Frontend JS/TS/HTML contexts, complete immutable file bundles,
canonical preview/download/custom output, ZIP/path boundaries, true React/EForge
output (current type still falls back to Vue), complete generator UI and actual
generated CRUD/tree/sub HTTP/browser remain. All other original active capability
requirements remain; online form builder is explicitly deferred, not complete.
Exact cloud acceptance (2026-10-06): implementation
660fb4be282d113f127cf0b317fb1b4ea1b89987, server37440030951 all three jobs
SUCCESS. Sole observer29040 ended0. Direct generator-fk-cloud-accepted.log proves
538 backend (528 boot +10 scope), modes0/1 each474 native output checks and each32
snapshots, default/enabled each43 real browsers, full APIs and exact unchanged
OpenAPI. This accepts the FK stage, not subsequent bundle changes.