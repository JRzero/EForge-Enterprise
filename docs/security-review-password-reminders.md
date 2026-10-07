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

Authority 13398 passed the default profile's 58 real browsers and complete API
suite, then failed the enabled profile's initial aggregate concurrency check.
That first check did not collect exception categories, so its precise cause is
unclassified rather than assumed to be infrastructure or product failure.
Focused enabled authority78224 retained the same 32 requests and 15-second
timeout, recorded HTTP200=32 and zero policy/identity failures, and terminated0.
The fixture now normalizes byte responses exactly as the existing Request
helper does and records safe HTTP/exception categories without credentials.
Authority69991 reruns the entire enabled58/full-API profile with the original
assertions and timeout unchanged; it is pending. Exact implementation
b039ab43dae5e59e97c554f27d44a6cedfd75417 has now passed server37611280476 all
three jobs and web37611280555. Direct accepted cloud logs prove both58-browser
profiles, both32-concurrent bootstrap checks, complete actual API/OpenAPI suites,
613 boot declarations plus10 scope cases,98 frontend units and120 mocked browsers.
Both live schemas match contract49E58409A91C3EC4C84B293C2FF8E7179552216C4D6991DB3BC2F06BFF820C12.
That exact implementation is accepted. Subsequent diagnostic fixture changes
and the independent registration stage are not represented as this SHA's source.

The reminder test changes configuration only through authorized canonical APIs,
compares the original and canonical flags, exercises a real no-role account,
cancellation, password update and logout invalidation, then restores exact
configuration records and deletes only its own account. The disposable browser
fixture disables the original default-on reminder for unrelated newly-created
test accounts; the dedicated test explicitly enables and verifies it. Production
seed defaults remain unchanged.
