# Generated form required controls and write phases

Original Vue index.vue.vm emits required rules from column.required. Generated
React native inputs/selects/radio already used HTML required, but checkbox groups,
rich text and uploaded values had no shared pre-submit rule. Actual browser
regression32834 saved an empty required checkbox and closed the editor, recorded
in generator-required-checkbox-before-runtime.log.

The React template checks currently writable fields before submitting. Child
validation excludes inferred FK and automatic PK and respects each write phase.
Missing means null, undefined, empty string or empty array; numeric0 and
Booleanfalse are valid. Existing uploaded paths remain valid logical values;
empty rich text is already normalized by the shared editor. Native validation is
retained. Local messages are assigned directly, not translated as network errors;
14571 exposed the first attempted local error being mislabeled connection failure.

A second actual browser regression78572 found an unfilled legal __proto__ field
displaying "[object Object]" from an inherited property. Form, query, cell and
detail reads now use Object.hasOwn before retrieving dynamic metadata keys.
The legal field remains supported, including exact persistence and clearing;
absent fields are undefined instead of inherited prototype values.

This is original frontend UX parity. Authoritative authorization, canonical write
contracts and original SQL update semantics are unchanged. It does not claim
server enforcement of all metadata-required flags. Complete automatic-key and
supported type/control variants remain open.

The actual installed CRUD/tree/sub matrix includes required checkbox and required
Integer/Double/Boolean, required insert-only and required edit-only root fields.
Absent edit-only values do not block creation; absent insert-only values do not
block editing. Zero/false and original insert-only persisted data are retained.
Initial __proto__ controls are empty, then exact values persist and clear.

Final full Maven verify passed618 (608Boot +10scope, one existing OS skip), in
generator-required-own-value-final-verify.log. Both final generated-host profiles
pass actual compiled Java/TypeScript, production host build, browser, client,
SQL/Redis permission and mutation/export audit in
generator-required-own-value-final-disabled/enabled-runtime.log (observer52071).
Earlier full framework profiles86621 passed47 browsers and complete APIs per
configuration; those precede the final own-property correction and new live logout
test and are not misrepresented as latest48-browser evidence.

Combined47513 failed a framework-only menu cardinality fixture after installing
generated routes. Authoritative generated and framework fixtures run separately;
no seed or OpenAPI assertion was weakened.58536 was invalidated by editing frontend
source during live Vite/HMR and is not accepted.

Observer52071 ended0: both focused3-login and complete real API profiles pass. The final normalized live OpenAPI equals the contract (36EE572B9178EC84786C721AFBB477588C1F0D006D0CD9250467323831E7763F). Frontend reproduction/lint/typecheck/build,91 units and71 mocked browsers pass in66569. New exact cloud acceptance remains pending.
Form builder remains deferred; the specific prior Quartz runtime rejection remains.
The complete active goal is not finished.
## Exact correction accepted

6b1e375ffd1c41012e93c0af0194399d8aebf650: server37547032711 all three jobs and
web37547032673 terminal SUCCESS. Unique observer83989 ended0. Direct
generator-required-logout-cloud-accepted-server/web.log prove618 backend
(608Boot +10scope),91 units/71 mocked browsers, both48 real framework browser and
complete API profiles, both actual installed generated host profiles, native
MySQL checks and both exact OpenAPI contract gates. The controlled real logout
test passes in both full live suites. Old3266157 remains failed; the corrected
exact source supersedes it. Automatic-key expansion is separate uncommitted work
and is not included in this acceptance. Full active parity goal remains incomplete.