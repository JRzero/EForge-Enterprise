# Canonical role security review

Date: 2026-10-04. Scope: `/api/v1/system/roles` and committed role changes in
existing Redis sessions. This is a backend/client checkpoint; the React role
page and interactive grant/department trees are still pending.

## Authorization and migration boundary

Every endpoint enforces the original role list/query/add/edit/remove/export
permission. The original role, menu, department and user services remain behind
concrete canonical DTOs. Decimal IDs are strings, menus use stable `menu_key`,
and menu options never expose database component names. Authorization options
are separate from navigation: M/C/F grant nodes do not invent React routes.
Neither upstream architecture baseline advances.

The canonical facade adds explicit role data-scope checks before detail reads,
status/scope writes and assigned/unassigned user reads. Assignment/cancellation
checks the target role and every user before any association write. Department
scope selection checks every department. Missing, deleted, protected admin and
out-of-scope objects cannot partially mutate a batch. Admin role 1 cannot be
edited/deleted, and admin user 1 cannot be assigned/cancelled. Disabled roles
cannot acquire a new assignment; existing grants can be cancelled. Repeated
assignment/cancellation is idempotent. These are additive object guards where
legacy controller operations lacked equivalent checks; DataScopeAspect and its
ten parity cases are unchanged. The original scoped role-list join is retained,
including its treatment of unassigned roles for non-admin operators.

New menu grants must be in the original operator menu-option scope. Existing
unavailable grants can be retained or explicitly removed during an authorized
edit; an operator cannot newly add another unavailable menu. This preserves
existing associations without silently broadening the operator's grant power.
Options retain original menu status semantics, while actual permissions and
session roles use the existing active-role/menu filter. Mutation DTOs cannot
inject audit identities, admin IDs or arbitrary service fields.

## Database and session consistency

Canonical mutations acquire the shared department-root row lock before their
first snapshot read. Original transactional services write role/menu/department
and user associations. V009 enforces unique active role names and keys in MySQL,
including legacy writers; soft-deleted identities can be reused. Existing active
duplicates must be resolved before migration, which never deletes data. Legacy
writers do not participate in the canonical shared lock.

After commit, a separate REQUIRES_NEW transaction acquires that same lock before
reading fresh account state, active roles (including dataScope) and permissions.
This prevents an older canonical mutation callback from publishing an older
snapshot after a newer canonical mutation. Only sessions of affected accounts
are considered. Disabled/deleted/missing accounts are revoked. Redis SET XX
updates only a still-existing session and preserves its remaining TTL, token and
expiration timestamp; it never recreates a logged-out or expired session. Empty
active roles produce empty permissions. Scope/status/menu/user-assignment
changes therefore affect protected requests without requiring bootstrap first.

MySQL and Redis remain separate resources. Redis failure after database commit
can return an error despite a committed role change; no rollback across Redis
is claimed. Operators must retry the idempotent change/refresh, and bootstrap
continues to read authoritative database roles. Availability failures can delay
permission propagation; this checkpoint does not establish distributed atomicity.
The existing token middleware also uses Redis for authentication. Concurrent
legacy/bootstrap/profile session writers remain outside this refresher's lock
and are not claimed to have a stronger consistency guarantee.

## Evidence

`RoleControllerTest` covers production filters/method permissions, concrete DTOs,
large string IDs, parameter/body validation, admin/missing/scope checks, safe SQL
conflicts, preserved scope and primitive flags, menu grant bounds, complete
user/department/delete batch checks, idempotency, and commit-before-refresh.
`RoleSessionRefresherTest` covers fresh scope/permissions, root-before-read,
REQUIRES_NEW, TTL preservation, conditional writes after logout, expiration,
disabled-account revocation, untouched unrelated sessions and rollback before
cache access when the root is missing.

`verify-roles-integration.ps1` is part of the owned disposable MySQL/Redis runtime
fixture. It checks actual persistence, database 1062 constraints, filtered typed
pages and XLSX XML content; assigned/unassigned users and mixed-invalid batch
guards; existing-session grants/revocation/status; all five original data-scope
modes; cross-scope role/user and menu-grant denial; concurrent duplicate creation
and deleted-identity reuse. Passing results and CI links are recorded in the
parity inventory after completion of validation.
