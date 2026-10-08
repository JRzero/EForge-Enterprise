# Legacy identity mutation security review

Date: 2026-10-08. Review baseline: `1e5c86a068199fbda74b42e56eb01c80b93459f5`.
Scope: compatibility user editing and role allocation, the shared credential and
profile persistence boundaries, and committed session refresh for the specific
identity mutations listed below. This review accompanies
[session concurrency hardening](security-review-session-concurrency-v2.md).

## Security review conclusion

The changes are approved as additive object authorization and persistence
boundary hardening within this scope. They do not change `DataScopeAspect`,
its generated SQL, the inherited role-scope modes, or the role-list join used by
the original scope checks. The existing `DataScopeAspectParityTest` cases remain
a required validation gate. Adding previously missing calls to those checks
intentionally rejects compatibility operations that could formerly bypass them;
that endpoint behavior change is part of this security review.

The modular monolith, pinned upstream baselines, canonical DTOs, OpenAPI
contracts and original operation permission names are unchanged. Compatibility
routes retain their `AjaxResult` envelopes; they do not acquire the canonical
HTTP/ProblemDetail response contract. Approval of this change is not a statement
that every legacy route now has the same validation and authorization as v1.

## Object authorization at compatibility entrances

[SysRoleController](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/system/SysRoleController.java)
delegates all three role-centric association mutations to the existing
[RoleService.users](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleService.java)
use case:

| Compatibility operation | Shared operation |
| --- | --- |
| `PUT /system/role/authUser/cancel` | Cancel one user's association |
| `PUT /system/role/authUser/cancelAll` | Cancel the requested associations |
| `PUT /system/role/authUser/selectAll` | Assign the requested associations |

The original `system:role:edit` permission is still required before the use case
runs. The adapter rejects missing, non-positive or oversized target lists. The
shared use case checks the role's scope and existence, protects the super-admin
role, and checks every user's scope, existence and super-admin protection.
Duplicate identifiers are rejected. A disabled role cannot acquire a new user;
existing associations can be cancelled. An already satisfied operation remains
idempotent. The complete target set is validated before the first association
write, so a mixed allowed/denied batch cannot partially change the allowed users.

[SysUserController](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/system/SysUserController.java)
also closes the user-centric compatibility routes. `PUT /system/user/authRole`
checks the real target user, rejects protected administrators, and validates the
complete requested role set before replacing links. The shared role helper is
also applied to legacy user creation and editing, because their `roleIds` fields
can replace associations. It checks role scope and existence, rejects the
super-admin role, and disallows a newly assigned disabled role while allowing an
existing disabled association to be retained. The legacy role-allocation read
`GET /system/user/authRole/{userId}` now checks the target user's scope first.

This preserves the inherited treatment of unassigned roles in scoped role
queries. It does not redesign how multiple roles combine their data scopes or
broaden an operator's grant authority to make an otherwise denied request pass.

## Password and self-service field boundaries

The legacy user editor accepts a RuoYi `SysUser`. A Jackson `WRITE_ONLY` password
property can still be supplied in a request, so serialization annotations cannot
serve as authorization for a credential write. The editor now discards that
field. Independently, the shared
[SysUserMapper.updateUser](../server/eforge-system/src/main/resources/mapper/system/SysUserMapper.xml)
statement no longer contains a password assignment. An ordinary edit, profile
update or import update cannot reach the password column through that statement,
even if another caller passes an unsanitized entity.

Account creation still persists the validated initial password through
`insertUser`. Administrative resets retain their separate `system:user:resetPwd`
permission and dedicated `resetUserPwd` SQL, including the password update
timestamp. Both canonical and compatibility self-service password changes keep
their dedicated credential write. No new policy that revokes every existing
session after a password reset is introduced by this change.

The shared
[SysUserServiceImpl.updateUserProfile](../server/eforge-system/src/main/java/io/eforge/enterprise/system/service/impl/SysUserServiceImpl.java)
now creates a new patch containing only the target ID, nickname, email, phone,
sex and update attribution. It uses the inherited mapper's `deptId = 0` sentinel
to leave department membership unchanged. Account status, department, avatar,
credential, login metadata and administrative remarks from the supplied object
cannot enter the profile SQL update. The existing avatar service still uses its
separate `updateUserAvatar` statement.

This is relevant to concurrency as well as request binding: the legacy profile
controller supplies a full cached user object. An in-flight profile request must
not write an old cached account status or department back after an administrator
has changed the database. A Redis compare-and-set cannot repair an unsafe SQL
write that already happened, so the shared profile whitelist is a separate
required boundary. This conclusion does not rely on a cached password hash;
the previously considered password rollback scenario was not established with
the configured serializer and is not asserted as a vulnerability here.

## Transactions and session propagation

The following compatibility operations now participate in the shared department
root-row lock and database transaction before their object reads and writes:

- User creation, editing, status change, deletion and user-centric role assignment.
- Role editing, status change, data-scope change and deletion.
- The three role-centric association routes, through the existing `RoleService`
  transaction boundary.

For changed existing identities, user editing/status/deletion/role assignment
and role editing/status/scope/deletion collect affected user IDs and call
`RoleSessionRefresher.refreshAfterCommit`. The helper copies that set and publishes
no session update on transaction rollback. The role-centric adapter has no new
outer transaction: the canonical use case completes its transaction before
calling the refresher. Legacy role editing no longer computes permissions from
the cached role list through `TokenService.refreshPermissionByRoleId`.

The refresher uses a separate `REQUIRES_NEW` transaction and the shared lock to
read committed account state, active roles, scope and permissions. Its conditional
Redis persistence, TTL preservation, retry and revocation behavior are reviewed
in [the session concurrency review](security-review-session-concurrency-v2.md).
These protections do not cancel a request that was already authenticated before
revocation. MySQL and Redis remain separate resources: a failure after SQL commit
does not undo that commit, and an unavailable Redis service can delay session
propagation. No distributed atomicity or background reconciliation mechanism is
introduced. Best-effort revocation of an identified token is not a guarantee that
all affected sessions are revoked after every failure; a failed or interrupted
refresh still needs operational retry and verification.

## Regression coverage and validation boundary

[LegacyIdentitySecurityTest](../server/eforge-boot/src/test/java/io/eforge/enterprise/web/controller/system/LegacyIdentitySecurityTest.java)
uses actual Spring MVC request binding, production security filters and method
permissions, transaction interception, and the real canonical role use case.
Persistence collaborators and the transaction manager are controlled test
doubles. The cases cover:

- Password injection through both editors, denial without the separate reset
  permission, and valid administrative/self-service password operations.
- Every compatibility role-association operation with denied role scope, denied
  user scope, protected administrators and invalid target identifiers.
- Mixed-scope batches on legacy assignment/cancellation and canonical PUT/DELETE:
  no association write before all object checks pass, rollback on failure, and no
  session publication from a failed operation.
- User-centric role replacement and user add/edit administrator-role protection.
- Successful affected-user refresh scheduling and commit-before-refresh ordering
  on the shared role use case.

[UserMapperCredentialBoundaryTest](../server/eforge-boot/src/test/java/io/eforge/enterprise/web/controller/system/UserMapperCredentialBoundaryTest.java)
parses the actual MyBatis mapper XML and evaluates its dynamic SQL. It verifies
that generic updates cannot bind a password, while creation and dedicated resets
retain credential writes. It also calls the real profile service, captures its
actual mapper argument, and evaluates that argument against the real XML to
check the profile column whitelist. The dedicated avatar service/statement is
checked separately.

These tests exercise the identified boundaries but do not by themselves prove
real MySQL rollback, database isolation, or cross-process Redis concurrency.
Required validation includes the existing user/role/profile controller suites,
`DataScopeAspectParityTest`, the full Maven compile/test gate, and the appropriate
MySQL/Redis runtime integration fixtures. The session change also provides an
actual Redis integration test; its execution requirements are documented in the
linked review. Execution results and CI evidence must be recorded after the
relevant runs complete. This document does not infer a passing run or a test
count from the existence of the tests.

Local targeted results recorded on 2026-10-08: the Maven Surefire reports contain
22 tests for `LegacyIdentitySecurityTest` and 8 for
`UserMapperCredentialBoundaryTest`, each with zero failures, errors or skips.
Those reports establish the targeted controller/service/mapper results above;
they do not establish the outcome of the complete reactor build or the actual
MySQL/Redis runtime fixtures.

The subsequent complete local reactor verification passed with 739 tests, zero
failures or errors, and one Windows-only junction case skipped on Linux. That
run also enabled all six real Redis concurrency tests; see the linked session
review for the baseline/fixed comparison. The disposable MySQL schema, HTTP,
OpenAPI and browser integration gates remain separately reported by CI.

## Remaining identity boundaries

The reviewed entrances are a bounded migration step. In particular:

- Legacy role creation/editing still accepts numeric `menuIds` without the
  canonical `RoleService.write` check that newly granted menus belong to the
  operator's available menu set. The new session refresh on role editing does
  not add that missing grant check. This remains a separate authorization gap
  requiring use-case consolidation or equivalent server-side validation.
- User-import disablement and authorization lifecycle refresh have not been
  included in this round, for either canonical or legacy import. Canonical
  [UserImportService](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/UserImportService.java)
  already has a per-row transaction and root lock, but its status update does
  not schedule the affected session refresh. The legacy overwrite path also
  lacks that callback. Their ordinary mapper updates now cannot change a
  password; this does not establish immediate session revocation after an
  imported account is disabled.
- Other legacy DTO validation, self-service account-state checks and read routes
  have not been made equivalent to the canonical facade in this change.

The earlier [user](security-review-users-v1.md),
[role](security-review-roles-v1.md) and
[profile](security-review-profile-v1.md) reviews describe historical checkpoints.
Their statements that all legacy identity writers remain outside the canonical
lock or session boundary are superseded only for the explicit operations in this
review. They are not evidence that unreviewed compatibility routes are closed.
