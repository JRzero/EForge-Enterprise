# Session publication lock boundary

Status: implementation and full local regression complete; precise CI pending. This is the lock-duration part of H10, not acceptance of the pending user/session index.

## Invariants and implementation

- SQL remains authoritative on every protected request. Session existence/TTL remains Redis-backed. No cross-request permission cache or new authentication mechanism is added.
- Finish SCAN before publishing. Read at most 32 candidate session snapshots outside the refresher's publication transaction. Missing, expired and unrelated sessions do not open that transaction.
- Acquire the existing shared IAM root lock in a new transaction for each nonempty bounded batch. Read current SQL authority and keep the lock through each Redis CAS or revocation. Another cooperating IAM mutation cannot commit between that SQL read and publication.
- A CAS conflict is reread outside the completed transaction and recomputed inside a new locked transaction. After three attempts, revoke the contended session. Never recreate expired/logged-out tokens or extend TTL.
- SQL/Redis failures preserve fail-closed request authorization and original failure propagation. A partially published batch is not reported as successful. The root-missing error now occurs after session location but before any authority read/publication; an empty/unrelated batch requires no root lock.
- Batches may observe different committed SQL versions; each publication uses its own locked current version. The previous implementation also did not provide an atomic multi-session Redis update. Request-time SQL authorization is unchanged.

This removes enumeration and session reads from locks acquired by the refresher. It does not release locks owned by an external caller's transaction. CAS/revocation Redis I/O intentionally remains under the root lock; moving publication outside it without a stronger ordering protocol would permit stale authority writes. At most 32 decoded session snapshots are retained per batch; SCAN still stores the complete key collection. User/session indexing is still needed to avoid reading unrelated sessions.

## Evidence and design correction

`h10-lock-target-red-retry.log`: 14 tests, one intended ordering failure against the original runtime. The earlier sandbox run stalled in Mockito/ByteBuddy attachment and was terminated after verifying its exact child processes; it is not a product failure result.

The initial per-session transaction implementation passed 15 targeted tests and 1187 actual MySQL/Redis assertions (`h10-lock-target-green.log`, `h10-lock-native.log`). Its 100-related-session sample took 1034.645ms, so it was replaced before acceptance with bounded batches to avoid the transaction overhead.

`h10-lock-batch-native-final.log`: 1187 assertions pass. Actual independent InnoDB contenders finish during enumeration and snapshot reads, but `performance_schema.data_lock_waits` observes blocking during CAS publication. Both initial-read and partial-CAS real ACL failures preserve committed SQL withdrawal, original-JWT 403 responses, exact untouched session bytes/TTL, original failures and recovery. The first batch probe failed an obsolete read-order assertion: batch pre-reading now reads C before A/B publication. The final assertion requires all three pre-reads, only A/B write attempts, only A success, and C's exact untouched bytes; no safety assertion was removed.

Final batch sample: 100 related sessions 279.257ms, 100 sessions/3 related 118.794ms. Enumeration/snapshot root contenders 1.123/0.995ms, publication contender 33.970ms including diagnostic coordination. Single-run timings are diagnostic, not proof of a production latency improvement. Deterministic guarantees are the observed lock placement, bounded publication batch, unchanged permission/TTL/error semantics and CAS retry order. Complete Maven, HTTP/browser profiles and precise CI remain required.

Full reactor evidence: h10-lock-full-verify.log/session38900 exited 0, including 16 RoleSessionRefresher tests and all 10 DataScopeAspectParityTest cases. Final bounded-batch native probe session91725 exited 0. Sequential session6859 exited 0. Default and enabled profiles each passed 68 real browser cases and full API/MySQL/Redis/Quartz/OSHI/ACL/diagnostics verification; both exported OpenAPI documents deep-equal the checked-in contract. Evidence: h10-lock-disabled-runtime.log and h10-lock-enabled-runtime.log. Test ports 13326/16326/18086 are separate from other projects; no unrelated services were stopped. Both owned applications completed and were cleaned up. Precise cloud acceptance remains pending; the separate user/session index is not implemented.
