# User/session index implementation review

Status: implementation, local full regression and lifecycle review complete; precise CI pending. Not yet accepted as the completed H10/H13 goal.

## Runtime boundary

`SessionIndexService` maintains one `login_user_sessions:<exact decimal user id>` sorted set. Metadata revision/completeness and token members share the same Redis key. Current login key/JWT identities are unchanged. An index is only a candidate locator; current SQL authority, live token bytes/TTL and CAS still govern publication and every protected request.

Creation, TTL renewal and CAS use parameterized Lua. Dirty metadata is written before token mutation; complete metadata is restored last. Redis script errors are not assumed to roll back writes. Missing metadata triggers a complete fallback; revision mismatch prevents marking an obsolete scan complete. Reconstruction is limited to 4096 members; larger users retain complete fallback enumeration without truncation. Wrong Redis key type fails safely rather than treating corruption as empty; deleting the damaged internal index permits recovery.

Logout, forced logout and direct login-key clearing retain their original deletion behavior. Stale index references may remain until their expiry score; each candidate is checked against the live token, so these references cannot recreate a session. Global cache clearing removes the index too. Exact HTTP lifecycle coverage still needs final verification.

The commands target pinned standalone Redis 7.4 (including `PEXPIRETIME`, available from Redis 7). This multi-key script design does not claim Redis Cluster support. Metadata contains no cached permission decisions.

## Upgrade contract

Normal current-version configuration enables indexing. For any mixed-version rollout, set `EFORGE_SESSION_INDEX_ENABLED=false` on new nodes; this retains complete SCAN and original writes. Once every writer runs the indexed version, clear **only** the internal `login_user_sessions:*` namespace and enable indexing. Existing login tokens stay intact and first-use fallback discovers them. An old writer cannot participate in revision fencing; enabling indexing while old writers remain is unsupported. Do not clear business/session data as a migration shortcut.

## Targeted evidence

- `h10-index-wiring-target.log`: targeted reactor success, including 16 refresher and 6 authorization commit tests.
- `h10-index-boundaries-native.log`: 18 actual Redis tests, zero failures/errors/skips (12 index and 6 TokenService). Includes 4097-session complete fallback, concurrent creation/renewal versus repair, old sessions, expiry, index eviction/corruption, original bytes/TTL, CAS conflict, logout non-resurrection, compatibility mode and actual partial Lua write after denied `PEXPIRETIME`.
- `h10-index-command-faults-native.log`: final expanded suite, 22 actual Redis tests, zero failures/errors/skips. Real ACL failures cover `ZREMRANGEBYSCORE`, `ZADD`, `SET`, `PEXPIRETIME` and `PEXPIREAT`; assertions distinguish failures before token creation from partial writes and verify complete recovery in each case.
- `h10-index-rollout-native.log`: 23 actual Redis tests pass after adding the documented mixed-version transition. Original session bytes survive compatibility mode and internal-index clearing; first recovery discovers both original and compatibility-created tokens, and subsequent creation stays indexed without another scan.
- `h10-index-menu-native-final.log`: 52 actual Spring/MyBatis/MySQL/Redis menu mutation assertions pass. First run passed the permission/lock cases but failed fixture-empty cleanup because the new internal index remained. Cleanup now removes only the fixture user's index and retains the exact empty-database assertion; product permission checks were not weakened.
- `h10-index-full-verify.log`: full Maven reactor success for unchanged production source; the later expansion only added four parameterized ACL test cases, verified in the dedicated native suite above. Optional native tests are skipped without their Redis property during ordinary Maven and run explicitly with real Redis; they are not counted as ordinary Maven execution.
- `h10-index-refresh-fault-native.log`: 2365 actual MySQL/Redis assertions. Both compatibility and indexed modes verify initial GET failure and partial CAS SET/DEL failure, original JWT withdrawal, committed SQL, untouched bytes/TTL and recovery. Indexed mode's 100-total/3-affected warm refresh performs zero global scans, three session snapshot reads and three CAS calls. It still performs per-user index lookup; zero scans does not mean zero Redis operations.
- The same probe proves real InnoDB contenders can finish during indexed candidate lookup and snapshot reads, but must wait during authority publication. Snapshot/publication use the actual production service and Lua; test overrides only observe order, counts and barriers.

One sample measured 22.707ms for indexed 100/3; this is a diagnostic, not a production latency guarantee. Deterministic operation counts and security assertions establish the improvement.

The HTTP SCAN-fault fixture explicitly removes its own user's index before injecting the fault, ensuring warm indexing cannot bypass the intended fallback scenario. `h10-index-recovery-disabled.log` and `h10-index-recovery-enabled.log` both pass: committed revocation rejects both original JWTs; regrant restores canonical/compatibility access; real SQL unavailability fails safely; precise SQL-free logout deletes only its own session; account disable, renewal and diagnostics retain their contracts.

Both full profiles (`h10-index-disabled-runtime.log`, `h10-index-enabled-runtime.log`, sequential session39124 exit0) passed all 68 real browser cases each and complete API checks, including online sessions, force logout, namespace/global cache clearing and immediate JWT invalidation. Both live OpenAPI documents deep-equal the checked-in contract (byte formatting differs); default/enabled safe diagnostic checks cover 37/40 actual failure records. Focused recovery session87300 also exited0. Safety defaults and modified PowerShell syntax pass. Exact CI remains pending. No frontend production source changed; final accepted c76c1cb frontend tree remains identical.

## Review conclusion

The complete fallback is retained for legacy, missing or oversized indexes; no truncated result is labelled complete. Stable indexed lookup excludes unrelated values, while publication and protected-request authority remain SQL-backed. Creation/renewal/CAS participate in the revision protocol; direct deletion may leave bounded-lived references but cannot extend or recreate the token. The supported writer audit found creation/renewal/CAS in TokenService; online/cache compatibility routes delete existing keys, which the live lifecycle suites cover. Mixed-version writers require the documented compatibility mode and explicit internal-index rebuild. No Redis Cluster or transparent old-writer detection claim is made. This is a local review conclusion, not a substitute for pending exact cloud execution.
