# Canonical generator import review

Scope: POST /api/v1/tool/generator/imports imports 1–100 selected current-schema
physical tables into generator metadata. The original tool:gen:import grant is
server-authoritative; list/query grants alone do not permit writes. The audit log
retains the original generator IMPORT event. Actors come from authenticated server
state, never request fields. Created IDs are decimal strings, with requested table
order and actual imported field counts. No compatibility response objects escape.

The original attributed GenUtils initializers and parameter-bound metadata mappers
remain behind the canonical service. Every selected database table and its fields
is resolved before any insert. Missing/excluded tables reject the whole selection,
repeated selections are invalid, and already imported tables return typed 409.
One Spring transaction owns all table and field inserts; a failed/zero insert throws
and rolls back the batch. Database failures never publish SQL or schema details.
The generated target is eforge-react. React/EForge templates and complete generated
code acceptance remain pending; importing metadata does not prove output support.

V024 adds a unique physical-table identity to gen_table. This enforces concurrent
import exclusion for canonical and compatibility writes, without a JVM lock or
changes to task dispatch. Existing duplicate configurations deliberately fail the
migration instead of deleting or merging user metadata. Before applying it to an
existing deployment, inspect duplicate table_name groups and resolve the intended
configuration explicitly. The migration does not execute physical-table DDL or
change field configuration. The import endpoint does not create physical tables,
write output files, or render templates. Original discovery exclusions remain.

Twelve targeted MVC cases exercise original grant separation, authentication,
selection validation, preflight before writes, exact IDs, authenticated actors,
original field initialization, duplicate conflicts, empty schema, zero insert and
sanitized SQL failure. The real integration verifier owns unique disposable tables
in the parent-owned MySQL schema. A temporary INSERT trigger fails after partial
work to prove actual transaction rollback/no orphan fields; retry proves recovery.
Two actual HTTP import requests race for one table, requiring one 201, one 409,
one metadata row and one complete field set. Anonymous/no-role access, initialization
and repeat-import preservation are verified. The trigger, metadata, physical tables
and no-role account are removed in finally blocks. No production data is touched.

Full local and exact-head cloud results are recorded only after those checks finish.
Import/create/configuration update/delete/sync/preview/archive/custom-output UI,
remaining canonical writes, React/EForge templates, runnable generated CRUD/tree/
subtable modules, form builder, shell/shared parity and final capability audits
remain required. This import checkpoint does not complete the generator module.
