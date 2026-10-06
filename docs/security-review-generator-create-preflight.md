# Generator creation preflight security review (2026-10-06)

This is an unwired, read-only foundation. It does not accept physical creation,
canonical or original HTTP creation, metadata import, generated output or UI.
The original admin creation path has not been replaced. Full generator and other
active parity requirements remain; the user-deferred form builder is excluded.

## Implemented boundary

The entire bounded CREATE batch is parsed and checked before a plan is returned.
CTE bindings resolve in declaration order, with recursive self-reference, outer
scope, nested shadowing and qualified physical sources distinguished. FK and LIKE
sources remain physical regardless of CTE aliases. Immutable plans retain ordered
read, foreign-key and LIKE dependencies separately.

Database preflight obtains the selected schema, identifier case mode, SQL mode
and default engine. In case-insensitive modes, it obtains identifier folding from
MySQL itself through parameterized, cached queries rather than Java string case
conversion. Physical lookups use binary comparisons against native folded names.
Case-sensitive mode retains exact identifiers. Qualified schema validation uses
the same native rule, and does not use equalsIgnoreCase to conflate Unicode names.

All targets are checked for physical conflicts, existing generator metadata and
reserved names with the original import collation. Sources must already exist or
be earlier planned targets; self-FKs are permitted, self-reads are not. LIKE/FK
require base tables. Read views are inspected recursively with bounded depth and
count; unavailable definitions, cross-schema sources, unsafe functions and engines
are refused. Queries use scalar parameters and a ten-second timeout. Database
failures return a fixed 503 without SQL or driver details. No DDL, transaction,
commit, rollback or global application lock is issued by the preflight library.

Parser-sensitive SQL modes currently fail explicitly. This supported-baseline
constraint is not proof of complete SQL-mode or native-function compatibility;
that compatibility review remains before full creation acceptance.

## Evidence

- 36 targeted tests pass (14 parser, 22 policy). The prior warm-JVM test reproduced
  StackOverflowError for spaced exclamation prefixes: the pinned lexer folds pairs
  into BANGBANG. The iterative pre-parser guard now counts both prefixes before
  recursive parsing. No StackOverflowError catch is used to conceal the failure.
- Complete Maven verify passes 480 tests: 470 boot and ten data-scope parity cases.
- Actual JDBC MySQL 8.4 probes pass 68 assertions in case mode 0 and 66 in mode 1.
  Different counts reflect actual native Unicode binding and the expected rejection
  of uppercase schema in mode 0. Probes compare dotted/dotless I CTE lookup against
  native SELECT results, and execute prepared nested/Chinese CTE SQL to check rows.
  They also cover existing/IF NOT EXISTS/metadata conflicts, reserved accented names,
  missing/future sources, self-FK, views, SQL modes, denied metadata access, fixed
  errors and source retention. Unique disposable containers are removed afterward.
- Reproduction: server/scripts/verify-generator-creation-preflight.ps1 with
  -LowerCaseTableNames 0 and 1 after Maven verification. Latest logs under boot
  target: generator-create-unicode-native-mode0.log and mode1.log.
- Previous exact commit bbd15566d99fe26d8cdb578dd26d2729b6e72acd has all three
  server-ci jobs successful, run 37395625273. That evidence does not validate these
  newer changes. Current exact-head cloud acceptance remains pending.

## Required next boundaries

Preflight metadata reads are not an atomic freeze of schemas, views or engines;
trusted concurrent database changes and execution-time races still require an
honest execution review. Native functions, SQL modes and resource boundaries
require continued compatibility coverage. The standalone pure policy overload's
character folding is not a substitute for production native preflight.

Implement shared original/canonical admin creation, checked independent metadata
import transactions, actual successful-DDL ownership and safe structured
created/failed/unattempted/unconfirmed outcomes. Account for implicit DDL commits,
IF NOT EXISTS races, disconnects, partial failure and retry. Never automatically
DROP created physical tables or business data, or hold a long global runtime lock.
Then deliver React/EForge templates, immutable output snapshots, safe preview,
download/custom paths, complete pages and actual generated CRUD/tree/subtable
compile/run/browser evidence. This foundation is not full creation acceptance.
Current local regression checkpoint: frontend lint, typecheck, generated-client
reproduction, 73 unit cases, build and 64 fixture browsers pass. The default
complete MySQL/Redis/Quartz/OSHI/ACL/captcha and existing generator API regression
passes; its normalized OpenAPI equals the committed contract (SHA256
C93BAE9CBD939035B71BE5C2179035EDE774FCB826F71469D30866271BA37ECB).
Enabled-console regression is continuing in the same sequential process; no new
local live-browser run is claimed. Prepared-SQL fidelity probes pass in case
modes 0 and 1. Both fidelity and JDBC preflight profiles are now required CI steps,
but their newest cloud result must still be checked on this exact implementation.