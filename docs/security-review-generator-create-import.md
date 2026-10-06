# Generator creation metadata import review (2026-10-06)

This is the checked metadata phase, not a completed HTTP creation feature. The new
Spring service is not yet assembled with physical execution or either creation
route. Canonical DTO/client, original compatibility boundary and browser/HTTP
creation acceptance remain required. Builder scope is explicitly user-deferred.

The original admin role is checked on the service proxy. Having only tool:gen:import
is insufficient; an admin needs no additional import grant. Actor attribution comes
from the authenticated principal, not request data. Only a fully acknowledged
physical result can enter this phase; partial/unconfirmed results are refused.
The command assembly must obtain that result internally, never bind it from a request.

REQUIRES_NEW starts an independent metadata transaction and takes the existing
feature-local SQL guard. No DDL, compensating DROP or long application-wide runtime
lock is used. Physical names are resolved using current native MySQL case rules;
table and column queries use binary selected-schema/name comparisons, rather than
information_schema's case-insensitive equality that conflates case neighbours.
The original attributed GenUtils/mappers initialize metadata behind this boundary.
Original Element UI/Plus/Plus TypeScript choices and canonical eforge-react remain
available, without claiming React generation templates are already implemented.

All physical rows/fields and existing metadata are checked before writing. Each
table/column write must affect exactly one row and return its ID. Responses preserve
requested/actual names and string IDs. A missing physical schema, existing metadata
or write failure aborts the whole transaction. Database errors have fixed public
codes/messages without SQL or driver details; physical tables survive import failure.

## Actual evidence

Each MySQL 8.4 case-mode profile passes 27 assertions in the real Spring method
security/transaction proxy with MyBatis XML and the actual baseline metadata tables
plus V024/V025 migrations. Logs are generator-create-import-guard-mode0/1.log
under boot target; persistent reproduction is
server/scripts/verify-generator-creation-import.ps1 -LowerCaseTableNames 0/1 after
Maven verification. The runner uses Maven's resolved classpath, drops only empty
classpath entries, owns one unique ephemeral localhost database and cleans it up.

- An ordinary role with the import grant is denied before metadata changes; admin
  with no import grant succeeds. Table and field actor attribution is retained.
- Case mode 0 has a separate differently shaped case-neighbour physical table;
  only the acknowledged table's two fields are imported. Mode 1 preserves the actual
  lowercase name from an uppercase request. ID 9007199254740995 remains exact.
- A real trigger corrupts the second table's field beyond its SQL length under
  strict mode, after the first table's complete metadata was inserted. All new
  tables/fields roll back, prior records remain and both physical tables survive.
  Removing the fault and retrying succeeds with original template selection.
- A caller transaction inserts a business row, calls the importer, then rolls back.
  The business row rolls back while the REQUIRES_NEW metadata commit remains.
- Two real concurrent transactions get exactly one success and one existing-table
  conflict, with a single complete metadata/field set. TypeScript template retained.
- Unconfirmed ownership and null template are refused with fixed safe errors.

This is not HTTP/JWT/session or full creation acceptance. No new local browser run
is claimed. Full backend verification and newest exact implementation cloud results
must be recorded separately. Preflight commit 67e7bc2381d7a52ada3e1b49e72c0eea61767c76
has all three server jobs successful in run 37401067568; that prior evidence does
not accept these new changes. Physical commit b7d78bf cloud acceptance is tracked
separately. Existing frontend/contracts are unchanged.

## Required next step

Assemble the shared admin command using an owned physical connection and this
separate import service. Preserve physical/import results when the later phase
fails, return canonical 201/safe structured ProblemDetail and compatible original
AjaxResult without SQL logging, generate client and test both HTTP routes. Preserve
all original creation capabilities, review source/SQL-mode/function/resource races,
and prove permissions, actual create/import failures, retries, concurrency and
complete browser/OpenAPI behavior. Then finish React outputs and full generator UI.
Final guard SQL fault: the owned fixture temporarily renames the guard table.
Import returns the same fixed safe failure, does not change any metadata and
retains the acknowledged physical target. This final source places the guard SQL
inside the database-error boundary. Both final profiles pass 27 assertions.
Maven verify passes 480 cases (470 boot plus ten data-scope); final jar is built.
Frontend/contracts remain exactly unchanged from b7d78bf. Its exact server run
37401957208 is now all-three successful, with actual 88/86 SQL phase assertions
and both 43-live-browser profiles confirmed from workflow logs. Both old watches
are terminal; none of that older CI proves the new import-service cloud acceptance.
Exact implementation afde85813221b2ad9320bdcf73306547a883ca08 is accepted for this
metadata phase: server 37403883802 all three jobs completed successfully. Cloud
logs confirm both actual Spring/MyBatis profiles pass 27 assertions and both
existing live-browser profiles pass 43. Complete MySQL/Redis/Quartz/OSHI/ACL/captcha
regressions and both exact OpenAPI checks succeed. The final local packaged Maven
classpath also passes both 27-case profiles (generator-create-import-packaged-*
logs), not merely the compile-phase classpath. Watch 22533 is terminal success.
This supersedes the earlier newest-cloud pending checkpoint. No physical/import
HTTP command or creation UI acceptance is claimed; those routes remain unassembled.