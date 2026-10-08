# Canonical task writes and management — implementation checkpoint

The approved affected-task transaction/admission boundary is accepted separately
at `fb7c7b12de8e157942d5132e79c7eac134d23f82` (server `37705061672`, all four
jobs). This document concerns the subsequent invocation policy, canonical write
contracts, generated client and management controls. They are accepted at exact
source d2e051955ff040896b76ed458e9da9cadedce766 by server37712204477 (four
successful jobs) and web37712204380. The final current-scope audit is recorded in
current-scope-acceptance.md; the form builder remains deferred.

## Authority and compatibility

Five canonical operations use the original independent grants: add, edit,
changeStatus (status and manual run), remove. Concrete validated request records
and HTTP 201/204/202 replace compatibility envelopes only inside `/api/v1`.
Created IDs are decimal strings and Location identifies the new resource. Create
retains the original paused default. Writes do not require query permission or
read a row back after committing merely to construct the response. Task reads,
logs, filtering, ordering and XLSX remain on their existing contracts.

Update carries complete configuration; blank/null remark explicitly clears it.
Sparse status mutation retains the other fields and records the authenticated
actor. Batch IDs are fully validated before entering the existing guarded
service. Deletion remains idempotent. Manual enqueue occurs after SQL commit,
and expired/missing plans return 409. Server authority remains the existing
transaction/admission boundary, not frontend permission gates.

Original `sys_job` has a composite primary key. The compatibility add handler
now discards a request-supplied job ID: an add-only caller must not create a
different physical row with an existing scheduler identity. Canonical creation
has no ID input. Trusted internal service use is unchanged. A targeted MVC test
and the real HTTP permission matrix exercise this boundary.

## Invocation policy

The original five literal wrapper types remain String, Boolean, Long (`L`),
Double (`D`) and Integer. Original seed syntax without parentheses remains
valid. Quoted string commas, parentheses, apostrophes, Unicode, URL text and
expression-looking text are inert data. Values are parsed; no expression engine
is used. Existing legal numeric forms, including hexadecimal doubles, remain
supported. Canonical writes require a real public method with those exact types;
legacy creation still permits a missing business method to produce the original
failure execution log.

Package authorization now checks equality or a dot-delimited descendant rather
than a plain prefix. Object methods and disallowed declaring packages are
rejected. Bean metadata is inspected without initializing a FactoryBean or
constructing a lazy task. Class lookup explicitly disables initialization;
canonical class-form validation checks a public zero-argument constructor
without calling it. Only actual dispatch obtains the bean/constructs the class
and invokes the method. This is a package allowlist, not a per-method registry:
public methods in the configured task package are intentionally available.
Legacy controller keyword restrictions are retained; canonical literal string
data is governed by the typed parser instead of broad keyword bans.

## Failure and UI behavior

Checked scheduling failures, SQL/transaction errors and other runtime faults are
mapped to fixed 503 ProblemDetail before operation auditing. Neither response
nor failed audit stores driver/SQL secrets. The response does not promise
exactly-once execution or rollback after an uncertain commit. Lost transport
responses are explicitly unconfirmed, with instructions to refresh before
resubmitting; no automatic mutation retry is added.

The generated client comes from the actual running OpenAPI. New management
controls use EForge's pinned dependency, stable permissions, exact string IDs,
captured confirmations and one pending mutation. Editor failures retain the
draft. Cron confirmation changes only the draft until Save; cancel does not
persist it. Creation states that it starts paused. An accepted manual request
directs readers to logs rather than claiming successful business execution.

## Evidence at this checkpoint

- Final full Maven: 690 declarations (680 Boot plus all ten data-scope cases),
  one existing platform skip; `task-management-final-maven.log` terminal success.
- Targeted MVC/invocation tests prove original grants, safe problems, five
  argument types, literal delivery, prefix sibling rejection without class
  initialization, lazy bean validation without construction, seed syntax and
  exact registered non-Java bean aliases. Eight invocation cases pass.
- Frontend types and lint pass; 107 units, generated-client reproducibility
  and production build pass. Initial sandbox EPERM prevented test startup;
  rerunning with the appropriate execution permissions passed the suites.
- Final native MySQL modes 0/1 each pass 35 assertions on the final jar;
  `task-management-final-native-0/1.log` and process45563 terminated successfully.
- Earlier real profiles pass 63 default / 64 enabled browsers plus full HTTP
  integration. Their jar predates the final registered-alias compatibility fix;
  those counts are not claimed as final-source full browser evidence. Final
  jar task-file browsers (five per profile) plus full HTTP integration passed
  both default and enabled configurations, process32918 terminal0. The actual
  large task ID XLSX cell is literal text and matches every SQL/HTTP digit.
  Two earlier fixture failures were
  corrected: an empty validated DTO was rejected with 400 before method
  authorization, and a generated role name exceeded the existing 30-character
  limit. Neither product validation nor authorization was weakened.
- Final frozen frontend passes 147 mocked browsers, 107 units, lint/typecheck,
  generated-client reproduction and build. New task editor and mutation cases
  include independent add-only Cron access. Earlier
  the editor locator was corrected to include the pinned component's Required
  accessibility suffix. The first final real command used a test title as a
  file pattern and started zero tests; it was corrected to jobs.spec.ts.
- Actual OpenAPI matches the generated contract at SHA256
  `7FE11E39D73C1CA0C58C5E4B9F49DE073DD621CF50126A173FC7752E7D9B914E`.
  Exact-source server cloud remains pending. Web37712204380 is terminal SUCCESS
  for d2e051955ff040896b76ed458e9da9cadedce766, directly proving107 units and147
  mocked browsers plus types/lint/reproducibility/build. The owned SQL fixture tests IDs above
  JavaScript's safe integer range and XLSX literal text precision; the existing
  CanonicalExcelUtil remains the authoritative export boundary.

No source-path assignment, component implementation or this checkpoint is a
substitute for final acceptance of the five original operations.

## Original consumer reconciliation

The pinned archive's `views/monitor/job/index.vue` was read directly (local
`task-management-original-job.vue`), rather than inferred from the API list.
The original add/edit/remove/changeStatus/query/export grants remain distinct.
Toolbar single-selection edit, multi-selection delete, row actions, confirmation,
task/log navigation, detail, group/status dictionaries, filters, sorting, full
filtered XLSX and existing log cleanup are retained at the actual JobsPage
consumer. Full configuration includes name/group/target/Cron, all four misfire
choices, concurrency and remark; add stays paused. Cron is available in the
add/edit form using the existing add/edit/query preview grant union; its
confirmation does not save the task. Real add-only creation proves that query
permission is not borrowed for the write response. UI status actions use explicit
confirmation and server authority; manual feedback states acceptance and directs
the reader to actual execution logs. Decimal-string identities and literal XLSX
cells intentionally correct the original unsafe large-number transport.

This closes implementation gaps for this consumer; exact-source local runtime
passed, while server cloud evidence is still required for acceptance. Whole-source reconciliation
resolved all229 API evidence references (13 named test classes) without missing
files; that structural check is explicitly weaker than these behavior proofs.

## Final current-scope acceptance — 2026-10-08

Product source d2e051955ff040896b76ed458e9da9cadedce766 is accepted at exact server37712204477 (all four jobs terminal SUCCESS) and web37712204380 (SUCCESS). Direct task-management-cloud-server/web-accepted.log proves690 backend declarations including10 data-scope cases (one existing platform skip), actual MySQL task boundary modes0/1 each35,107 frontend units,147 mocked browsers, default and enabled configurations each64 real framework browsers/fullAPI, and both configurations of all seven installed generated families (CRUD/tree/sub, auto/autotree/autosub, String-key). Both live OpenAPI snapshots match the committed/generated contract at7FE11E39D73C1CA0C58C5E4B9F49DE073DD621CF50126A173FC7752E7D9B914E. The first observer ended with GitHub unexpected EOF; authoritative success and downloaded logs establish acceptance, not that observer's exit code. No product failure occurred in this final source's cloud runs.

The final original-consumer review combines the existing capability table and original-shared-consumer-audit with direct pinned task-page review and actual task-management/browser/SQL evidence. All19 original API modules now account for119 accepted operations and zero pending;175 original source paths remain inventoried. File assignment and counts alone are not the acceptance criterion: original grants, full task configuration/Cron, bulk/single actions, literal target delivery, actual manual/automatic execution, transaction recovery, SQL fault/audit privacy, large identities/XLSX and add-only access have direct consumer proofs. Existing shell/shared, calendar/timezone/XLSX, generator output and seven installed generated families are re-exercised by the final source's complete cloud suites. PanThumb remains an unconsumed original component, not a fabricated implemented feature. The online form builder remains explicitly user-deferred and is neither developed nor marked complete. Baselines and architecture remain unchanged; only the approved affected-task runtime boundary was implemented, never the abandoned global scheduler rebuild.

Current requested scope is complete and automatic development can stop. Historical pending checkpoints above remain chronology, not current blockers. This evidence does not promise mathematically bug-free operation, exactly-once scheduling, rollback after uncertain commit, completion of the deferred builder, or identical standalone Vue helper APIs. The user's finish-then-pause instruction applies now.