# Generated automatic primary keys

Original GenUtils.initColumnField sets insert=1 for all imported columns, including
automatic primary keys. React checked insert before its manual-key exception, so
an automatic key with insert=1 was rendered and validated as required input.
Actual generator-auto-key-before-runtime.log (92022 terminal1) proves one
oRderKey input when zero were expected; preceding manual CRUD/tree/sub passed.

One writableRootField helper controls root rendering and pre-submit validation.
Primary keys are writable only during creation and only when manual; non-key
fields follow insert/edit flags. Viewing still exposes response values. Schema,
canonical contracts, original SQL mappers and backend authorization are unchanged;
database generated-key behavior remains authoritative.

The fixtures retain auto=1, insert=1 and required=1 instead of clearing insert.
They compile/install real manual and automatic CRUD/tree/sub modules, canonical
menus, generated clients and static EForge routes in the original Boot assembly.
Root BIGINT sequences start at9007199254741101. Two actual browser creations
return exact string IDs; persisted detail/edit/unchanged IDs, insert-only values,
bulk deletion and true no-role403 are checked. The automatic tree's second node
references the first exact ID and remains visible through expand/edit/delete.
The automatic subtable has its own BIGINT PK sequence at9007199254741201.
Detail reads expose actual assigned child IDs and exact inferred parent FK.
Editing preserves the existing child ID while appending a distinct generated key;
bulk parent deletion is followed by an actual SQL zero-orphan count.

Initial expanded fixtures needed corrections: duplicate FixtureLine simple
aliases in two packages caused original MyBatis startup failure (74668); the new
child fixture is uniquely named FixtureAutoLine, without changing MyBatis config.
Exact label lookup included select option text (18372), so the parent selector uses
its actual combobox role; a tree cell with an expand button has no standalone
text leaf (15129), so row lookup uses its known text plus exact HTTP readback.
Converting the legacy fixture's manual-key label into an ordinary child column
also required normal insert/edit flags (56208). Disabled metadata was not bypassed
in product code. Actual failure body diagnostics contain only disposable UI text,
not passwords, tokens or persisted browser traces.

Final production Maven passes618 (608Boot +10scope, one existing OS skip),
generator-auto-key-final-verify.log. Frontend reproduction/lint/typecheck,
91 units/build/71 mocked tests pass (57200 terminal0). Original four-module
default/enabled profiles14067 ended0. Expanded final observer28066 uses
generator-auto-matrix-child-final-disabled/enabled-runtime.log; default all six
modules, SQL orphan proof and original full generated client/permission/audit
checks pass in both profiles; observer28066 ended0. Production source has not changed since
the final Maven; later changes are verification fixtures. Both live generated
OpenAPI snapshots match exactly: SHA25652CD6F01BE3A40B9099424A4D29A240E0DB4EABBE1A54EAAC1A225C36D32EABF. The framework contract remains36EE572B9178EC84786C721AFBB477588C1F0D006D0CD9250467323831E7763F. No new exact cloud is accepted.

Other supported type/control variants, shared shell and final active capability
audit remain open. Form builder is deferred; the specific Quartz runtime rejection
is preserved. Previous6b1e375 required/Boolean/own-field/logout correction is
separately exact-cloud accepted under server37547032711 and web37547032673 with
both48 framework browser/API profiles; it is not acceptance for this auto change.