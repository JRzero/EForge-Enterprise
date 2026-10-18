# H10 user/session index: implementation boundary

Status: implementation and targeted native verification in progress, full regression/CI pending. The publication-lock slice is accepted at `894aaa6`; do not count this document as H10 completion. Actual indexed lifecycle and recovery evidence is recorded in `security-review-session-index.md`.

## Required end state

After a verified index has been built, refreshing three affected sessions among 100 total sessions must read only those three session values and must not enumerate the global login namespace. First-use recovery must remain complete for existing sessions. Missing, expired, corrupt or partially written index state cannot be interpreted as a complete empty user.

The current login keys and JWT identities must remain compatible. Redis remains a session existence store; protected-request authority continues to come from current SQL. No SQL permission cache, new middleware, or new authorization flow is introduced.

## Proposed storage and lifecycle

- One internal sorted-set key per user, outside `login_tokens:`. Token members and metadata members use disjoint prefixes. Token scores represent actual Redis expiration, not a client clock estimate.
- Keep completeness and a unique mutation revision inside that same key, so eviction/deletion cannot leave an independent completeness marker alive. Missing or invalid metadata means incomplete.
- Session creation/TTL extension and index maintenance execute through parameterized Lua. Mark incomplete before fallible writes; restore prior completeness only after all required writes succeed. A script error must leave conservative recovery state rather than assuming script errors roll back earlier writes.
- Revision changes on every successful creation/extension and on any partial attempt, so a scan-based rebuild cannot publish a stale complete index after concurrent writes. Complete rebuilding requires comparing the captured revision at publication. If contention prevents completion, use the fully collected fallback candidates without claiming the index is complete.
- Expired members are pruned by score. Logout/forced logout/direct namespace clearing may leave only stale index references; actual token existence is always checked before authority publication, so references cannot recreate a session. Index lifetime must cover every member's actual expiration. Global cache clearing removes both stores.
- Rebuild scripts must have a bounded input size. Oversized recovery remains correct through complete SCAN fallback rather than silently truncating users. Avoid introducing an unbounded server-blocking reconstruction script.

## Upgrade contract to resolve before implementation

A verified index cannot discover an old application instance creating unindexed sessions without a scan. Do not pretend a revision fence solves writers that never participate in it. Provide an explicit compatibility mode for mixed-version rollout that continues complete scanning; enable indexed-only reads only after all session writers run the indexed lifecycle. Existing pre-upgrade sessions are discovered by first-use complete recovery. Deployment documentation and tests must state this limitation; do not silently enable an unsafe mixed-version assumption.

Need to settle the exact default/configuration and migration validation before claiming delivery. The normal current-version mode must demonstrate the indexed operation budget, while compatibility mode retains all original behavior. Production session creation/renewal writers and compatibility deletion paths have been located in TokenService, SysUserOnlineController and cache controllers; audit the full write set before integration.

## Mandatory tests

Real Redis tests: atomic lifecycle/TTL/non-resurrection; missing and corrupt index; ACL failures at each fallible command with recovery; old sessions; concurrent create/renew/rebuild; logout/force logout/per-key/per-namespace/global clearing; expiration and index eviction; 100 total/3 affected steady-state versus first-recovery operation counts. Keep actual root-lock placement, CAS conflicts/fresh SQL, protected-request original JWT withdrawal, full two-profile HTTP/browser suites and precise OpenAPI/CI gates.

Sources: [Redis Lua execution and key arguments](https://redis.io/docs/latest/develop/programmability/eval-intro/), [ZADD](https://redis.io/docs/latest/commands/zadd/), [SCAN coverage and concurrency semantics](https://redis.io/docs/latest/commands/scan/). These define primitive behavior, not proof that this proposed lifecycle is correct. Validate the final command set against the repository's pinned Redis runtime and real ACL/error probes.
