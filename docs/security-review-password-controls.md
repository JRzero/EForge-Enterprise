# Independent password display and registration diagnostics

The immutable v3.9.2 personal-password reference has three independent
show-password controls; user creation also exposes its password. Login and the
reset-password prompt do not acquire an extra display control. Product code
consumes the pinned EForge Input through a local PasswordField wrapper.

Pointer activation preserves the input's focus and selection after the browser
changes its input type. The frame callback belongs to the current component and
is cancelled on replacement/unmount. Keyboard activation retains the native
button focus. Per-field state coexists with the existing all-fields checkbox,
whose accessible mixed state reflects partial display. Pending writes disable
all controls; successful personal-password updates clear values and mask all
fields. No password enters browser persistence in this stage.

Original validation remains intact: personal new passwords use6–20 characters,
user-created passwords use5–20, and the original forbidden-character check is
retained. The immutable frontend does not apply sys.account.chrtype to this
form. Its compatibility metadata must not be mistaken for a new mandatory
password policy. Confirmation never enters the canonical write payload.

RegistrationRequest now overrides record diagnostics with a fixed redacted
string, consistent with login/change-password DTOs. The targeted test failed
before this fix and passes after it; no actual user's credentials were used.
HTTP request/response contracts and the exact51811E0B… OpenAPI remain unchanged.

Full local Maven passed634 declarations (624 boot plus10 data-scope cases; one
existing platform skip). Frontend reproduction/lint/typecheck/build,98 units
and124 mocked browsers passed. The focused real authority40851 has passed all
seven personal-profile/user-management browsers and terminated0 with the full
API suite. Exact live OpenAPI matches the contract; precise cloud acceptance
is now accepted:49f1ec335bca42820469b7da6e24cd5047e77826 passed server37617297912 all three jobs and web37617297911. Direct logs prove both59 real-browser/fullAPI/OpenAPI profiles and124 mocks. Earlier cursor
failures and the isolated test-service startup failure are retained. The final
focus/selection assertion polls the next owned frame rather than assuming the
browser has completed input-type processing synchronously.

Registration implementation d4567f2 is separately exact-cloud accepted; its
evidence does not accept this later redaction/display source. Remembered login,
remaining shared audits and the specifically unapproved task runtime proposal
remain separate. Form builder is deferred, and the full project is incomplete.
