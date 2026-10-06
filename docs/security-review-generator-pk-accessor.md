# Generated primary-key accessor review

The original domain template preserves Java field spelling when the second
character is uppercase and length exceeds two. Generated subtable services used
capJavaField instead, so saved primary key oRderKey produced getORderKey calls
although the actual domain declares getoRderKey.

VelocityUtils now provides pkJavaAccessor using the domain's existing rule.
Only the two generated service getter calls consume it; mapper/service method
suffixes retain their original spelling for compatibility. Physical SQL names,
metadata and actual domain field/accessor names remain unchanged.

GeneratorDomainTextTest compiles every generated Java file with the actual JDK,
loads classes and executes parent insertion/child foreign-key assignment. New
orderKey/oRderKey/父键 cases use an independent expected accessor map. Before the
fix ten cases had one failure: two actual compiler errors for missing getORderKey.
After the fix all ten pass. Full Maven verify passes 589 tests (579boot + 10scope),
recorded in generator-pk-accessor-verify.log; session43447 ended successfully.

Real HTTP output fixtures now persist oRderKey and compare generated domain and
service getter spelling in the binary archive, while retaining canonical/original
preview and download fidelity, SQL failure recovery, permissions, audit and full
metadata/business row comparisons. Final default/enabled profiles with real
browsers are sequentially running under session46711, logs
 generator-pk-accessor-disabled/enabled-runtime.log. Not accepted yet.

This is not full generated-module deployment or generator completion. Tree Java
aliases, other language semantics, custom filesystem output, true React/EForge
output, complete management pages and generated CRUD/tree/sub HTTP/browser
validation remain required. Canonical implementation commit67ea28c cloud evidence
cannot prove this currently uncommitted fix. Form builder remains deferred.
Default-profile acceptance: generator-pk-accessor-disabled-runtime.log records 43 real browser cases and final complete API PASS. Its live OpenAPI equals B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0. Actual saved oRderKey original/canonical preview and ZIP, SQL rollback/privacy/recovery, permissions, audit and complete row retention pass. Same session46711 now runs enabled profile; do not package over that live local app. Full two-profile/cloud acceptance remains pending.

Final local acceptance: session46711 ended0; default/enabled profiles each record43 real browsers and final complete API PASS. Both live OpenAPI exports equal contract B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0. Actual SQL saved oRderKey output, original/canonical complete preview and binary ZIP, safe SQL/path failures/retry, honest audit, exact metadata and business rows pass. No local app retained. Frontend source is unchanged from accepted67ea28c (75units/lint/typecheck/build/generated reproduction and accepted web37458912762). New fix cloud acceptance remains pending its own exact commit/run.

Exact cloud acceptance: bd83767f99f7b07a8ff54debda5c71c6f4d38088 server37461230715 all three jobs SUCCESS; observer6740 terminal0. Direct generator-pk-accessor-cloud-accepted.log proves589 backend (579boot+10scope), both64 snapshots/both474 output context native probes, default/enabled each43 real browsers, complete original/canonical output HTTP and MySQL/Redis/Quartz/OSHI/ACL/captcha APIs and both exact OpenAPI comparisons. Frontend unchanged from accepted67ea web37458912762. This accepts the PK fix only; later dirty custom-filesystem source is not covered.
