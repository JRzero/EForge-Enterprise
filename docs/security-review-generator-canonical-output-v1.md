# Generator canonical preview and download contracts

Actual implementation: GET /api/v1/tool/generator/tables/{id}/preview and POST
/api/v1/tool/generator/downloads. Original preview and code permissions remain
separate at controller and service; the original snapshot loader is also guarded.
Read/query grants do not imply output grants. No new AjaxResult/TableDataInfo or
legacy DTO leaves these canonical endpoints. The compatibility endpoints remain.

Preview returns exact string tableId, captured generationDate and concrete output
file records (template resource identity, validated relative path and source text).
Download accepts1..100 distinct exact positive string long IDs. Invalid formats,
overflow and duplicate selections fail before metadata SQL. Both use the same
actual immutable renderer, short read snapshot and full ZIP/collision/limit/path
boundary. JSON and application/zip responses are no-store. Archive bytes and
headers are created only after successful full generation; faults remain safe
ProblemDetail with actual400/403/404/409/503 semantics. Download audit remains
GENCODE and failures propagate to failed audit. No metadata/business/file writes.

Generated OpenAPI functions are used by the frontend authenticated transport,
with JWT only in Authorization, no-store, credentials omitted, abort and60s
output timeout. Preview remains typed text, binary ZIP is Blob; 404/409 preserve
session and401 signs out. No handwritten response/request DTO is duplicated.

Evidence so far:
- Full Maven586 (576boot+10scope) pass, generator-canonical-output-verify.log.
-20 actual MVC cases with real loader/service/renderer and mocked SQL mapper:
  decoded full two-table ZIP/shared index, typed11-file preview/exact long ID,
  no legacy objects, auth/no-role/preview-vs-code/list-query restrictions before
  SQL, invalid IDs/formats/overflow/selection body/100 maximum/duplicates,
  missing/real mapper failure safe ProblemDetail, path/collision failures without
  partial attachment. Target63739 ended0.
- First complete actual MySQL/Redis API profile without browser passed under83738,
  generator-canonical-output-first-runtime.log. Added real HTTP cases compare
  canonical file records and single/batch binary ZIP with original outputs;
  no-role/anonymous, invalid/duplicate/missing/path/SQL fault, safe retry and exact
  data retention are checked using the parent-owned disposable fixtures.
- First actual normalized OpenAPI exported and copied to contract, generated TS
  client reproduced exactly; SHA256 B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0.
- Frontend generated/lint/typecheck/75 unit/build pass under66924. Two new transport
  cases preserve complete binary bytes/text/IDs/abort/security boundary and error
  session behavior. The initial test expected nonexistent expired phase; inspected
  the actual existing session contract and corrected only the fixture expectation
  to signed-out. Production session behavior unchanged.
- Final default/enabled full API+each43 real browsers run sequentially under86768,
  generator-canonical-output-disabled/enabled-runtime.log and live OpenAPI files.
  No final two-profile/cloud acceptance yet. Do not package over its live app or
  start parallel integration ports. a884f08 cloud proves only earlier bundle code.

Scope remains incomplete: canonical custom filesystem output, full generated
language semantics/tree Java aliases/PK accessors, true React/EForge templates
(current eforge-react still Vue fallback), complete generator management UI and
actual generated business CRUD/tree/sub HTTP/browser deployment. Original shell,
remaining task mutations (specific rejected runtime scheme needs explicit human
approval) and final all-capability audit remain. Form builder is deferred by user.
Final local acceptance (2026-10-06): both generator-canonical-output-disabled/enabled-runtime.log end in PASS and each records 43 real browser tests passed. Session86768 is no longer retained; authoritative complete logs and both live OpenAPI exports prove terminal success. Both exports exactly equal contract SHA256 B817D25FAACE254B3514DB47AF09F0F8356122B4D6E605E91615DCF30E630CF0. Canonical preview/download real permissions, full binary fidelity, safe SQL/path failures/recovery, audit and exact metadata/business-row retention pass. Cloud acceptance of this canonical implementation remains pending its own commit and workflows.
