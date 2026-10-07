# Initial and expired password reminders

This stage preserves the immutable RuoYi v3.9.2 reminder behavior. It does not
complete registration, remembered credentials, password complexity enforcement,
task mutations, or the entire frontend parity objective. Form builder remains
user-deferred and outside current acceptance.

## Behavior and authority

Canonical bootstrap adds an optional generated `passwordStatus` object. The
server reads the original `sys.account.chrtype`, `sys.account.initPasswordModify`
and `sys.account.passwordValidateDays` configuration through the existing guarded
configuration reader. It derives reminders from the fresh SQL user's password
update date; it never exposes the password hash or credentials.

The initial warning is enabled only for configured value 1 and a missing update
date. Expiration preserves the original absolute, truncated 24-hour difference
and strict `days > configuredDays` condition, including the original future-date
behavior. Initial warning takes priority over expiration. Cancel allows normal
work; confirm opens the retained personal profile's password tab. Dismissal is
scoped to the current mounted account and policy state. Password character type
is metadata at this stage, not evidence of completed complexity enforcement.

## Transaction and resource boundary

Authoritative account, active roles, permissions and navigation are still read
in one read-only REPEATABLE_READ transaction. That transaction now finishes and
releases its SQL connection before password configuration is read. This avoids
joining the configuration reader's existing write guard to a read-only frame,
and avoids holding a snapshot connection while waiting for another connection.
The configuration mutex and its SQL/Redis semantics are not weakened.

Console resource authorization does not read password configuration or extend
login TTL. Data-scope generation and the rejected Quartz mutation schemes are
unchanged. Unit verification checks that snapshot commit occurs before the
policy reader is invoked; runtime verification sends 32 concurrent actual HTTP
bootstrap requests and checks identity, safe policy metadata and successful
completion.

## Evidence and acceptance status

The final isolated source passed full local Maven verification: 613 boot test
declarations (one existing platform skip) and 10 data-scope parity tests. The
unchanged frontend implementation passed 98 unit and 120 mocked browser tests,
lint, type checking, generated-client reproducibility and build in the preceding
isolated authority. Final snapshot changes are backend-only; final lint/type
checking is repeated before real verification.

Earlier real verification exposed the read-only/configuration guard conflict;
that failure is retained. A subsequent run passed the existing 57 real browsers
but failed the new reminder test because its legacy `/getInfo` comparison used
the frontend origin. The final test uses the actual backend origin. These
earlier runs are not claimed as final full API or two-profile acceptance.

Final authority 13398 runs default and enabled console/custom-output profiles
sequentially. Each requires all 58 real browsers, the complete actual API suite,
32 concurrent bootstraps and exact live OpenAPI equality. It is pending at this
document revision. No exact-source cloud acceptance is claimed yet.

The reminder test changes configuration only through authorized canonical APIs,
compares the original and canonical flags, exercises a real no-role account,
cancellation, password update and logout invalidation, then restores exact
configuration records and deletes only its own account. The disposable browser
fixture disables the original default-on reminder for unrelated newly-created
test accounts; the dedicated test explicitly enables and verifies it. Production
seed defaults remain unchanged.
