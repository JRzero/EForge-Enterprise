# Canonical task writes and management — implementation checkpoint

The approved affected-task transaction/admission boundary is accepted separately
at `fb7c7b12de8e157942d5132e79c7eac134d23f82` (server `37705061672`, all four
jobs). This document concerns the subsequent invocation policy, canonical write
contracts, generated client and management controls. They are not yet accepted
by exact-source cloud or both full browser profiles. The whole goal is incomplete;
the form builder remains deferred.

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
  jar task-file browsers plus full HTTP integration are still running.
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
  Exact-source cloud remains pending. The owned SQL fixture also tests IDs above
  JavaScript's safe integer range and XLSX literal text precision; the existing
  CanonicalExcelUtil remains the authoritative export boundary.

No source-path assignment, component implementation or this checkpoint is a
substitute for final acceptance of the five original operations.
