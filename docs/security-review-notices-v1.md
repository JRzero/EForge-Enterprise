# Notice API security and compatibility review

Eight canonical operations cover typed notice paging/detail, 201 creation,
204 update/atomic batch deletion, the newest-five feed, per-user read marking
and paginated reader lists. RuoYi persistence remains behind the facade; exact
string IDs and concrete response records are generated into the web client.

## Original permission and visibility boundaries

Listing and reader lists retain system:notice:list, writes retain add/edit/remove.
Detail, feed and read marking retain the original authenticated-user contract.
The original detail endpoint also exposes closed notices by known ID; the
canonical endpoint preserves that behavior rather than inventing a query grant
or department scope. Reader lists retain original identity, department, phone
and read-time fields behind list permission. Management and reader permissions
are never delegated to frontend controls.

Read marking derives userId from the validated session and accepts no actor
override. Duplicate marks remain idempotent under the upstream unique
(user_id,notice_id) index. Every submitted notice is checked before any batch
read/deletion. Canonical batches reject missing IDs and do not create orphan
read records. Closed-notice marking remains allowed, matching original known-ID
consumer behavior. The feed excludes closed notices, returns at most the five
newest active notices and counts unread entries only within those five, as the
original listTop controller does. Content and reader identities are absent from
feed summaries. Updating content does not reset existing read records.

## Transactions and rich text

Canonical writes, batch read marking and deletion share the existing InnoDB
root mutex and transaction. Deletion removes read records and notices together;
a later database failure must roll both operations back. Legacy writers retain
their existing transaction behavior and do not acquire that mutex. Canonical
reader DTOs use explicitly typed JDBC date mapping; compatibility map projection
does not define their timestamp representation.

Title validation retains upstream Xss and the 50-character limit. Type and
status have concrete original codes; remarks preserve the 255-character column
limit. Rich HTML content remains data and can be empty or cleared. This API
does not strip original editor formatting or impose an invented two-megabyte
HTML limit that would reject original base64 images. Create/update audit payloads
are suppressed, and request stringification redacts content.

Stored HTML is not a trusted DOM fragment. The forthcoming rich editor and
consumer display must retain original formatting/link/image/video capabilities
while preventing executable markup, dangerous URLs and unsafe embeds. Until
those components and their security/browser tests exist, this API checkpoint
does not establish rich-text frontend parity or safe HTML rendering. Upstream
MIT attribution, architectural baselines and all ten data-scope cases remain.

## Verification scope

NoticeControllerTest exercises production security filters and real service
orchestration with isolated mappers: every management grant, login-only consumers,
session-derived read ownership, projections/paging cleanup, rich content and
clearing, complete batch prevalidation, deletion ordering, exact reader IDs,
timestamps and malformed titles/types/queries. The disposable runtime script
checks actual MySQL feed limits/order/status, idempotence, compatibility feed,
readers, CRUD/clearing, batch guards and deletion rollback. Its owned database
trigger fails notice deletion after read-row deletion and must leave both
records present. Final results and CI belong in the parity inventory.
