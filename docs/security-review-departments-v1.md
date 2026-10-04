# Canonical departments security review

Date: 2026-10-04. Scope: `/api/v1/system/departments` and its React consumer.
This is the explicit implementation security review for the new facade's
authorization checks. It does not change the upstream `DataScopeAspect` algorithm,
role scope modes or SQL filtering semantics.

## Reviewed authority boundaries

- Every operation uses the original `system:dept:*` backend permission. Browser
  gates only hide unavailable actions; calling the endpoint directly still checks
  permissions. DTOs never accept `params.dataScope`, ancestors, audit identities,
  deletion flags or other service-owned fields.
- Lists use the existing proxied `selectDeptList` data-scope boundary. Details,
  editing, deleting and every sort item first call `checkDeptDataScope`, then read
  the non-deleted scoped row. The compatibility service's access rejection becomes
  safe HTTP 403 without exposing its exception text. Missing/soft-deleted admin
  resources produce 404; unauthorized callers do not receive their contents.
- Creating requires a visible active parent. A changed parent is also checked
  against scope, existence and ancestor cycles. An unchanged parent outside the
  caller's scope does not block editing a permitted child: this preserves the
  original role behavior without revealing that parent's name or contacts.
- Excluded-parent options are scoped, exclude the edited row and all descendants,
  and compare full 64-bit identities. Forged requests still encounter server cycle
  checks. Presentation never fabricates out-of-scope ancestor nodes.
- Batch sorting validates the entire batch's distinct identities and permissions
  before invoking the existing transactional sort service. Mixed-scope and missing
  members cannot partially modify allowed rows. Single edit/create/delete facade
  transactions preserve hierarchy updates as one unit.
- Canonical mutations acquire the existing root's InnoDB row lock before their
  first consistent read. Waiting transactions therefore read the predecessor's
  committed hierarchy, preventing concurrent mutual reparenting cycles. Root
  deletion is denied server-side, matching the original UI restriction. An active
  sibling-name unique index additionally protects writes through compatibility
  endpoints; its generated NULL key permits repeated soft-deleted-name reuse.
- Existing active-descendant, child and assigned-user protections remain. Enabling
  a child still enables its ancestors through the original service; the runtime
  suite explicitly verifies that behavior rather than silently changing it.
- Decimal-string identifiers are bounded and parsed as `Long`; sort values and
  request lengths are validated. The one compatibility mapper change requests
  JDBC generated keys for the already auto-incremented ID; insertion SQL and
  data-scope filters are unchanged.

## Evidence and limits

`DepartmentControllerTest` exercises the production filter/method permission
chain with isolated persistence: all operation denials, input validation, scoped
parents, subtree exclusion, unchanged parents, cycles, protected deletes and
prevalidated sorting. `DataScopeAspectParityTest` retains all ten original cases.

`verify-departments-integration.ps1` creates an isolated account with a department-
only role in the disposable database, refreshes its actual Redis-backed bootstrap,
and proves scoped reads, denied cross-department detail/add/edit/delete/sort,
unchanged-parent editing, allowed child creation and lack of implicit child scope
grants. It also checks persisted descendant ancestry, soft-delete reads, sorting,
name uniqueness, child/user protection and ancestor enable behavior. Fixture
accounts, grants and sessions are cleaned before prior regression assertions.
Concurrent mutual reparenting produces one valid edit and one cycle rejection;
eight identical creates produce one 201 and seven name conflicts. Repeated name
reuse after soft-delete is also verified against the real generated-column index.

The review approves this additive canonical facade and retains the existing
data-scope semantics. It is not evidence that the still-missing user, role, menu
or other frontend modules are complete; each requires its own implementation and
targeted security/runtime verification.
