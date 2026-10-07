# Explicit remembered login

The immutable original login.vue exposes a remember-password checkbox, stores
username/password before the explicit login attempt, restores them on later
visits, and removes them when unchecked. Its expiry is30 days. This stage
preserves those capabilities without copying its embedded RSA private key or
Vue implementation. No automatic login, extra grants, session TTL extension or
new backend endpoint is introduced.

An explicit opt-in stores both credentials encrypted together using a new
AES-GCM256 key and12-byte random IV. The browser's non-extractable CryptoKey,
ciphertext and expiry live in origin-scoped IndexedDB; expiry is authenticated
additional data. Passwords/username never enter cookies, sessionStorage or
localStorage. Only a non-secret opt-out flag is written synchronously to
localStorage. That flag prevents a reload from reviving credentials while
physical IndexedDB deletion is pending or unavailable. UI success is emitted
only after the deletion transaction commits; related actions are locked until
it ends. Unchecked explicit login also clears the prior record.

The [Web Crypto specification](https://www.w3.org/TR/webcrypto/) defines
structured-clone persistence of CryptoKey. Its
[extractable property](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable)
controls export/wrap; it is not a boundary against compromised same-origin
JavaScript, browser extensions or the browser owner. This feature intentionally
allows the opted-in browser origin to recover the credentials for user-triggered
login. It is not represented as hardware-backed storage or an XSS defense.

Records are validated, bounded to30 days, and rejected/cleared if malformed,
expired, authentication-tag-invalid or backed by an exportable/non-AES key.
Writes/clears are ordered within the current module. Late restoration cannot
overwrite fields the user has already edited; leaving during encryption cannot
issue the old form's login or update its error state. Browser/storage failures
use fixed messages. Ordinary login remains available without remembering;
an opted-in failed write cannot pretend the password was stored. Current form
passwords are masked and cleared after authentication rejection as before.

Six targeted actual-browser fixtures prove complete encrypted round-trip,
non-exportability, no plaintext in ordinary storage, no automatic authentication,
expiry/authenticated-metadata tampering, ordered save/clear, unavailable storage,
page departure, delayed restore and deletion-fault reload behavior. The first
real run exposed an immediate opt-out/reload race; its failed log is retained.
The final native-browser case passes actual login, logout, old JWT401, preserved
credentials without a session, a second explicit login, and physical opt-out.

Final frontend reproduction/lint/typecheck/build,98 units and130 mocked browsers
passed. Final real authority40388 terminated0 with the focused native case and full
API suite; precise source cloud acceptance is pending. Java source
is unchanged from the634-declaration local verification; no new Maven run is
claimed for this frontend-only stage. Live/committed OpenAPI remain unchanged.
Both60-browser cloud profiles are required for final acceptance. Dashboard,
remaining active audits and specifically unapproved task mutations remain
separate; form builder is deferred and the full goal is incomplete.
