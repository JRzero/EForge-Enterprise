# Generated String primary-key selection review

A real installed generated page with legal String identifiers `__proto__`,
`constructor` and `toString` exposed inherited object-property lookup in selection.
The before-fix run59941 ended1: after creating the first record without selecting
it, the actual Delete selected button was enabled. Evidence:
`generator-string-key-before-runtime.log`. This was a product failure.

The generated page now gives table rows an opaque `row:` prefix for UI selection
identity, and accepts only own selection properties whose value is exactly true.
The model id accessor, request types and API identifiers remain unchanged;
selected request IDs are mapped back from the original model. The pinned EForge
package and backend permission rules are unchanged. Groups and static routes keep
their existing architecture contracts.

Verification fixtures add a seventh installed module with a VARCHAR String PK.
The browser creates all three identifiers, proves initial selection is empty,
selects and edits the intended record, retains its identifier and insert-only
value, downloads XLSX, and verifies the exact original IDs in a real bulk-delete
request. It also checks 404 after deletion and actual no-role navigation/page/API
403 denial. Request membership compares sorted copies so SQL collation ordering
is not mistaken for a product requirement.

Final Maven92080 ended0:618 tests (608Boot with one existing OS skip plus10scope).
Frontend53325 ended0: reproducible client, lint/typecheck,91 units, production
build and71 mocked browsers. The final two actual seven-module profiles42172 ended0 in both default and
enabled-console/custom-output modes. Each includes the actual String PK browser
case plus all six prior manual/automatic CRUD/tree/sub modules, exact generated
clients, real SQL/JWT/Redis/permissions/audit and zero-orphan checks. Both installed
OpenAPI snapshots match SHA256D203057072F9DADB7D936EEB5109D69E3976F1B98D15F17DD7A8D608B575A386.
Evidence: generator-string-key-final-disabled/enabled-runtime.log and matching
OpenAPI snapshots. Exact cloud acceptance remains pending.
No local pending result is represented as successful. Full active parity is not
complete. Form builder remains deferred, and the specific Quartz runtime denial
remains in force.