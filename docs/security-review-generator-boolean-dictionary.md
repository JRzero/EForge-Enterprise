# Generated Boolean dictionary correction

## Behavior and boundary

The original numeric dictionary values0/1 did not round-trip through generated
Boolean select/radio controls. The previous renderer converted every choice except
literal true to false, and converted the stored Boolean to true/false display text
that could not match the original numeric option. The actual installed browser
failed to check the value1 radio in generator-boolean-dictionary-before-runtime.log.

The renderer explicitly converts true/1 and false/0, rejecting other Boolean text.
Boolean dictionary controls and tags map a stored Boolean back to the matching
original option through the same conversion. String, exact Long/BigDecimal and
original SQL update semantics remain unchanged. Unrecognized scalar draft text is
retained so the authoritative generated backend can reject it rather than silently
persist false. This does not validate every metadata type/control combination.

## Verification status

Full local Maven verify passed618 tests (608Boot +10data scope, one existing OS
skip), recorded in generator-boolean-dictionary-final-verify.log. Frontend generated
client reproduction, lint, typecheck,89 unit tests and build passed.

Final default/enabled generated-host regression93602 ended0. Logs generator-boolean-dictionary-final-disabled/enabled-runtime.log prove actual compiled and installed pages. The matrix adds
Boolean select/radio values to CRUD/tree/sub roots and actual sub rows, proving
numeric choices, exact Boolean persistence, edit refill, dictionary labels, root
query/reset, and invalid scalar400 with retained draft/unchanged SQL data. The first
post-fix runs exposed fixture expectations: sys_common_status uses 成功/失败, and
child detail cells include their field label before the dictionary tag. These are
test corrections, not additional product behavior changes. Exact new cloud acceptance is still required; local success is not cloud acceptance.

Required/readonly/auto-key variants, other supported typed dictionary combinations,
date/timezone/XLSX, complete shared shell and final per-capability audit remain.
Form builder is deferred. The specific prior Quartz runtime rejection is preserved.
## Exact cloud failure and correction

3266157 server37539853310 ended FAILURE in verify at the real generated logout;
runtime/auth jobs and web37539853411 passed. It is not accepted. The new logout
race correction and required/own-property field work are reviewed separately in
security-review-session-logout-race.md and
security-review-generator-required-controls.md. Their final generated profiles
also re-exercise the numeric Boolean control matrix. New exact cloud acceptance
is still pending; no infrastructure-only retry is used for this product failure.
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