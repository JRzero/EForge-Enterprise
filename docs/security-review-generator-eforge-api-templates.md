# EForge generated business API templates — in progress

This is an uncommitted implementation stage, not complete generator acceptance.
For eforge-react selections, the actual immutable output bundle now additionally
renders concrete Java API model/controller files. Original controllers and all
other original template families remain behind their existing compatibility
boundary. React selections still emit the old Vue frontend fallback: this must
be replaced with actual React/EForge templates, not accepted as complete.

## Implemented boundary

The generated canonical route is /api/v1/business/{module}/{business}. Responses
are record DTOs rather than BaseEntity/TreeEntity/AjaxResult/TableDataInfo. Ordinary
lists use the existing PageResponse and PageHelper; tree lists preserve the whole
filtered selection. Exact Long and BigDecimal responses are JSON strings; Dates
are explicit UTC timestamps. Saved Java field spelling including oRderKey stays
exact. Responses omit private inherited searchValue/params. Child responses are
also concrete records with exact IDs.

Queries bind only generated concrete fields. BETWEEN values populate the original
mapper parameter names internally. The original service/mapper remains authoritative;
no data-scope semantics are rewritten. Paging has minimum/maximum validation and
PageHelper cleanup on success/failure. Independent original list/query/add/edit/
remove/export grants use the original PermissionService, not frontend gating.

Generated create/update use concrete write records and map configured insert/edit
fields to fresh entities. Actor audit fields are server-derived. Update verifies
path/body identifier equality; duplicate or oversized delete selections are refused.
Mutations declare rollbackFor=Exception and failed row-count/readback conflicts,
retain original GENCODE-independent INSERT/UPDATE/DELETE audit, and return concrete
201/200/204 semantics. This annotation alone is not proof of SQL rollback or
concurrent consistency; actual generated module/database deployment remains required.
The generated XLSX endpoint preserves the whole filtered selection and original
Excel annotations/service, independent export grant, no-store and page cleanup.

Controller-local fixed ProblemDetail boundaries cover ApiFailure, bad bind/body,
access denial and caught DataAccessException. The framework API advice is scoped
and cannot be assumed to cover generated business packages. No driver detail is
returned. Generated operation IDs and schema names include the module identity.
Further request constraints, real OpenAPI schema/client extraction, response-type
edge cases and complete language/identifier semantics must still be proven.

## Actual evidence and limits

GeneratorEforgeApiTemplateTest renders actual immutable bundles for CRUD/tree/sub,
compiles actual Java source with the installed Java compiler, loads the classes,
then issues Spring MVC requests. A second compile phase excludes boot classes and
test classes from the original business-source compilation; only the API source
uses boot assembly's PageResponse/springdoc. This proves compilation direction,
not packaged installation or deployment. Install business/domain/mapper/service
source into the business module and API source into boot assembly, avoiding a
reverse dependency from business to the executable boot artifact.

Actual method-security CGLIB proxies use original PermissionService and real
LoginUser contexts. No-grant refusal occurs before service calls; list/query/write/
export grants remain independent and withdrawal immediately refuses reads. Tests
prove hostile Unicode/comment data is preserved, exact long IDs/decimal/UTC,
identity mismatch refusal, actor override against request spoofing, params not
mass-assigned, safe404/400/503 and cleared PageHelper state. Actual returned XLSX
bytes are parsed into a workbook. The service is a witness proxy: this is not
actual MySQL business-module execution or transaction/audit persistence proof.

Earlier failures: generated ProblemDetail factory needed HttpStatusCode instead
of int (actual compiler found three failures, fixed and three passed). The dynamic
module test context needed its own generated-class loader for CGLIB; corrected the
fixture, retaining original permission code. A path-normalization test edit had a
Java character escape error; corrected to char92 and phased compile passed.

Logs in server/eforge-boot/target:
- generator-eforge-api-writes-mvc-target.log: three categories pass.
- generator-eforge-api-export-target.log: three categories including actual workbook pass.
- generator-eforge-api-final-full-verify.log:606 total backend cases
  (596boot +10 data-scope), one OS-specific skip, full verify success.
- generator-eforge-api-module-boundary-fixed-target.log: latest test-only phased
  compilation improvement, three cases pass after the full production build.

Current production jar matches the final full-verify source. No production source
changed afterward; only compile-phase tests changed. Sequential real existing API
regression session67710 runs default then explicit enabled consoles/custom output,
generator-eforge-api-disabled/enabled-runtime.log and corresponding OpenAPI exports.
No browser is included in this first API regression. It does not install the new
generated business modules and cannot establish their SQL/browser acceptance.
Do not package over this live local app or repeat that authoritative process.
No cloud acceptance or new generated-module schema/client acceptance is claimed.

## Required next work

Install generated CRUD/tree/sub modules against isolated real SQL, verify actual
method permissions, audit and transactions/rollback/concurrency and retrieve their
actual OpenAPI. Generate clients reproducibly. Replace eforge-react Vue fallback
with actual pinned-EForge React controls including all original query/list/edit/
dictionary/date/upload/rich text/tree/child/detail/export behaviors and static route
bindings. Compile/build and deploy generated output, execute HTTP/browser flows,
then implement complete generator management UI and remaining shell/shared audit.
Form builder is deferred. The separately rejected Quartz runtime proposal remains
unimplemented and cannot be retried equivalently without its specific approval.

Existing API regression progress: default generator-eforge-api-disabled-runtime.log
ends in complete PASS; actual exported OpenAPI exactly matches existing contract
D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
The same sequential authority67710 is now running the explicit enabled profile.
Do not restart or package while its local app is live. This first regression has
no browsers and does not deploy the newly generated business module API routes.

Final existing API regression:67710 ended0. Both default and explicit enabled
consoles/custom-output profiles end in complete API PASS, and both exported
OpenAPI files exactly equal D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.
No local app is retained. This was a no-browser regression of the framework and
existing generator endpoints; generated business modules were not installed.
Frontend source/contracts remain unchanged from accepted7d05634 (79units/64mocked/
two43real browser profiles). The new three-category actual module compiler/MVC/
method-security/XLSX tests and full606 verify are green. Saving this template
checkpoint does not accept module SQL/transactions/audit/deployment, new module
OpenAPI/client, actual React/EForge output or complete generator UI.
