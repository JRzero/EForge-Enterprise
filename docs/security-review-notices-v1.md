# Notice API security and compatibility review

Nine canonical operations cover typed notice paging/detail, 201 creation,
204 update/atomic batch deletion, the newest-five feed, per-user read marking
and paginated reader lists. RuoYi persistence remains behind the facade; exact
string IDs and concrete response records are generated into the web client.

The ninth operation is notice-local `POST /api/v1/system/notices/images`:
multipart field `file`, typed 201 `imageUrl` and Location, Cache-Control no-store.
It requires notice:add OR notice:edit on the server; ordinary consumers and
list-only readers cannot write files. This deliberately replaces the broadly
authenticated legacy common upload for this authoring surface, without changing
that compatibility endpoint or creating a new file-management framework.

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

Stored HTML is not a trusted DOM fragment. The notice-local DOMPurify boundary
now preserves the original text formats, list/indent classes, colors, typography,
links and images; it removes scripts, events, clobbering attributes, unsafe URLs
and layout/URL-bearing CSS. Inline SVG and SVG data URLs are forbidden; image
URLs may still reference server-normalized SVG uploads. Video frames have a fixed
sandbox without allow-same-origin, no srcdoc and no-referrer. SAFE_FOR_XML stays
enabled for raw-text/mutation-XSS defenses. Every editor import/paste/export and
consumer render must use this boundary. The editor and renderer now bind to
the notice management/top-feed surfaces; the page/image/read-state stage passes
local real-environment validation below. Upstream
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

Dependency review uses pinned DOMPurify 3.4.16 and Quill 2.0.3. Quill currently
has no published patched version for
[CVE-2025-15056](https://github.com/advisories/GHSA-v3m3-f69x-jf25), an HTML export
XSS issue: exports are untrusted and must be sanitized before storage/rendering.
The audit's suggested downgrade is not an upstream security fix. Browser tests
exercise hostile paste/export/rendering; the dependency advisory remains open.
Vitest is updated to compatible 4.1.11 to fix
[CVE-2026-84373](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), without advancing
either upstream architectural baseline. See the official
[Quill toolbar contract](https://quilljs.com/docs/modules/toolbar) and
[DOMPurify security model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model).

Quill's video format is locally overridden: editing frames are sanitized before
insertion and HTML export preserves the sandboxed iframe instead of converting
it into a text link. The browser test loads an actual same-host video fixture
whose script attempts to access the parent document; sandbox isolation blocks
that access in the editor and the consumer preview preserves the same policy.
The complete original toolbar, controlled refill, HTML paste, raster upload,
invalid upload, read-only behavior, cancellation and StrictMode cleanup are
covered in a dedicated browser harness. Uploads there are simulated; this is
not evidence for the forthcoming canonical image endpoint.

2026-10-05 local checkpoint: 229 backend tests (including 10 unchanged data-scope
cases), 53 frontend unit tests, 26 fixture browser tests and 24 live browser
tests passed, plus lint/typecheck/build, production security defaults, seeded
navigation contracts, exact live OpenAPI and reproducible generated client.
The complete owned MySQL/Redis script also passed notice transactional deletion
rollback, per-user reads, permissions, login/getInfo and Redis sessions, and all
previous module regressions. Logs: `rich-text-backend.log` and
`rich-text-runtime.log` under the ignored boot target directory. At that historical
rich-editor checkpoint the notice page/top feed were not wired yet.

## Canonical image boundary

The upload path accepts actual decoded JPG/PNG and securely parsed SVG below
the original strict 5 MB threshold. Rasters have a 4096-pixel per-side and
16-million-pixel total decode bound, then become fresh PNG files without original
metadata or trailing content. Original filenames never determine storage paths.
SVG parsing explicitly disables DOCTYPE, entities, XInclude and external DTD/
schema/stylesheet access. A SAX pass bounds 64 levels, 10,000 elements and 64
attributes per element before a DOM can be allocated. A fresh SVG namespace
document contains only allowed inert geometry, text, gradients, clipping/masks,
patterns and local references. Inline presentation styles and simple tag/class/id
stylesheet rules are compiled to validated presentation attributes; raw CSS and
class attributes are removed. Class/inline style values and each rule body are
bounded to 4096 characters, with at most 256 rules and 64 declarations per body.
Each style element is limited to 1 MiB; comment/block scanning advances linearly,
including malformed or unterminated text. Rule declarations and element classes
are parsed once. Advanced CSS selectors
and exact `!important` cascade semantics are outside this static-image policy.
Scripts/events, foreign namespaces, animation, stylesheet
instructions and external/file/data references are not copied. Internal cycles,
duplicate IDs and an expanded-reference budget above 10,000 are rejected.
These policies apply even when the public SVG URL is opened as a document.
They follow the explicit external-access controls in the
[JAXP security guide](https://docs.oracle.com/en/java/javase/13/security/java-api-xml-processing-jaxp-security-guide.html)
and SVG's separation of active document and secure image processing in the
[W3C processing model](https://www.w3.org/TR/SVG/conform.html).

UUID output files stay under the configured upload/notices namespace. Invalid
content produces a generic 400, storage errors a generic 503; no parser messages,
paths or file bytes appear in API problems or audit payloads. Successful images
remain publicly readable, matching the original common-upload image contract.
Cancellation or notice deletion does not garbage-collect committed images; the
original editor also leaves uploaded images, and a file lifecycle framework has
not been introduced. No MySQL schema, data scope or Redis authorization semantics
change for uploads. Image form permissions are UX; server author grants remain
authoritative.

## Page/image/read-state validation (2026-10-05)

The final stage passes 248 backend cases (16 image security/resource cases,
23 notice controller/authorization cases and all ten data-scope cases), 54 web
unit cases, 30 fixture browser cases and 27 live browser cases. Real uploads
cover PNG/JPG decoding and served static SVG gradients, including rendered pixel
assertions. An owned account with no roles proves management denial and isolated,
persistent per-user reads; authorized reader lists expose both account records.
The full disposable MySQL/Redis scripts reprove transaction rollback, prior module
behavior, session/captcha security and exact OpenAPI equality. Production defaults
and generated-client reproducibility pass. Logs are under the ignored boot target
as `notice-final-backend.log`, `notice-final-runtime.log` and
`notice-final-fixtures.log`. Final parity auditing remains separate; unrestricted
active SVG and arbitrary CSS are not claimed by the static-image security policy.
