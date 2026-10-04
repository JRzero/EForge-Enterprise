# Self-service profile security review

Date: 2026-10-04. Scope: canonical `/api/v1/me`, password change and avatar
storage. The React profile/crop page remains pending; this is an API checkpoint.

## Identity and authorization

The authenticated Redis session supplies the account ID. No endpoint accepts
another account ID or requires administration grants: original profile behavior
is self-service. Every operation reads the current database account and rejects
disabled/deleted/missing accounts, revoking the current token. DTOs expose safe
profile fields, role/post labels, department and creation date, never credentials
or RuoYi service objects. Responses are not cached. Avatar URLs are restricted
to local uploaded-resource paths; external/database-provided URLs are omitted.

Updates accept nickname, required mobile/email and sex, matching the original
profile form. Validation also runs on the server. A newly constructed service
patch cannot assign grants, state, credentials, avatar or audit identities.
The original mapper's zero department sentinel is explicitly used to preserve
department membership. Original contact uniqueness and V007 indexes apply.

## Mutation and session boundaries

Mutations take the canonical department root lock before the first database read
and commit before refreshing the existing Redis session. Conflicts roll back;
failed writes cannot change cached fields. Only the updated profile fields are
copied into the session, retaining its permission/role snapshot. This does not
change DataScopeAspect or its ten parity cases. Legacy writers remain outside
the canonical lock, as documented for user administration.

Password change checks the fresh database BCrypt hash rather than a stale
session hash, rejects wrong old passwords and unchanged passwords, validates
6–20 characters and the original prohibited characters, and uses the original
password-reset service. Request/response logging is suppressed and the request
record redacts its string representation. The existing session remains valid,
matching the original behavior, while old credentials stop authenticating.

## Avatar boundary

Uploaded JPG/PNG/GIF/BMP images must be non-empty and at most 10 MB. Actual
ImageIO decoding, dimensions at most 4096 per side and 16 million pixels are
checked before full raster allocation. Only the first frame is normalized to PNG,
matching the original browser crop output. Metadata and appended payloads are
not copied. Client filenames do not determine storage paths. Generated UUID
filenames live only under `/profile/avatar/canonical/` in the configured avatar
directory. Public uploaded-resource serving retains the original behavior.
Missing files in this new namespace return HTTP 404 ProblemDetail before legacy
success-envelope error handling. Other legacy uploaded-resource paths are unchanged.

A failed transaction removes the newly created file. After commit, replacement
removes only a previous canonical UUID file. Arbitrary legacy/database paths
are never followed for deletion. Cleanup failure cannot reverse a committed
database update. Database, filesystem and Redis are separate resources; a Redis
failure after commit can report failure despite a committed update, and a storage
cleanup failure can leave an orphan. No distributed transaction is introduced.

## Evidence

`ProfileControllerTest` uses production security filters and the real profile
service: self-service without management grants, string IDs, malicious field
injection, validation, uniqueness rollback, transaction-before-cache ordering,
wrong/unchanged/hashed passwords, inactive account revocation, avatar rollback
and replacement ordering, unauthenticated denial and missing-resource HTTP 404. `AvatarStoreTest` checks
actual raster formats and PNG output, corrupt/empty/SVG/oversized inputs and
deletion containment. These add 22 tests to the 101-test baseline.

`verify-profile-integration.ps1` uses disposable MySQL and Redis to verify actual
profile persistence without changing departments/grants/posts, uniqueness
rollback, legacy session refresh, bootstrap, old/new login credentials, real
served PNG bytes, replacement cleanup, fresh reads from another session and
disabled-account token revocation. Implementation `f319bd7` passed all server and web CI jobs; exact run links
are recorded in the parity inventory. The page was pending at that API-only checkpoint; current page evidence follows.

## React implementation follow-up

The locally implemented profile page uses the authenticated fixed internal
route, generated APIs and original self-service access. No credentials or profile
fields are added to tab storage. Password fields are masked by default; mismatch
validation runs before submission, and success clears all three fields. Background
bootstrap refresh keeps the current page and guards stale results after logout.
Actual server checks remain authoritative for conflicts, old credentials and
account state. Canvas output is bounded to 200×200 PNG, with byte/dimension checks
and decoded preview, explicit cancel, and no copied EForge source.

The real no-grant browser flow passed, including actual pointer drag and entire
output bitmap hash/dimension inspection, login/association/session outcomes and
old-avatar 404. Keyboard tab focus/switching, mobile overflow and crop-window
bounds also passed. Runtime uploads use a unique owned directory that is removed
only after validating its resolved absolute path beneath the fixture log root.
Frontend lint/typecheck, 23 unit tests, build, generated client, nine fixture and
twelve live browser cases passed. Implementation `dbd131d` passed all server
and web CI jobs; exact run links are recorded in the parity inventory.
