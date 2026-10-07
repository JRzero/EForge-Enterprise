# Approved task mutation boundary — implementation pending

Human approval: on 2026-10-08 the user explicitly replied “批准” to the
concrete request covering per-execution SQL verification and the shared
mutation/execution lock, including possible dispatch delays under slow/faulty
SQL. This supersedes the missing-approval boundary below; it does not approve
the abandoned scheduler-wide replacement proposal. Normal implementation,
targeted fault/concurrency verification and already-authorized commit/push may
proceed. Approval is not implementation or acceptance evidence.

Current status: the approved narrower boundary is being implemented, with
targeted Quartz/transaction-advisor tests passing. Actual MySQL verification,
complete HTTP/browser regression and exact-commit cloud acceptance remain
pending. The rejection history below records the pre-approval state. The
scheduler-wide replacement proposal remains abandoned because it could
interrupt unrelated tasks.

The narrower proposal would modify only schedules whose task IDs appear in the
current create/update/delete/status request, including legacy callers. A local
fair lock would enclose the existing SQL transaction interceptor through actual
commit or rollback. Before mutation it would capture affected Quartz payloads,
trigger keys, next deadlines and pause states. On failure it would remove only
those IDs' attempted keys and restore their snapshots. Generated create IDs
would be included even when the insert transaction rolls back. Unrelated
schedules would not be paused, cleared or rebuilt.

Quartz execution would acquire the same local lock before invoking its captured
target. It would compare the captured task group/target/Cron/concurrency against
the committed row, rejecting deleted, rolled-back or superseded payloads. This
prevents a newly scheduled task from invoking an uncommitted target. A running
invocation that already passed the gate may finish normally.

If snapshot restoration fails, affected IDs would remain marked for recovery;
subsequent affected operations/execution and health checks would reconstruct
only those IDs from committed SQL or fail with a generic scheduler-unavailable
error. A recovery retry policy and paused/automatic versus manual execution
rules still require implementation and explicit tests before acceptance.

Risks requiring approval: every task execution would now require a database
read, and executions would wait during a task mutation transaction. Slow or
unavailable SQL can delay or reject dispatches. All mutation callers must pass
through the boundary; a new outer SQL transaction would be rejected rather than
silently releasing the lock before commit. This remains a single-process
RAMJobStore solution, not a distributed transaction or multi-node scheduler.

Required evidence before enabling: actual transaction-interceptor ordering and
commit-failure rollback, per-ID isolation, concurrent edit/delete/status/run,
partial batch SQL/Quartz faults, no precommit target invocation, persistent
scheduler faults and recovery, expired expressions, queued stale payloads,
original manual-run behavior and untouched unrelated task timings. Full existing
backend/data-scope/frontend/real MySQL/Redis/Quartz/browser regression must pass.

Automatic review's second rejection states that a global mutation lock and
per-execution database validation may stall or delay tasks and that existing
objective-level authorization is insufficient for this persistent high-impact
implementation. The explicit approval recorded above now permits implementation
of the concrete narrower proposal. It does not establish functional acceptance.
