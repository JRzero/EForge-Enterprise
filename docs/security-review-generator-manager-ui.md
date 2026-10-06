# Generator manager UI security review

## Scope and behavior

The statically registered tool-generator route at /gen consumes the pinned EForge
components and generated canonical API client. V026 binds only this implemented
ROUTE. Form builder remains deferred and unbound. No components are resolved from
SQL strings and no upstream baseline changes are made.

The page implements list filters, LocalDate ranges, server ordering and paging,
column visibility, exact string identities, database discovery and batch import,
admin batch creation, basic/field/output configuration, native drag and keyboard
field ordering, original dictionary/menu selection, tree/subtable relationships,
synchronization, inert highlighted preview/copy, single/batch ZIP download,
configured filesystem output and confirmed metadata deletion. Original row output
mode selects configured output; bulk download remains ZIP. Template switching away
from subtable clears the old child relationship, matching the original editor.

## Authorization and data boundaries

Backend original permissions remain authoritative for every mutation and read.
Menu choices require authentication and delegate to the original user-scoped menu
query; a user with no grants receives an empty list. The concrete projection emits
string IDs, parent IDs, names and kinds only. Function nodes cannot be selected as
parents. List outputType is metadata, not a filesystem or component reference.
Anonymous requests are rejected before SQL. No JWT is placed in a URL.

Import row identities are prefixed and encoded internally so legitimate database
names such as __proto__ cannot collide with selection-object prototypes. Requests
retain the exact original names. Metadata/field IDs retain their string precision.
SQL creation never automatically retries, rolls back implicit DDL, or drops
created business tables. Structured partial/unconfirmed outcomes remain visible.
Filesystem partial outcomes are retained; retry requires explicit user action.
Deletion confirmation names its metadata-only scope. Existing shared SQL guards,
physical identity protections and output boundaries remain in force.

## Presentation and recovery

React renders metadata and code as text. The bounded linear syntax scanner uses
React text nodes, never HTML insertion; large sources retain the exact source as
plain text. Clipboard and ZIP comparison use original source contents. Unknown
server errors are generic; no raw SQL/driver text is displayed. Dialogs retain
failed drafts, separate dictionary/menu failures, retry explicitly and confirm
discard. List requests abort on changes/unmount. Busy action locks prevent repeat
mutations. Native dialog and roving editor tabs retain keyboard navigation.
Long output paths wrap outside dialogs; the old style demonstrably overflows a
375px viewport and the corrected style preserves all text within it.

## Current evidence

- Full local Maven 618 (608 boot + 10 data-scope), one existing OS skip; targeted
  GeneratorReadControllerTest 20, including authenticated scope, anonymous/no-role,
  exact IDs, concrete projection and SQL error privacy.
- Frontend lint/typecheck, reproducible client, 89 units, production build and
  71 mocked browser cases passed. Seven manager cases cover exact imports,
  partial DDL, failed-save draft recovery, picker retry, keyboard/discard,
  tree/subtable metadata and controlled mobile overflow regression.
- Final default/enabled profiles each passed all 47 real browsers and the complete
  API/SQL regression. Sequential observer94994 ended0. Four manager cases prove
  import/edit/drag/sync/ZIP/custom output, partial DDL, grants/revocation and actual
  tree/subtable configuration. Post-browser SQL proves original rows retained,
  created physical tables retained, failed/unattempted/unauthorized tables absent
  and deleted generator metadata absent. Both live OpenAPI hashes match below.
- Current schema SHA-256:
  36EE572B9178EC84786C721AFBB477588C1F0D006D0CD9250467323831E7763F.

## Acceptance limits

Exact d569f33d2ddba9ae4a07f34115a5bcf77511388e cloud is accepted: server37533050064 all three jobs and web37533050094 terminal SUCCESS. Unique observer62282 ended0. Direct accepted-server/web logs prove618 backend (one existing OS skip),89 units/71 mocked, both47 browser/API profiles, actual installed generated hosts and exact main OpenAPI. This manager stage does not prove every
emitted control variant, complete shared-shell parity or final active capability
acceptance. Form builder is deferred, not completed. The previously rejected
Quartz runtime mutation scheme is neither implemented nor retried by this change.
