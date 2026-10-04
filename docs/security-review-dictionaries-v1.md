# Dictionary API security and compatibility review

The canonical `/api/v1/system/dictionaries` and `/dictionary-entries` contracts
provide concrete paging/detail, 201 creation, 204 mutation/deletion, filtered
XLSX export, type options, consumer values and Redis cache refresh. Compatibility
entities/mappers stay behind the facade; no AjaxResult/TableDataInfo, mapper
parameters, creator metadata or executable style content crosses consumer reads.
IDs stay exact decimal strings and OpenAPI generates the web transport contracts.

## Permission boundaries

Every management operation retains original `system:dict:list/query/add/edit/
remove/export` permissions. Cache refresh retains `remove`, as upstream does.
Consumer lookup and type options retain the original authenticated-user behavior;
they do not require management grants and are never anonymous. Lookup returns
only labels/values, tag style, plain CSS class names and default flags. Dictionary
resources retain original global permission scope, without introducing department
data scope. The ten data-scope parity cases are untouched.

Request bounds match database lengths, type-code syntax, status flags and sort
storage. Dates use typed ISO dates, inclusive original SQL filtering and ordered
ranges. Paging uses fixed SQL order; entries use sort then exact database ID.
Tag styles are concrete enum values and CSS attributes are plain class tokens,
never markup, URLs or executable CSS.

## Mutation and cache consistency

Canonical writes share the existing InnoDB root mutex. Type code uniqueness is
checked under the lock and V013 supplies an actual database unique index. Renaming
a type updates its data references in the same transaction. Child-bearing type
deletion is denied; every batch member is prevalidated before any deletion.
Entry movement validates the destination type and invalidates both cache keys.
Original duplicate entry values and multiple default flags remain permitted.
Type status does not suppress active consumer entries, preserving upstream.

Redis invalidation happens before the database transaction commits. A Redis
failure produces a 503 and rolls back the database write. Earlier successful
invalidations in a later failed batch are harmless cache misses. Canonical consumer
reads take the same mutex and fetch current committed database entries, then
populate the existing Redis namespace; they do not trust stale compatibility cache
values. Cache refresh clears that namespace and reloads every type's active
entries, including empty types. Redis refresh itself is not an atomic snapshot;
failure may leave some keys missing and can be retried.

Unmodified legacy writers/readers do not acquire the canonical mutex. They retain
their original transaction/cache limitations: a legacy reader can refill old cache
data during a canonical transaction. Canonical consumer reads still return current
database values and overwrite that stale key. This review does not claim an atomic
cross-store transaction or extend guarantees to unmodified compatibility code.

## Verification

`DictionaryControllerTest` uses production JWT/security configuration and real
service orchestration with mapper/cache mocks. It covers every operation permission,
authenticated-only consumers, exact large IDs, concrete projections, invalid
requests, duplicate races, rename/reference updates, clearing/movement, complete
batch prevalidation, original duplicate/default/status behavior, cache failures
and refresh ordering. `verify-dictionaries-integration.ps1` verifies actual MySQL
and Redis, filters/paging, Unicode, duplicates, rename/old-key invalidation, empty
type refresh, XLSX contents, real unique indexes and eight concurrent creates.
It denies only DEL/UNLINK on its disposable Redis instance to prove a 503 rolls
back both actual type and entry rename updates, then restores those commands.
Final test counts and CI evidence belong in the parity inventory. React dictionary
pages, preview, shared tags and their browser acceptance remain required.
