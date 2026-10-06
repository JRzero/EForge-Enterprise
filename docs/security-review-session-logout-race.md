# Session logout revocation race review

Exact Boolean correction3266157 server37539853310 verify job112529905906 failed
at generated-browser logout with AbortError. Web37539853411 and the other two
server jobs passed, but the overall server run failed. Direct
generator-boolean-dictionary-verify-job.log proves a product abort, not an
infrastructure cancellation; that source is not cloud accepted.

createSessionRuntime shared its current operation AbortController with logout.
Concurrent authenticated401 calls forget(), which aborts the current operation;
a newer login also aborts it. Thus local state transitions could interrupt a
server revocation request. Two controlled fetch/abort tests fail before the fix
(2red/8green, session-logout-race-before.log) and all10 session cases pass after it.
Frontend91 units, generated client reproduction, lint/typecheck and build pass.

Logout still starts a new generation and cancels superseded bootstrap operations,
but its captured-token revocation uses the existing bounded API transport without
the shared state-transition signal. The transport's15-second timeout remains.
Completion clears local state only if its generation is still current; old-token
401 callbacks cannot invalidate a newer token. Tests cover concurrent401, newer
login preservation, exact old Authorization, original503 retention and cleanup.

A real browser test gates only the response after the actual server /logout has
returned200. It then triggers the real notice-feed401 that clears local auth.
Before the fix48631 observes net::ERR_ABORTED at the logout request after these
actual server/browser transitions. The final default profile52071 passes all3
login tests including this race: releasing the response completes normally and the
old token's real bootstrap remains401. The enabled profile and complete APIs are
now terminal PASS as well: observer52071 ended0. No token is put in a URL or printed.

Both final generated host profiles52071 pass; earlier separate framework86621
profiles passed47 browsers and complete APIs each. The final live suite now has48
tests; its new exact cloud acceptance is pending. Combined47513 failed an installed
menu/framework seed fixture and is not accepted as a complete run.58536 was
invalidated by frontend source editing while Vite was live and is not accepted.
No verifier was weakened. The complete active goal remains unfinished.