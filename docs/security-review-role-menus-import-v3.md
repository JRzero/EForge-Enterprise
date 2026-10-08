# Role menu grants and imported user session lifecycle

Date: 2026-10-08. Review baseline:
`06bf8f0607d6a3333c177f26f3b9518d8efa2081`.

This follow-up closes the two HTTP identity boundaries left in the
[v2 compatibility review](security-review-legacy-identity-v2.md): menu grants in
legacy role creation/editing, and session publication after user imports.
It builds on the [v2 session concurrency rules](security-review-session-concurrency-v2.md).

## Review conclusion and architecture

The change adds server-side object authorization and committed-row accounting.
`DataScopeAspect`, inherited role-scope modes and their SQL remain unchanged.
Existing parity tests remain a required gate. The modular monolith and pinned
upstream dependencies are retained.

The legacy role controller calls the existing boot-layer `RoleService` policy.
The legacy import controller adapts the existing boot-layer `UserImportService`.
No reverse dependency from `eforge-system` to `eforge-boot`, duplicate import
implementation, or general event infrastructure is introduced.

## Menu grant boundary

[RoleService](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleService.java)
shares its `MenuGrantScope` checks between canonical menu keys and compatibility
numeric menu IDs. A requested menu must exist and either belong to the
operator's current available menu set or already belong to the real target role.
The canonical path retains its existing per-item error ordering.

For a non-administrator, the available set comes from a dedicated
[RoleSelectionMapper](../server/eforge-system/src/main/java/io/eforge/enterprise/system/mapper/RoleSelectionMapper.java)
query over the operator's currently enabled, non-deleted source roles. The
general menu display query is not an authorization source: it also lists menus
attached to disabled or deleted roles. Such a role cannot supply a new grant,
while the same menu remains grantable if another active role supplies it.
Administrator menu access and menu status/visibility management keep their
existing behavior; this check filters source roles, not display metadata.

[SysRoleController](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/system/SysRoleController.java)
checks the complete set before writing the role or deleting/replacing links:

| Entrance | Boundary |
| --- | --- |
| `POST /system/role` | Requires `system:role:add`; enters the shared root-lock transaction; discards a supplied role ID and uses a new database identity. There is no previous-grant exception for creation. |
| `PUT /system/role` | Requires `system:role:edit`; enters the root-lock transaction; checks the actual persisted target's scope, existence, deletion state and administrator protection before reading its existing grants. |
| Both legacy writes | Reject null arrays, null/non-positive IDs, duplicates, more than 2,000 IDs and nonexistent menus. An empty array explicitly requests no menu grants. |
| New grants | Reject a menu outside the operator's available menu set before any role or association write. |
| Existing broader grants | Permit explicit retention or removal of a menu already on the target. Once removed, the same restricted operator cannot regrant it using the previous-grant exception. |

The retained-grant rule is inherited from canonical role editing. It does not
give the operator ownership of the target's menu set. A different authorized
operator can still grant a removed menu normally. Client-provided role IDs or
menu fields never establish the previous set.

Successful legacy edits retain the existing committed-session refresh callback.
Rollback publishes no refresh. A failure in an after-commit callback cannot
roll back the already committed SQL mutation.

The legacy envelope remains `AjaxResult`; deliberate validation/existence
failures translate to its numeric code, and denied grants use its permission
error. The canonical facade retains HTTP status and ProblemDetail semantics.

## Import commit and session boundary

Both `POST /api/v1/system/users/import` and
`POST /system/user/importData` now use
[UserImportService](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/UserImportService.java).

Each row runs in a `REQUIRES_NEW` transaction under the existing root lock. A
successful transaction returns its outcome and, for an update, the affected
user ID. Only after that transaction returns does the importer count the update
and add its ID to the committed set. Validation failures, denied targets, zero
row updates and rolled-back writes do not enter this set.

After all rows have been attempted, the importer calls `RoleSessionRefresher`
once with the distinct committed update IDs. A later failed row cannot suppress
publication for earlier successful rows. Repeated updates of the same account
produce one refresh against the final committed state. Creating accounts alone
does not scan existing sessions. The explicit independent transactions also
prevent an unrelated outer rollback from cancelling publication of rows that
have already committed.

The shared refresher rereads authoritative account state. Disabled or deleted
accounts lose their existing sessions; normal accounts receive the committed
profile and current authorization through the existing compare-and-set writer.
Re-enabling an account does not recreate an old revoked token.

Both paths continue to preserve an existing user's department, roles, posts,
password, avatar and administrative remark during import. A workbook department
is checked under the inherited policy; updates still keep the persisted
department rather than reassign it.

### Response and failure semantics

| Result | Canonical HTTP contract | Compatibility HTTP contract |
| --- | --- | --- |
| All rows succeed | HTTP 200 with the existing typed counts and per-row outcomes | HTTP 200, Ajax code 200 and summary |
| Some rows fail, committed rows and session publication complete | HTTP 200 with ordered `CREATED` / `UPDATED` / `FAILED` outcomes | HTTP 200, Ajax code 500; summary explicitly says successful rows were saved and asks the caller to check failed rows |
| Committed updates exist but session publication fails | HTTP 503, `USER_IMPORT_SESSION_REFRESH_FAILED` | HTTP 200, Ajax code 503; message explicitly states committed data was not rolled back |

The publication call is outside the per-row SQL failure catches. Its failure
cannot convert already committed updates into failed SQL rows or silently
produce a successful summary. The canonical failure returns a ProblemDetail
instead of the normal per-row result, so the caller must verify the persisted
data before deciding to retry. The frontend displays that distinction and keeps
the chosen file and update option; it does not automatically resubmit.

Row-processing and session-publication errors expose controlled codes rather
than raw database/cache exception details. Compatibility summaries HTML-escape
usernames and code text. Database
commit failures can still have uncertain outcomes; the summary does not assert
that every reported failed attempt definitely wrote nothing.

### Compatibility changes and remaining limits

The legacy HTTP import now inherits canonical row validation: username length
2–20, phone format, sex/status values, initial-password policy, uniqueness,
account scope and administrator checks, and the fresh-entity field whitelist.
Previously accepted rows outside those rules can now fail validation. The
compatibility upload parser remains its original `ExcelUtil` entrance; this
change does not claim to adopt the canonical controller's file-size, extension
and 1,000-row checks there.

`ISysUserService.importUser` remains declared and implemented for source
compatibility, but no production HTTP controller calls it after this change.
It has not acquired the shared lifecycle rules. New HTTP import entrances must
reuse `UserImportService` rather than reconnect the old method.

MySQL and Redis are still independent resources. A cache failure after SQL
commit can leave publication incomplete and requires operational verification
and retry. The existing refresher can stop on a failed affected session; this
change does not promise that all other affected sessions are revoked after
every failure. It also does not cancel a request authenticated before revocation.

Other legacy endpoints and the general legacy `GlobalExceptionHandler` are
outside this change. That handler still returns messages for unexpected runtime
exceptions; controlled errors in the new import adapter are not evidence that
all legacy error responses have been sanitized.

## Verification

- `LegacyRoleMenuSecurityTest`: 47 cases covering real controller binding,
  method permissions, target ordering, menu-set validation, retained grants,
  generated create identity, rollback and after-commit callback ordering, the
  dedicated grant source and administrator behavior across all four writes.
- `RoleControllerTest`: the canonical menu options use the same grant source as
  writes, and administrator options retain all known menus.
- `UserImportSessionTest`: 8 cases using Spring's actual
  `DataSourceTransactionManager` with controlled JDBC collaborators to verify
  commit, rollback, suspension, independent-row publication and cache failures.
  These are not a substitute for actual database isolation tests.
- `LegacyUserImportControllerTest`: 8 cases with real XLSX parsing and the shared
  importer, covering both HTTP contracts, partial success, publication failure,
  permissions, empty files and escaped error summaries.
- `user-import-api.test.ts` and `user-import-outcome.spec.ts`: generated transport
  keeps partial outcomes, the publication-failure code reaches the UI, the
  committed-data warning is visible, and no automatic retry occurs.
- `verify-identity-lifecycle-integration.ps1`: the existing disposable auth
  harness now exercises real MySQL, Redis and HTTP for the menu policy and both
  imports. The restricted operator does not hold the target role. Separate
  disabled/deleted source roles verify that inactive authority cannot leak into
  menu options or new canonical/legacy grants. SQL snapshots verify denied
  writes leave metadata/associations unchanged. Import fixtures
  test success/failure/success rows, immediate old-token rejection, retained
  session profile updates, re-enablement without token resurrection, and
  preservation of department/role/post/password state.

The runtime checks first use an ordinary protected request, before bootstrap.
Their subsequent `/getInfo` nickname assertion reads the cached user rather than
mistaking a fresh database profile read for a session update. Fixture output
does not print credentials, token values, password fingerprints or Redis contents.

Local validation on 2026-10-08 ran all backend tests with real Redis enabled:
**803 retained tests, zero failures/errors, one Windows-only junction case skipped on
Linux**. This includes all 6 real Redis and 10 data-scope parity cases. Maven
package verification also completed successfully with tests skipped after that
full test run.
Frontend lint, typecheck, generated-client reproducibility, 117 unit tests and
build passed. The 2 relevant browser cases passed. Four runtime workbooks
containing 10 rows were generated and read back locally; the full PowerShell,
MySQL/Redis HTTP probes and complete browser suites execute in the PR CI checks.
