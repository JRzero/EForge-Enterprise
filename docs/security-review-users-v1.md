# Canonical user administration security review

Date: 2026-10-04. Scope: the canonical user facade, XLS/XLSX import/template and React
administration page. Personal profile/avatar remain pending; this review does
not assert full user feature parity.

## Authority and data scope

Every method requires the original `system:user:list/query/add/edit/remove/
resetPwd/export/import` permission. Department filters and date ranges are mapped to a
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

## Import boundary and browser evidence

Import and template require the original import permission independently of
query/edit permissions. Files must be non-empty XLS/XLSX, at most 10 MB and
1000 data rows, with the original login-name header. Original POI/Excel converters
remain behind the boundary; parse errors and row failures return fixed safe codes.

Each row has its own transaction and takes the shared canonical root lock before
reading. Partial commits are explicit in typed ordinal/count/outcome results.
A new sanitized SysUser copies only import columns; supplied IDs, credentials,
grants, audit fields and SQL parameters cannot be mass-assigned. New passwords
use the validated configured value and BCrypt; new rows receive no role/post
grants. Existing target scope is checked before collisions or admin protection.
Overwrite is opt-in and preserves password, department, roles/posts and other
non-import fields. Declared departments still require scope/existence checks.
Import request/response audit bodies are suppressed. React renders result cells
as text, and only the import transport extends its response deadline.

UserControllerTest includes real HSSF/XSSF parsing, template headers, corrupt
files and row limits. Seven UserImportServiceTest cases cover sanitized fields,
hashing, association preservation, per-row rollback, scope ordering, admin
protection and safe failures. Runtime tests verify actual persisted partial
results, login, retained associations and revoked import/template permissions.
Six real user browser cases cover administration, both Excel formats, bulk and
slow imports; read-only/error/mobile fixtures supplement them.

Local validation: 101 backend tests, 20 frontend unit tests, eight fixture and
eleven live browser cases, generated client, seeded routes and security defaults.
All ten data-scope parity cases remain green. Implementation CI passed on `7c0b3cd`; exact run links are recorded in
the parity inventory. The review approves this administration/import
slice; personal profile and the remaining parity groups remain incomplete.
