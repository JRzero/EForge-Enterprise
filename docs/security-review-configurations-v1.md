# Configuration API security and compatibility review

The eight canonical `/api/v1/system/configurations` operations expose typed
paging/detail, 201 creation with Location, 204 mutations/cache refresh, filtered
XLSX export and authenticated key lookup. IDs remain exact decimal strings;
OpenAPI generates the frontend types and functions. RuoYi entities, mapper
filters and spreadsheet metadata remain behind the compatibility boundary.

## Permission and original behavior

Management preserves `system:config:list/query/add/edit/remove/export`; cache
refresh requires remove. Key lookup preserves the original login-only consumer
contract. A user without configuration management grants can read a known key,
but cannot list, inspect, mutate, export or refresh administrative resources.
Configuration values therefore remain readable application settings, as upstream;
this contract does not provide a secret store. Creation/update audit annotations
omit request/response payloads, and request stringification redacts values.

Unknown lookup keys return the original empty string. Query parameters preserve
Unicode and slash-containing keys without path decoding ambiguities. Required
name/key/value and database length limits are validated. Inclusive date ranges
retain the original mapper semantics. Builtin configurations cannot be deleted;
all batch members are validated before deletion. Builtin flags remain editable,
including Y to N, matching the original editor and backend deletion policy.
The ten department data-scope parity tests remain unchanged.

## Transaction and cache boundary

Canonical mutations hold the existing InnoDB root mutex through transaction
commit. V015 adds an actual unique key on config_key, preserving database
collation semantics. Cache invalidation clears the entire configuration namespace
before repopulating the written key, removing stale aliases after a rename.
A Redis failure returns 503 CONFIGURATION_CACHE_UNAVAILABLE and rolls back
database writes. Successful earlier invalidations become harmless cache misses.
Cache refresh can partially repopulate Redis before failure and is retryable;
this is not an atomic transaction across MySQL and Redis.

ConfigurationValueReader holds the same mutex, reads current database values
and populates the existing Redis namespace. SysConfigServiceImpl delegates its
policy reads to this separate bean. TransactionTemplate also covers internal
self-invocation paths such as captcha policy lookup. Stale legacy cache entries
cannot override committed configuration values. This adds a database read and
root lock to each policy lookup; no cache-hit performance guarantee is claimed.
Redis remains necessary for sessions and reader cache population.

Legacy writers retain their existing transaction/cache behavior and do not take
the canonical mutex. Guarantees for atomic mutations apply to canonical writers;
consumer reads obtain committed database state rather than trusting aliases.
Upstream MIT attribution and pinned baselines remain intact.

## Evidence and remaining acceptance

ConfigurationControllerTest covers all seven management permission boundaries,
authenticated-only lookup, exact large IDs, concrete projections, request
validation, duplicate races, builtin editability/deletion guards, full batch
prevalidation, export filtering, Redis rollback and refresh ordering.
ConfigurationValueReaderTest checks database/cache/commit ordering, unknown-key
behavior, stale-cache avoidance and cache-failure rollback.

The disposable integration script exercises actual MySQL/Redis CRUD, Unicode,
dates, paging, rename and compatibility lookup, XLSX contents, cache refresh and
eight competing creates. Additional assertions cover a direct unique-index
violation, stale Redis values, missing batch members and DEL/UNLINK denial with
actual MySQL rollback. The auth verifier checks ordinary-user lookup versus all
management denials and enables captcha through a canonical configuration update.
Transport tests cover false filters, encoded Unicode keys, exact IDs, binary
exports, cancellation and session retention/expiration on 503/401.

This document describes the API/client boundary. Final runtime and CI evidence
belong in the parity inventory. The React configuration page, seeded route and
its complete browser acceptance are required before module parity. The page and
V016 route now have a local checkpoint: 24 fixture and 24 live browser tests,
including builtin guards, exact IDs, applied filters, retained drafts/cache
retry, Unicode persistence, XLSX, pagination and batch deletion. Page CI and
the final acceptance audit remain tracked in the parity inventory.
