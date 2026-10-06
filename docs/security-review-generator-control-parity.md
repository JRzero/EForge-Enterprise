# Generated React controls and empty-string parity review

## Concrete correction

Optional String input/select controls previously converted an explicit empty value
to undefined. JSON omitted that property, so the original dynamic MyBatis update
retained the previous database value. The actual installed generated CRUD browser
failed after clearing the legal __proto__ field: the old exact string survived.
Generator-control-clear-locator-before-runtime.log records this failure.

The pure renderer's React template now returns String values, including an empty
string, before the optional numeric/date conversion. Existing original required
validation and authoritative backend permissions remain in force. Long IDs and
BigDecimal continue as exact strings; no general null/omitted-field semantics or
SQL update behavior is rewritten. Optional textarea, checkbox, rich text and file
removal already emitted explicit empty strings and are now checked alongside input
and select. The original Vue templates and baseline are unchanged.

Original select/radio dictionary query controls were also missing from React query
forms. The original vm/vue/index.vue.vm renders them as dictionary selects. React
now uses the shared authenticated dictionary hook, error/retry notice and scoped
options. The query remains the generated typed wire binding, not a raw SQL field
or a component name from metadata. Backend query permissions remain authoritative.

## Actual installed matrix

The owned deployment compiler expands the CRUD fixture with all nine configured
control kinds: input, textarea, select, radio, checkbox, datetime, imageUpload,
fileUpload and editor. Seven Java types are exercised: String, Long, Integer,
Double, BigDecimal, Date and Boolean. The same actual generated Java, MyBatis XML,
OpenAPI client, statically declared routes and EForge host are compiled and installed
in the original Boot/JWT/Redis/MySQL/audit runtime.

The browser creates, persists and reads dictionary values/multiselection, Unicode
and literal HTML text, precise Long/BigDecimal, millisecond dates using the browser's
actual timezone, numeric zero and Boolean false, legitimate __proto__, PNG upload,
UTF-8 text file upload and rich text. Uploaded paths are actually served and text
bytes compared. It edits/clears optional strings, dictionaries, checkboxes, rich
text and upload paths; actual detail reads prove empty strings reached MySQL.
Generated select/radio queries transport the exact generated wire names, return
empty filtered rows and reset to the persisted row. Original CRUD/tree/sub actions,
child FK, tree root, multi-row deletion, exports, no-role denial, immediate grant
withdrawal and persisted audit remain verified by the same installed-host probe.

## Fixture discoveries kept distinct from product fixes

Playwright's object-transfer boundary loses __proto__ own keys. An independent
browser experiment proved directOwn=false versus JSON-text textOwn=true with an
exact value. The verifier therefore transports raw JSON text and parses it locally;
it does not drop or reject legal metadata. A relative page.request URL without a
configured request base was another fixture failure; it now resolves against the
actual owned browser origin. Prefilled textarea content contributes to Playwright's
label text, so the fixture locates the actual textarea within its field label.
Only after these fixture corrections did the actual empty-string persistence
failure become the authority for changing the product template.

## Current evidence and limits

Full local Maven618 (608boot + 10scope, one existing OS skip) passed after the template
correction. Frontend lint/typecheck, client reproducibility,89 units and production
build passed. Both default/enabled actual installed-host matrices passed, including the new
empty-string/query assertions. Sequential observer99052 ended0; fixed-disabled/
enabled runtime logs prove the complete actual Java/TS/production build, browser,
HTTP/MySQL/Redis/grant/audit verification. Exact new cloud validation is pending. The manager stage's accepted
implementationd569f33 is separate evidence and cannot accept this template change.

This matrix expands CRUD controls. Tree/subtable control permutations, required/
disabled/autokey variants, date/timezone/XLSX edge cases, shared-shell parity and the
final active-capability audit remain active. Form builder is deferred, not complete.
The specific previously rejected Quartz runtime scheme remains untouched.
