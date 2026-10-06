# Generator physical creation execution review (2026-10-06)

The physical phase is implemented as an unwired module-local utility. It has no
HTTP endpoint, Spring bean or request-selected datasource. Original/canonical admin
permissions, shared creation routes, checked automatic metadata import and generated
client are still required before full creation acceptance. The builder remains
user-deferred; other original active parity requirements remain unchanged.

An owned writable autocommit connection is required. The entire request is passed
through the existing read-only batch/database preflight before the first DDL.
Only validated prepared SQL is dispatched, with a thirty-second statement timeout.
IF NOT EXISTS is removed before execution; a competing successful CREATE therefore
returns a conflict rather than a no-op that falsely establishes ownership.

Requested-order immutable outcomes distinguish CREATED (server acknowledgement),
FAILED (an acknowledged SQL error, not a guarantee of physical absence),
UNATTEMPTED (not dispatched) and UNCONFIRMED (timeout/connection loss/unknown SQL
state after dispatch). Execution stops after failure or uncertain acknowledgement.
A statement-close failure cannot revoke an already received CREATE acknowledgement.
Public outcomes contain validated names and fixed codes, never driver messages or
SQL text. No metadata writes, compensating DROP, connection commit/rollback or
application-wide lock is performed. Successful physical DDL remains committed even
if later creation or metadata import fails.

## Real evidence

Both actual MySQL 8.4 case modes pass the combined JDBC probe: 88 assertions for
mode 0 and 86 for mode 1, logged in generator-create-physical-race-mode0.log and
mode1.log under boot target. The persistent script is
server/scripts/verify-generator-creation-preflight.ps1 -LowerCaseTableNames 0/1.
Its existing read-only checks are followed by independent physical-phase cases.

A real oversized VARCHAR error on the second CREATE yields CREATED/FAILED/
UNATTEMPTED. The first table remains; inserting a business row and retrying the
existing target does not delete or change that row. Valid CREATE/LIKE batches
succeed. Mixed CREATE/DROP is rejected with no earlier DDL, and a non-autocommit
caller is refused before creation. The metadata fixture remains unchanged.

An acknowledgement-loss fault is injected in a JDBC statement wrapper after real
MySQL CREATE succeeds. The result is UNCONFIRMED/UNATTEMPTED while the created table
remains. This proves acknowledgement classification and retention; it is not a
claim of a real transport-disconnect test. A separate real database connection
creates and inserts into the target after preflight but before request dispatch.
The request with IF NOT EXISTS reports conflict, skips following DDL and preserves
the competitor's row instead of assuming physical or metadata ownership.

These fixtures only create resources in their unique disposable probe database;
cleanup removes the owned container, not application or business tables. No new
local browser evidence or endpoint creation acceptance is claimed. Full backend
verification and exact implementation cloud acceptance are tracked separately.

## Remaining assembly and acceptance

Add the shared original/canonical admin command service using an owned connection,
separate checked metadata transaction/guard, original legacy template choices and
canonical React target. Report safe structured physical/import outcomes via 201
or creation-local ProblemDetail and compatible AjaxResult. Prove actual import
rollback/retry, actor attribution, SQL privileges, concurrent create/import, denied
roles, OpenAPI/client reproduction and real browser flows. Further schema/view
races, SQL-mode/native-function compatibility and resource boundaries remain active.
Do not claim this physical utility is the completed generator or complete goal.
Final local build: Maven verify passes all 480 cases (470 boot and ten data-scope
parity). The final jar is built. Frontend and canonical contract trees are unchanged
from the previously tested preflight implementation: its lint/typecheck/generated
client, 73 unit, build and 64 fixture browsers remain valid for those unchanged
trees. No newest full application/browser/cloud claim is made until exact-head CI
finishes; the persistent combined SQL probes are required there.