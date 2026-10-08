# Session concurrency hardening

## Problem and scope

The imported token middleware used the same unconditional Redis `SET` for both
new-session creation and renewal. A request that had already read a `LoginUser`
could recreate its key after logout, or overwrite a later permission withdrawal
with its earlier object. Profile and bootstrap persistence shared that writer.
The first canonical role refresher used `SET XX`, which prevented that refresher
from inserting a missing key but did not protect against stale content writers.

This change closes those persistence races across the session writers. It does
not claim to cancel an application request that was already authenticated before
revocation. Such a request cannot recreate or restore the revoked session for
subsequent requests.

## Persistence rules

1. `createToken` alone creates a fresh random session identifier, using Redis
   `SET NX` with a positive expiry. Signing completes before persistence.
2. Authentication reads the serialized value and Redis `PTTL` in one operation.
   The remaining TTL determines the request's `expireTime`; the creation-time
   `loginTime` stays unchanged. Online-session DTOs expose that original login
   time and do not expose a stale cached expiry.
3. `verifyToken` and the compatibility `refreshToken` only extend an existing
   Redis TTL. The atomic operation never writes the request's JSON, roles or
   permissions, and cannot create a deleted/expired key. The threshold is checked
   against the current Redis TTL to avoid repeated renewal by concurrent requests.
4. `setLoginUser` delegates to `updateLoginUser`, which compares the exact bytes
   originally read from Redis. A Lua operation replaces the content only while
   those bytes still match, and preserves the TTL observed at the moment of the
   write. It does not reset TTL from an earlier client observation.
5. A rejected profile/bootstrap write is discarded. An authoritative role refresh
   rereads the current session and recomputes database account state, active roles,
   data scope and permissions before retrying. Three failed attempts revoke that
   session rather than leave withdrawn authority usable. If an identified
   affected session encounters an authority-read/update exception, revocation is
   attempted before propagating that error; a failed revocation is retained as a
   suppressed cause. An unavailable Redis service still limits that guarantee.
6. The shared `refreshAfterCommit` callback snapshots affected user IDs and
   publishes nothing on rollback. The refresher keeps the existing root-row lock
   and separate `REQUIRES_NEW` transaction for committed canonical state.

There is no Redis JSON parsing in the compare-and-set script. The configured
FastJson2 serializer uses representations such as typed sets and long values;
comparing original bytes avoids reinterpreting them or losing numeric precision.
All operations touch one key, and the cache value/key format stays compatible
with sessions created before this change. Existing expiring sessions acquire
request-local comparison metadata when next read; no migration is required.

The comparison bytes are private, transient request metadata on `LoginUser`.
Both Jackson and FastJson explicitly ignore the field, its accessors are not
JavaBean getters/setters, and callers receive defensive copies. They are not
stored in Redis or exposed as HTTP/OpenAPI properties.

## Compatibility writers

Legacy `/getInfo` now uses conditional content persistence when permissions
change. Canonical and legacy profile/bootstrap writers continue using the public
`setLoginUser` method, inheriting the same compare-and-set protection.

Controllers use the committed `RoleSessionRefresher` for role/user mutations.
The subsequent [menu/import review](security-review-role-menus-import-v3.md)
adds both HTTP import entrances: they collect successfully committed existing
user IDs and invoke one authoritative refresh after all rows are processed.
Later row failures do not suppress those updates; publication failure is
reported without claiming that committed SQL was rolled back.
The old `refreshPermissionByRoleId` method remains callable for source
compatibility, but conservatively revokes matching sessions. It no longer derives
new authority from an old cached role list. Applications requiring seamless
permission propagation should call the authoritative committed refresher.

MySQL and Redis remain separate resources: a Redis outage after a committed SQL
mutation can still delay propagation and return an error. This change does not
claim distributed atomicity or change the data-scope algorithm. The existing
DataScopeAspect parity cases remain required.

## Regression evidence

`TokenServiceSessionTest` uses the production FastJson2 serializer and a small
Redis operation double to exercise controlled interleavings: all stale writers
after revocation, stale profile/bootstrap/renewal after permission withdrawal,
profile-first compare-and-set contention, repeated updates from a successful
snapshot, preservation of TTL/login time, TTL-derived expiry, and hidden metadata.

`RoleSessionRefresherTest` covers fresh authority and scope, logout during refresh,
profile conflict followed by a new session/database read, bounded contention and
authority-read failures with revocation, disabled/expired/unrelated sessions, immutable after-commit affected
IDs, and no publication on rollback.

`TokenServiceRedisIntegrationTest` runs the actual production serializer,
TokenService, RedisTemplate and atomic scripts against a real Redis instance
when `eforge.test.redis.port` is provided. CI's runtime integration job provides
that Redis service.

Local validation on 2026-10-08 completed `mvn verify` with the real Redis fixture
enabled: 739 tests, zero failures or errors, and one platform-specific Windows
junction test skipped on Linux. This includes all 6 real Redis cases, 7 token
snapshot cases, 13 committed refresher cases and 10 data-scope parity cases.
The first five Redis cases were also run against the unchanged review baseline
`1e5c86a`: four failed there and all five passed after the fix. A sixth case
directly verifies that a missing key is a normal cache miss for authorization
refresh, including the actual Lettuce multi-result representation.

These local checks do not substitute for CI's MySQL schema/login/API and browser
runtime fixtures. Their results belong to the pull request checks for this change.
