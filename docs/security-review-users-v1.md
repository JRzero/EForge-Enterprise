# Canonical user administration security review

Date: 2026-10-04. Scope: the new `/api/v1/system/users` core facade. Import,
profile/avatar and the React administration page remain pending implementation
and their own verification; this review does not assert full user feature parity.

## Authority and data scope

Every method requires the original `system:user:list/query/add/edit/remove/
resetPwd/export` permission. Department filters and date ranges are mapped to a
new `SysUser` filter; client data-scope expressions never enter service parameters.
Reads retain the original proxied `selectUserList` and `checkUserDataScope`
boundaries. Detail and role-allocation reads check target scope first, including
the role-read boundary omitted by the legacy compatibility controller.

Create/edit checks the original department and role data-scope boundaries and
verifies that referenced departments, roles and posts exist. New assignments to
disabled entities are rejected; an existing disabled assignment can be retained
when editing other fields. Removing an existing assignment is permitted.
The original UI excludes the super-admin role from ordinary user allocation;
the facade enforces that exclusion at the server. Super-admin mutations and
deleting the current user are rejected. Batch deletion validates every target
before calling the original transactional deletion service.

A missing department remains supported for the administrator, as in the original
optional department form. A non-administrator must supply a scoped department;
the legacy null-ID scope check is not used to grant an unscoped create/update.
This explicit boundary hardening is approved for the additive facade. No original
data-scope algorithm, role scope mode or parity case is changed.

## Mutation and credential boundaries

Canonical user mutations participate in the department root row lock before the
first snapshot read, coordinating with canonical department deletion and other
canonical account mutations. Transactions include user/role/post association
updates. Legacy compatibility mutations do not participate in this lock. V007
adds database uniqueness for active account names and non-empty phone/email,
including concurrent or legacy writes. Existing duplicates must be resolved
before migration; deleted rows and empty contacts do not reserve an identity.

DTOs accept only public profile fields and string association identifiers.
They cannot mass-assign password hashes, deletion flags, audit identities,
internal roles or SQL parameters. Login names are immutable after creation,
matching the original disabled username editor. Ordinary profile edits cannot
change a password. Separate create/reset contracts validate password format,
hash with the original BCrypt helper and suppress request logging. Their
`toString` methods redact credentials. No response exposes a password/hash.

The configured initial password is available only to users with query permission,
as in the original editor. Its response prohibits caching and audit logging;
it is not included in bootstrap or user details. Existing login/bootstrap logic
continues to invalidate disabled/deleted accounts and refresh real Redis roles.
Password reset preserves the original existing-session behavior; it verifies
that old credentials stop authenticating and new credentials work.

## Required evidence

- `UserControllerTest`: production permission filters, safe DTOs/string IDs,
  validation, dates, department/role denial, association retention, password
  hashing, admin/self protections, all batch prechecks and operation permissions.
- `verify-users-integration.ps1`: real MySQL CRUD/association persistence, cleared
  fields, scoped filters/paging, active-name/contact uniqueness, concurrent
  duplicates, repeated reuse after soft deletion, login/password reset,
  disabled-account Redis invalidation and filtered XLSX cell inspection.
- Independent department-only role proves scoped reads/mutations and denial of
  every operation after real menu permission revocation and bootstrap refresh.
- All ten `DataScopeAspectParityTest` cases remain required.

The review approves the core facade within these boundaries. Browser user
administration parity, imports/templates and personal profile capabilities must
remain incomplete in the parity inventory until their own evidence is available.
