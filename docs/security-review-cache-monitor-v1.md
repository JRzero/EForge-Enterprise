# Canonical cache diagnostics and clearing boundary

The seven canonical operations under `/api/v1/monitor/cache` retain the original
`monitor:cache:list` grant for both reads and clearing. This remains a privileged
global maintenance capability: it can inspect cached values and remove individual
keys, every key in one of the seven original namespaces, or every key in the
selected Redis database, including the caller's and other users' login sessions.
No department restriction or invented removal grant changes original semantics.
Production authentication and backend method authorization remain authoritative.

Statistics project only the original displayed Redis fields and command counts,
excluding unrelated internal INFO properties. Counts and byte values use exact
decimal strings. Names preserve the original seven identities/order. Keys use
literal namespace prefixes and natural sorting; value lookup uses encoded query
parameters to retain Unicode, slashes and ampersands. A key must belong to its
selected supported namespace. Full clearing also includes unrelated keys, as the
original operation does. Names/key DTOs are bounded and validated.

The value reader fetches raw Redis string bytes rather than restoring arbitrary
cached Java objects or casting session/dictionary values to String. The existing
FastJson writer emits Long/Set notation, so plain data parsing with the pinned
FastJson 2 dependency normalizes that notation before rendering JSON through
Jackson. It supplies neither SupportAutoType nor an AutoType filter; the upstream
[AutoType documentation](https://github.com/alibaba/fastjson2/blob/main/docs/autotype_en.md)
explains the default disabled behavior. An application-class constructor probe
also verifies that metadata cannot construct classes in the actual dependency.
Login-session JSON recursively excludes password/accessToken/refreshToken/
credentials fields and malformed session data fails closed with generic 503.
Non-session plaintext remains readable. No cache bytes or TTL are changed by reads.
Opaque session UUIDs and privileged metadata retain their maintenance behavior.

Single-key clearing is idempotent. Namespace/all clearing enumerates the same
snapshot as upstream and sends one Redis multi-key delete, retaining the original
race semantics for keys created after enumeration. A failed enumeration never
deletes; Redis access faults return generic CACHE_UNAVAILABLE without private
values, keys or exception text. Missing/expired values have canonical 404
CACHE_KEY_NOT_FOUND. No distributed transaction, index or infrastructure is added.

Twelve targeted tests verify every original grant/anonymous rejection, namespaces,
all statistic fields, exact counters, key encoding/projection, cached Long/Set
normalization, credential redaction, no class construction, malformed-session
failure, missing/idempotent keys, namespace/all multi-key deletion and generic
faults. The owned Redis runtime verifies actual compatibility info, special keys,
exact values, session metadata, INFO/KEYS/DEL ACL failures and all clearing scopes,
including real single-session/namespace/global invalidation and preserved other
data. Final client/regression/CI evidence is recorded in the parity inventory.
The statistics and cache-management React pages remain required; a prepared API
does not establish completed frontend parity.
