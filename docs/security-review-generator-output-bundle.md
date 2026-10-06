# Generator immutable output and original download integration

Scope: original preview plus single/batch download use an actual complete,
immutable bundle rendered from consistent detached metadata. Canonical endpoints,
custom filesystem writes and full output-language/React/UI acceptance are pending.

## Data and permission boundary

The loader's new loadByNames has original tool:gen:code permission, not the
preview/code union used by ID previews. A short read-only REQUIRES_NEW transaction
at actual MySQL REPEATABLE_READ reads the entire selected batch including child
metadata/fields. Distinct valid names and resolved identities are required; IDs
stay exact. SQL-bound names can contain legitimate quoted Unicode data. Missing,
empty-field/child and unavailable SQL failures remain fixed safe errors. No
mutation guard/global task lock, DDL or metadata/business writes are introduced.

Rendering runs after that loader transaction returns; a caller's outer transaction
may have been restored. No mapper is available to the pure renderer. Each template
gets a fresh original DTO graph from the immutable snapshot and its captured date.
The complete file records contain immutable Strings and are exposed via an
unmodifiable list. Legacy preview maps retain original template resource keys.

## Archive boundary

Validate every final relative path before rendering any template. Preserve
association checks before child-dependent filenames. Reject empty/dot/parent
segments, absolute/backslash/drive/ADS forms, Windows reserved device stems,
trailing dots/spaces, forbidden/control characters, malformed surrogate pairs and
excessive path segments/total path length. Preserve valid Unicode file names.
Portable case-insensitive path collisions are rejected. This is not a claim about
all filesystem normalization or symlinks; custom filesystem output is unchanged.

The original shared vm/ts/index.ts.vm output keeps its first full index and appends
subsequent export lines. Other conflicts fail409. Immutable bundle render limits
individual template renders to4 Mi UTF-16 chars and complete UTF-8 output to32 MiB (including the merged index); batch render
is consumed lazily so all100 table outputs are not accumulated before this check.
These are output limits, not a universal metadata/template CPU/memory guarantee.
ZIP is UTF-8 and completed in memory before any response bytes/attachment headers;
repeat calls produce independently owned byte arrays. The original filename and
media type stay compatible. Original controller translates fixed ApiFailure into
ServiceException with its original status code, yielding safe legacy JSON and
failed operation audit without exposing SQL details or partially returning ZIP.

## Evidence

- Full Maven565 (555 boot +10 scope) pass, generator-bundle-final-verify.log.
- Nine actual original template combinations (CRUD/tree/sub and three upstream
  frontend styles), file names/content retained exactly in decoded ZIPs; source
  mutation after capture and mutation of a returned byte array do not change
  subsequent output. Actual original single/batch service download is executed.
- Shared TypeScript index merge, case-conflicting paths,10 dangerous filename
  scenarios, valid Unicode names and immutable list/map assertions pass.
- Actual original HTTP MVC download before controller adaptation:19 cases,3
  failures (missing404, unavailable SQL503, duplicate400 returned generic500).
  After adapter all19 green, including preview-only denial before SQL and actual
  decoded ZIP from loader/service/renderer. Logs generator-bundle-http-before.log
  and final full verify. No mapper writes in these cases.
- Modes0/1 each64 actual Spring/MyBatis/JDBC checks:
  generator-bundle-native-0/1.log. Real named batch sees a consistent old root,
  associated child and independently selected child while a concurrent transaction
  commits both table/field versions without a reader lock. Next read sees the new
  batch. Actual isolation/read-only state checked at each mapper select. Caller
  transaction suspension and rollback, no-role/preview-only refusal before SQL,
  invalid/duplicate name/identity checks, injection-as-data, real missing-field
  SQL503/recovery, pure renderer's zero further reads and original service ZIP/
  preview exact content checked. These owned containers are cleaned individually.
- Final two full real API/43-browser profiles completed sequentially under44960.
  New runtime script checks actual binary original single/batch ZIPs, shared TS
  index, saved FK assignment text, safe missing/duplicate/path/real SQL failures,
  retry, no-role, honest success/failure operation audit and exact full metadata
  rows/business rows. Both profiles ended successfully; their live OpenAPI snapshots match the contract.
- Current bundle source not committed/cloud accepted yet. Earlier660fb4b cloud
  accepts only its FK implementation. Live app uses the final built bundle jar;
  do not package over it or parallelize same integration ports.

## Remaining required scope

This does not certify all generated text as safe code: general Java/type/class/
field/OGNL semantics, tree Java aliases/PK acronym accessors, remaining frontend
contexts and malformed text still need complete validation. eforge-react remains
an old Vue fallback; it is not accepted React output. Canonical typed output and
client, custom output root/path/symlink/overwrite/partial-file boundary, complete
React/EForge templates/UI and generated CRUD/tree/sub business HTTP/browser
validation remain. Form builder is explicitly deferred, never marked complete.
Earlier runtime checkpoint (before final acceptance below): default configuration completed its43-browser/full API
profile, including the actual output HTTP checks above and exact live OpenAPI.
Enabled-console profile is still live under44960. Frontend check:generated/lint/
typecheck/73 unit tests/build all pass (generator-bundle-frontend.log); no frontend
source/client contract changed. Do not treat the first profile as both accepted.
Additional actual Velocity output-limit test:44 snapshot/bundle cases pass under12814 (generator-bundle-limit-target.log), including fixed413 without large private author text. This is test-only after the565 full build; production jar/source did not change during44960.

Final local runtime acceptance (2026-10-06):44960 ended0. Default and enabled
profiles each43 real browsers and complete real API regression pass, including
actual single/batch binary output/preview agreement, saved FK field, TS export
merge, unsafe/missing/duplicate/SQL errors and retry, no-role, honest audit and
full metadata/business-row equality. Both live OpenAPI snapshots equal contract
SHA256 481758EF3A0D6F22D781AAE0A982DA974B2321A9E7736A89765E3703257F7201.
No local integration app is retained. Full frontend generated/lint/typecheck/
73-unit/build pass. Output-limit target44 passes after the full565 build with
only an additional test, no production jar/source changes. Exact cloud pending.