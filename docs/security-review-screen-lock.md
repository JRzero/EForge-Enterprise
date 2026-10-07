# Screen-lock workflow security review

Original functional reference is lock.vue, store/modules/lock.js, Navbar.vue and
POST /unlockscreen at fixed RuoYi frontend0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0.
Original MIT attribution remains in the repository; the native React workflow is
new implementation consuming the pinned EForge dependency.

Canonical authenticated POST /api/v1/auth/unlock-screen accepts only a write-only,
redacted password DTO. Current principal ID selects the current SQL account hash;
request userId/username cannot select another actor. No-role accounts can unlock
their own screen. Empty/oversize input stops before SQL. Wrong password is safe403
so it cannot masquerade as authentication expiry. Disabled/deleted/missing current
accounts produce401. SQL/encoder faults produce fixed503 without driver or
password data; successful verification returns empty204/no-store/no new cookie.
No account update, grant, new session, explicit token refresh or retry-lock policy
is introduced. Original JWT filter/session policy continues unchanged.

Screen locking retains the original UI privacy purpose. It does not revoke the
session or block otherwise-authorized API calls and cannot defend against
same-origin script access. It is distinct from Redis login password retry locking.
The tab marker stores only actor ID/username/validated relative return address;
no password, JWT or cached grants are stored in that marker. Different actors
cannot inherit an unlock. Signed-out state removes the marker. Unavailable storage
still keeps the current in-memory view locked; reload persistence is unavailable
when the browser prohibits storage.

Static /lock is an authentication workflow handled by Application, not a database
component string or navigation GROUP route. Address changes while the actor marker
is present still show only the lock view. Direct /lock persists a default return
address. React Activity hides and deactivates the workspace while retaining draft
state; full reload naturally cannot preserve unsaved in-memory drafts. Clock,
80-dot canvas, resize/visibility/reduced-motion listeners, frames and shake timeout
have owned cleanup. Text and avatar use existing safe native components.

Verification success is followed by fresh bootstrap before marker removal and
return navigation. Refresh failures keep the view locked and clear the password.
Captured actor/operation checks prevent refreshed replacement-account acceptance.
Password failure clears/refocuses the input; Enter, loading guard and logout retain
original interaction. Logout removes the lock only after successful revocation;
401 transitions to signed out. No specifically rejected Quartz runtime scheme is
part of this implementation.

Final main Maven648 declarations (638 boot, one existing skip,10 scope) pass;
original sandbox self-attach blockage is retained separately and was superseded
by the authorized complete verifier. Generated client is reproducible from the
actual endpoint. Main frontend98 units and137 mocked browsers passed before the
scoped contrast correction; all final frozen gates after that correction pass and are tracked
in screen-lock-visual-final-*.log. A real390px screenshot caught unreadable heading,
label and button colors; scoped native CSS corrects them without a dependency or
baseline change. Five focused mocked cases pass; the native screen-lock case and
complete real API authority34823 terminated0, including the dedicated actual SQL
script, no-role verification, original compatibility, changed password, fault
privacy/recovery, unchanged row and logout invalidation. Live and committed schema
SHA256 is CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C.
Final contrast source passes98 units/137 mocked browsers/reproduction/lint/type/build. Exact cloud and both62 real-browser profiles are still pending. Full project is
not complete; independent XLSX identity audit and denied task runtime scheme
are not accepted by this phase.
