# Approved task mutation and execution admission boundary

The user explicitly approved the concrete narrower runtime proposal on
2026-10-08. The abandoned scheduler-wide replacement is not implemented.
This review describes the current implementation; complete runtime/cloud
acceptance and canonical write APIs/forms are still pending.

## Transaction and scheduling behavior

`TaskMutationAspect` encloses the compatibility service's known create,
update, status, delete, batch delete and manual-run entry points outside its
transaction advisor. `TaskMutationBoundary` holds one fair local admission
lock until the real transaction manager has completed commit/rollback.
Existing service transactions join that root transaction. A pre-existing
outer transaction/synchronization is rejected so the lock cannot be released
while an external caller still owns the SQL commit.

Only affected task IDs are snapshotted. Their Quartz job details, captured
payloads, trigger deadlines and paused states are restored on mutation
failure, including newly allocated IDs from a rolled-back insert. Group moves
remove attempted keys for that ID across groups. No unrelated task is
paused, cleared or rebuilt. Original boot-time initialization is unchanged.
Status changes re-read the current SQL row and update only status/actor;
stale legacy inputs cannot overwrite a concurrent target/group/Cron edit.

Manual firings are enqueued in `afterCommit`, rather than before a commit that
could still fail. Original paused-task manual execution remains permitted.
Automatic and manual Quartz execution re-read committed SQL under the same
lock immediately before invoking the captured target. Deleted or changed
group/target/Cron/concurrency/misfire payloads are rejected, and paused
automatic executions are rejected. The lock is released before target code;
already-admitted invocations may finish normally. Identical configurations
after an intervening edit are treated as identical, not as revisioned events.

If restoration fails, or the transaction manager reports an uncertain
commit/rollback outcome, affected IDs remain marked for recovery. The next
affected mutation/admission reconstructs only that ID from actual committed
SQL, or fails with a generic unavailable error. Normal successful snapshot
restoration preserves the saved next deadline; reconstruction after an
uncertain outcome follows original scheduling rules and may recalculate it.
SQL driver details are not attached to execution-admission errors.

## Scope and operational cost

This is a single-process RAMJobStore boundary, not a distributed transaction.
Execution now depends on a SQL read and may wait behind mutations. Slow or
unavailable SQL can delay/reject dispatches, as explicitly approved. Direct
external database edits, external scheduler clients and future unguarded
mutation methods are outside this boundary. Target parsing/allowlist and
canonical HTTP write validation still require their own implementation and
acceptance; this foundation does not claim those controls are complete.

## Evidence so far

- `TaskMutationBoundaryTest`: ten targeted cases using actual Quartz
  RAMJobStore and actual Spring transaction/advisor lifecycle, with mocked
  SQL rows. The seven existing replacement tests also pass. These are not
  presented as MySQL evidence.
- `verify-task-mutation-boundary.ps1`: isolated, owned MySQL 8.4 containers,
  actual original `sys_job` schema, MyBatis mapper, Spring transaction
  manager/advisors and Quartz. Table-name modes 0 and 1 each pass 32 checks.
  The final probe has 34 checks per mode, including an actual missing-table
  SQL failure, generic admission error and recovery. They prove committed creation/status/group moves, real commit-barrier
  visibility and admission waiting, SQL rollback, partial Quartz batch
  failure/recovery, actual committed SQL after a post-commit response fault,
  stale/deleted rejection and unrelated deadline retention.
- Native probe fixes were confined to its expected exception type: Quartz
  reports invalid Cron as `RuntimeException` with `ParseException` cause.
  No product validation was weakened to make that fixture pass.
- Full Maven verification passes 671 declarations (661 Boot and all ten
  data-scope cases; one pre-existing platform skip). Frontend generated-client
  reproducibility/lint/typecheck/106 units/build and 144 mocked browsers pass.
- CI runs both native modes. Original authenticated HTTP/Redis/Quartz/browser
  profiles and exact-source cloud verification remain pending for this stage.

The native scheduler intentionally remains in standby to inspect scheduling
and committed admission deterministically. Actual target execution and
authenticated HTTP/browser behavior are covered by the subsequent full
runtime checks, not claimed from the native probe.
