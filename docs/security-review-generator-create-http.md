# Shared generator creation HTTP boundary — verification in progress

Canonical POST /api/v1/tool/generator/creations and original
POST /tool/gen/createTable now use GeneratorCreationCommand with the original
administrator role requirement. The canonical SQL request has an optional template,
default eforge-react; the original form keeps required sql/tplWebType parameters.
All three original templates remain available.

The command validates template selection before DDL, suspends caller transactions,
preflights the entire batch, then uses its own writable autocommit connection.
Only fully acknowledged physical batches enter the checked REQUIRES_NEW metadata
importer. No physical table is automatically dropped on any failure. Physical
CREATED/FAILED/UNATTEMPTED/UNCONFIRMED outcomes remain separate from metadata
IMPORTED/FAILED/UNATTEMPTED outcomes.

Canonical success is HTTP 201 with concrete creation data. Partial failure is
ProblemDetail with code, creation outcomes, an appropriate HTTP status and no-store.
Pre-DDL errors remain safe ProblemDetail. Original success/errors retain HTTP 200
and AjaxResult, with structured data/failureCode on partial failures. Only creation
moved out of GenController; unrelated original endpoints were not rewritten.
SQL request audit data is disabled on both routes. Requests never choose actor,
datasource, connection or claimed physical ownership. Responses contain outcome
codes/table names/metadata IDs, never original SQL or raw JDBC failures.

Evidence for current uncommitted source:
- 8 GeneratorCreationControllerTest cases with real security filters and
  PermissionService: admin without import grant, ordinary import/edit grants,
  anonymous, invalid body/template, canonical partial errors, original form/
  template compatibility, original partial failures and Ajax boundary.
- Final Maven verify: 478 boot tests plus 10 data-scope parity cases passed; jar built.
- Actual Spring/MyBatis probes: 47 assertions in MySQL case modes 0 and 1.
  Shared-command checks include role/template/mixed-batch rejection before DDL,
  full creation/import, actual late physical failure with retained business rows,
  actual late metadata fault with complete batch rollback and retained tables,
  safe existing-target retry refusal, and suspension of caller transactions.
- Actual OpenAPI candidate and generated client include createGeneratorTables,
  concrete partial-error results and required/write-only SQL input.
- Generated-client reproduction, frontend lint/typecheck, 73 unit tests, build
  and 64 simulated browser cases passed.

The creation-specific real HTTP script passed during the last default run:
canonical/original creation and import, no-role refusal before DDL, complete
mixed-batch rejection, physical partial results/retained business rows, actual
late SQL import faults through both routes with complete metadata rollback and
safe errors, explicit metadata recovery, one HTTP 201 owner versus one HTTP 409
concurrent loser, omitted SQL audit input and failed original-action audit status.

The race fixture initially parsed a byte[] error response without UTF-8 decoding;
actual diagnostic output established String/Byte[] response kinds and correct
GENERATOR_CREATE_TARGET_EXISTS after decoding. Mixed-batch parser errors and
possible metadata-preflight conflict codes are asserted according to their actual
boundaries. The full run then failed because this new fixture reused the existing
configuration test's gc-prefixed username: deleted users retain unique names.
Creation now uses an independent gcrt prefix.

Final default/enabled complete API regressions are terminal success (session
60485, exit 0). Both include creation and all configuration/sync and existing
MySQL/Redis/Quartz/OSHI/ACL/captcha checks. Both live OpenAPI exports exactly match
the contract (SHA256 481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201).
Production security defaults pass. Java/jar were unchanged during application runs.

The final HTTP script also checks explicit metadata recovery, concurrent IF NOT
EXISTS ownership, omitted SQL audit input and failed original-action audit status.
Final real-browser regressions and exact-commit cloud acceptance remain pending.
Reproduction logs: generator-creation-final-disabled-runtime.log and
generator-creation-final-enabled-runtime.log under server/eforge-boot/target.

This stage does not complete generator management UI or generated React/EForge
output. Immutable snapshots, safe output/custom paths, compatibility/resource
boundaries and actual generated CRUD/tree/subtable compile/run/browser evidence
remain required. Form builder is explicitly deferred; other requirements remain.

Final exact-commit acceptance (2026-10-06): implementation f5a62c7931225b86768385fbc2ffe84809f46b84.
Server run 37409725668 is terminal success in all three jobs; web run 37409724884
is terminal success. The server log directly proves default/enabled profiles each
43 real browser tests, both complete creation HTTP fault/recovery/concurrency/audit
regressions, both 47-assertion native Spring/MyBatis probes and exact live OpenAPI.
Evidence: server/eforge-boot/target/cache-tooltip-cloud-final.log. This supersedes
pending statements above. Generator output/UI remain incomplete; form builder is deferred.