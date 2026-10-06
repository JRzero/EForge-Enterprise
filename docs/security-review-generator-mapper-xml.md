# Original generator Mapper XML physical names

Scope: the actual original `vm/xml/mapper.xml.vm` used by previews and original
outputs. Physical SQL table/column identifiers are encoded as one MySQL identifier
segment and then XML text; result/collection column attributes use XML attribute
encoding independently. Names with Unicode, quotes, backticks, XML delimiters,
dots and SQL/comment words remain data. Existing CRUD/tree/subtable statements,
query operators, primary keys, generated keys, nested mappings and parameter
placeholders are retained. A dot inside one physical name is not a schema separator.

This does not validate Java properties, OGNL expressions, class/type/package names,
foreign-key Java field derivation, SQL menu templates, JS/TS/Vue/React, ZIP paths or
custom output. Those contexts remain pending. It does not introduce a canonical
output endpoint or complete the generator UI. Invalid XML character repertoire
refusal at the complete HTTP rendering boundary still needs explicit acceptance.
No production data or schema is modified by the implementation.

Actual validation, 2026-10-06:

- Whole Maven verify: 521 boot tests plus 10 data-scope parity cases, 531 total,
  no failures. The original Java compilation/reflection tests remain green.
- Ten real MyBatis XMLMapperBuilder/BoundSql cases exercise eight query operators
  plus tree/subtable; parsed result-map physical names are exact, SQL identifiers
  remain quoted and parameters remain placeholders. These are actual original
  templates and actual MyBatis dynamic statement parsing, not a replacement XML.
- Native isolated MySQL case modes 0 and 1 each pass 132 assertions. The preceding
  23 literal-context assertions remain. The additional assertions execute actual
  rendered MyBatis CRUD/tree/sub statements under four connection SQL modes,
  validate exact Unicode/hostile row text, generated keys, query/update/delete,
  child insert/nested result/delete and exact resulting table count (no injected
  DDL). Each probe owns only its disposable database container.
- Two native Spring/MyBatis snapshot profiles still pass 32 assertions each.
- Final default/enabled complete API/browser regressions both pass, each 43 real
  browsers; authority session 6963 ended with exit 0. Both live OpenAPI exports
  exactly match the contract. Exact new-commit cloud acceptance remains pending.

Fixture correction: the first native failure appeared only after executing
`SET SESSION sql_mode` on an already initialized JDBC connection. Connector/J's
client prepared-statement escaping retained its initial SQL-mode state, so the
probe changed control/backslash data under NO_BACKSLASH_ESCAPES. The fixture now
sets the requested mode via connection sessionVariables before statements and
asserts the server mode exactly. jdbcCompliantTruncation=false prevents the driver
from adding STRICT_TRANS_TABLES to the four precisely requested modes. Normal
client prepared statements remain enabled; this was not bypassed with server
prepared statements or weakened value assertions. All four real mode cycles now
round-trip exact data. Only probe configuration changed, not production JDBC.

Evidence under server/eforge-boot/target: generator-mapper-xml-target.log,
generator-mapper-xml-verify.log, generator-mapper-xml-diagnostic.log,
generator-mapper-xml-native-final-0/1.log and generator-mapper-xml-snapshot-0/1.log.
The first failure and corrected successes are preserved separately.
Final local Mapper XML acceptance: authority6963 terminal exit0; default and
enabled profiles each43 actual browsers and all complete API/SQL/Redis/Quartz/
OSHI/ACL/captcha/permission/concurrency regressions pass. Both live OpenAPI exports
match contract SHA256481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
New implementation exact cloud remains pending. Local stage acceptance does not
complete the generator output/UI or the full current goal.
Exact XML-stage cloud acceptance: d8eb258f48bb9a71b8bb3f055eeeaa36fac7fac4,
https://github.com/JRzero/EForge-Enterprise/actions/runs/37432111694, all three
jobs finished SUCCESS. Direct generator-mapper-xml-cloud-accepted.log shows531
backend tests, both32 actual snapshots, both132 actual Mapper/literal probes,
default/enabled each43 actual browsers, complete real APIs and unchanged OpenAPI.
Observer43858 finished exit0. This does not accept the later menu/SpEL source.