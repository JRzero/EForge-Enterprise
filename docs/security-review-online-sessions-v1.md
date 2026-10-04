# Canonical online-session boundary

GET `/api/v1/monitor/online-sessions` retains `monitor:online:list`; DELETE
`/{id}` retains the separate `monitor:online:forceLogout` grant. Production
security filters and server permissions are authoritative. These are original
global monitor capabilities, without user/department data-scope filtering.
Compatibility endpoints and session/token authentication behavior are unchanged.

The response projects only the opaque session UUID, username, department, IP,
location, browser, operating system and cached login time. It never returns a
bearer JWT, password hash, full cached LoginUser or its grants. Username and IP
filters preserve upstream exact, case-sensitive matching, including combined
filters. Empty filters mean all authorized visible sessions. Bounded server
paging follows deterministic descending cached time/UUID ordering; cached login
time retains TokenService's existing refresh semantics. Redis remains the source
of truth, and records that expire between key enumeration and read are skipped.
Partial cache values and mismatches between key identity and token are skipped.

Revocation validates a UUID and deletes only `login_tokens:<id>`; it cannot select
a password-lock key or arbitrary Redis namespace. Missing keys are idempotent
204, as with the original force logout. A selected bearer JWT fails its next
authenticated request after the cache key is removed. Other sessions for the
same user and the caller remain valid. Self-revocation remains allowed by the
original force-logout grant. This does not alter handling of requests already
authenticated before revocation or introduce distributed revocation machinery.

Enumeration and deletion Redis faults return generic 503
ONLINE_SESSIONS_UNAVAILABLE, without connection details or false success.
The implementation retains the existing RedisCache enumeration facility; it
does not add a new store, session index or infrastructure dependency. Operation
auditing retains the original FORCE event and excludes response payload capture.

Fourteen targeted tests cover production filters/grants, safe projection,
expiration/partial/mismatched keys, exact filters, stable ordering/paging,
invalid queries/UUIDs, key isolation/idempotency and cache faults. The owned
MySQL/Redis harness creates three actual sessions, checks projection/paging and
exact filters, denies both grants to a no-role account, injects KEYS and
DEL/UNLINK ACL failures, then proves immediate target JWT invalidation and
survival of its other sessions and caller. The parity inventory records final
regression/client/CI results separately. API preparation does not establish
completion of the online-session React page.
