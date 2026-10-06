# EForge generated business API templates — in progress

This is an implementation checkpoint, not complete generator acceptance.
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

Actual generated business SQL module stage (2026-10-06, new scripts uncommitted):
verify-generator-business-module.ps1/probes/GeneratorBusinessModuleMysqlProbe.java
render and compile actual CRUD/tree/sub modules into an exclusively owned temporary
class directory, register the real generated MyBatis Mapper/Service and canonical
controller in Spring method-security/transaction context, and issue actual MVC
requests against isolated MySQL. Modes0/1 each52 assertions pass in
generator-business-module-native-0/1.log. Exact Long/decimal/string SQL round trips,
real filtered query/paging, denied create before physical writes, persisted create/
update/delete and child FK assignment pass. A real strict parent UPDATE failure
occurs after child deletion/reinsertion: both parent and child content roll back
under the actual generated controller/service/DataSourceTransactionManager chain.
Owned containers and generated directories are cleaned; cleanup validates the
resolved temporary root and owned prefix. The new native check is included in CI.

This extends the earlier service-witness evidence with actual SQL and transaction
proof, but does not prove concurrency, persisted LogAspect audit, actual network
server/OpenAPI/client or browser deployment. React frontend is still Vue fallback;
complete React/EForge templates, manager UI and generated browser flows remain.
Initial failures were only fixture startup (unquoted JVM option parsed by PowerShell,
then missing mapper factory import); no product logic was altered to pass them.
The previous implementation87b3f3f cloud still runs;79642 observation alone failed
with annotations unexpected EOF while authoritative GH jobs remained live. A single
reconnected observer now follows the same workflow; no tests were rerun or restarted.

Exact template-source cloud acceptance (2026-10-07):87b3f3f391614f0bd4cef247d663f79c95669d5e,
server37489735710 all three jobs SUCCESS. Direct generator-eforge-api-cloud-accepted.log
proves606 backend (596boot+10scope, one OS-specific skip), both MySQL modes each66
actual snapshot assertions (two new template outputs increase the former64),
each474 output contexts, default/enabled each43 real browsers, complete existing
APIs and exact committed OpenAPI comparisons. Original observer79642 ended1 only
because GH annotations returned unexpected EOF; authority stayed live. Reconnected
observer77573 ended0 after the same run succeeded; no tests were rerun.

The newer native SQL scripts/CI are commit e8a637fffba3487a1357c9f393435f2be7dbeebc;
they have local modes0/1 each52 actual generated module SQL/rollback assertions,
but their own server37492073073 remains pending. They are not covered by the older
87b source cloud acceptance. Its unique observer43975 follows
 generator-business-module-cloud-server.log. Complete generator/network/client/React/
UI acceptance remains incomplete. No frontend source changed or new web workflow.


Actual loopback HTTP checkpoint (2026-10-07, not complete generator acceptance):
The native probe now deploys each compiled generated CRUD/tree/sub controller
through a real Spring DispatcherServlet and embedded Tomcat on a random loopback
port. JDK HttpClient sends actual JSON create/detail/delete requests to the deployed
controller, original generated mapper/service and actual MySQL transaction manager.
Modes0/1 each80 assertions passed in generator-business-module-network-0/1.log,
including the previous52 SQL/rollback assertions, network no-role denial before SQL,
exact long IDs, Unicode physical writes, detail, immediate permission withdrawal,
and physical root/child delete. Final sequential process28441 exited0 and its owned
containers and embedded servers were cleaned. No production Java/template changed.

This probe's authentication filter exists only in the disposable test process and
installs a controlled LoginUser; it does not prove the deployed product JWT/Redis
login chain. Persisted audit, concurrent writes, generated OpenAPI/client, React
frontend and actual generated browser flows are still pending. No test identity
filter is installed into production configuration or generated output.
Initial fixture failure used an unsupported WebApplicationContext registerBean API;
GenericWebApplicationContext fixes that assembly. The first network run completed80
assertions but server.stop alone left Tomcat utility threads alive; inspected the
owned process, stopped it so the owner script cleaned its database, then added the
formal server.destroy in nested finally. Both final runs exit naturally, no System.exit
or assertion bypass. This new HTTP probe has no cloud acceptance yet; the earlier
nativeSQL e8a637f workflow37492073073 is still in progress and cannot cover new code.
