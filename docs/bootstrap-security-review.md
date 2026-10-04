# Bootstrap security review

## Scope and decisions

`GET /api/v1/app/bootstrap` is authenticated through the preserved JWT/Redis
filter. It takes its subject from the authenticated `LoginUser`, never from a
request-provided user ID. Public DTOs expose only user ID/name/display name,
role keys, permission strings, and navigation metadata.

User, active roles, menu permissions, and granted navigation are read in one
read-only MySQL REPEATABLE READ transaction. Deleted/disabled accounts lose the
current Redis session. Disabled/deleted roles do not appear in canonical
snapshots. With no active roles, permission fallback into the legacy query is
explicitly avoided rather than querying outside the active-role snapshot.

The shared menu-permission queries are also hardened to require an active,
non-deleted database role, both for per-role lookup and the user fallback.
This closes the reviewed compatibility edge where legacy `/getInfo` could
otherwise regrant a deleted role's permissions after canonical bootstrap had
cleared them. This is an intentional permission-revocation behavior change,
covered by real-session tests through both canonical and legacy endpoints.

The snapshot refreshes the existing Redis login object: user, department,
roles including their data-scope values and per-role permission sets, and
combined permissions. This is an intentional freshness change at bootstrap:
subsequent protected endpoints use the same authorization snapshot as the UI.
It does not provide instant global revocation of every device or session;
other sessions retain existing upstream refresh/expiry behavior until they
bootstrap or expire. Concurrent requests already in flight may still use their
previous snapshot.

The upstream admin identity rule and permission evaluation service remain in
use. `DataScopeAspect`, its SQL construction, permission matching and OR
composition are unchanged. The scope review specifically checks that fresh
roles retain `data_scope` and per-role permissions rather than becoming a
frontend-only role list. The parity suite remains mandatory. Runtime tests
also exercise the seeded ordinary user's custom-department restriction after
bootstrap and verify backend denial after role revocation.

## Navigation boundaries

Only rows granted through active roles are considered for ordinary users.
Admin navigation uses the preserved admin identity. Hidden/disabled ancestors
prune descendants; a granted child is never promoted past an absent ancestor.
Permission filtering is additional UX protection, never a replacement for
backend endpoint checks.

GROUP has no route ID. Unbound legacy pages are omitted, empty groups are
pruned, and external links accept explicit HTTP(S) URLs with hosts and no
embedded credentials. Component paths and Vue router objects are never
selected by the canonical navigation mapper or serialized by bootstrap.
Duplicate identities and cycles are configuration failures; API responses
remain sanitized ProblemDetail. Tree depth is bounded to 64.

The schema uses nullable migration identities to preserve legacy menu writes,
with unique keys, unique route IDs and checks on identifier format and route
eligibility. The unchanged upstream seed is followed by an explicit migration;
no production route bindings are seeded before frontend pages exist. Tests
use disposable database route fixtures, never production seed bindings.

## Verification

- Existing data-scope parity cases.
- Unit tests for fresh sessions, revoked accounts, active roles, and no-role fallback.
- Production security-chain tests for authenticated bootstrap and anonymous denial.
- Projection tests for grants, visibility, ancestors, ordering, cycles,
  duplicate identities, node shape and unsafe external URLs.
- Real MySQL/Redis integration for migration constraints, seed reachability,
  ordinary/admin snapshots, custom-department scope, role revocation and session invalidation.

No data-scope algorithm rewrite or upstream baseline advancement is included.
