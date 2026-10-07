# Canonical registration and native page

This stage implements the original optional self-registration capability, not
general password-complexity enforcement or remembered credentials. Original
RuoYi sources and immutable commits remain pinned. No EForge source is copied.
Full project acceptance and the explicitly deferred form builder are unchanged.

## Public and compatibility boundaries

Only GET `/api/v1/auth/registration` and POST `/api/v1/auth/register` are added to
the production security chain's exact method-specific public allowlist. The GET
exposes one boolean, reads the original `sys.account.registerUser` setting and
does not publish configuration values. Production seed remains `false`; missing,
malformed and non-exact `true` values do not enable registration. POST rechecks
the server switch independently of earlier browser availability.

The new DTO accepts username, write-only password/confirmation and bounded
captcha values. Canonical validation preserves original registration lengths
and the original browser's forbidden password characters. Confirmation mismatch
is rejected before the original service consumes captcha or writes an account.
The migration adapter creates only the original RegisterBody and calls preserved
SysRegisterService: BCrypt, current password-update date, configured single-use
captcha and original async success audit remain authoritative. Request-supplied
department/role/post fields cannot assign grants. Legacy `/register` stays behind
its existing compatibility boundary.

Success is201 with no response credentials, user hash, token, session cookie or
automatic login. Existing usernames and actual SQL unique-index races return
safe409. Upstream failure and SQL faults return safe503; driver/SQL/username
messages are not serialized. Captcha failures retain the existing canonical400.
No task runtime locks or denied Quartz schemes are implemented.

## Native page behavior

The login link follows current availability. Direct `/register` supports loading,
disabled state, retrieval retry, captcha refresh, confirmation and original
length/character checks. Pending registration disables a second submission and
in-app login navigation. Failed writes clear secret fields and request a fresh
challenge; ambiguous network results are reported rather than automatically
resubmitted. Success is literal React text and requires separate login. No
password is persisted to browser storage. Existing browser password-manager
autocomplete uses `new-password` fields.

Authenticated `/login` replaces its location with `/dashboard`; a fresh no-role
account correctly sees403 there and can enter its own personal profile. Existing
protected destination login behavior is retained. UI permissions remain UX only.

## Evidence and limits

Targeted production-chain/service25 tests passed. Full local Maven passed633
declarations (623 boot,10 data scope; one existing platform skip). Final frozen
frontend passed98 units,123 mocked browsers, lint/typecheck/build and generated
client reproduction. Earlier new-test regex, ambiguous status-locator and strict
initial mount-count failures are retained; the final assertions target actual
success text and exactly one additional captcha refresh per rejected write.

Authority46176 terminated0 with complete actual MySQL/Redis/Quartz/OSHI/ACL/API
verification. Actual registration proved original default/switch, captcha replay,
BCrypt/date, zero implicit grants, no-session response, login/logout, one winner
and seven409s for eight concurrent registrations, SQL fault/privacy/retry and
original audit. Actual live OpenAPI equals staged contract exactly:
51811E0BB00D0B30658965425019CA8FE7319C26146827C46F95A9B1665B8C8F.
All fixture users/configuration changes are owned by the disposable parent run;
exact original settings are restored and only owned accounts are deleted.

Exact implementation d4567f25edc5ec77c9fbdeea395479e129a6cb27 is accepted:
server37614190802 all three jobs and web37614190817 terminated SUCCESS.
Direct registration-cloud-server-accepted.log proves both59-browser profiles,
both full API suites and exact live OpenAPI; the web log proves98 units and123
mocked browsers. Local authority66393 also terminated0 with both59-browser
profiles and full API suites. Later request-diagnostic redaction and independent
password-display controls require their own acceptance and are not covered by
this implementation SHA.
