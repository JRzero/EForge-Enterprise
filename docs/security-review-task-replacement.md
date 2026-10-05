# Quartz task replacement failure recovery

Scope: preserve an existing RAMJobStore task when its replacement fails during
`SysJobServiceImpl.updateSchedulerJob`. This is a compatibility-boundary repair,
not completion of canonical task CRUD or scheduler/database atomicity.

The replacement captures the original job payload, trigger keys, saved next
fire time and individual pause states before deleting the old key. If creation
or its subsequent pause fails, it removes the attempted new key and reinstalls
the original job and triggers. Recovery starts at the saved next deadline so
Quartz does not recompute a firing from a historical start time. A different
target group already containing the same ID is rejected before either schedule
is touched. Original grants, invocation whitelist and SQL transaction rollback
rules remain unchanged.

Seven tests use an actual isolated Quartz RAMJobStore. They cover same/different
group replacement, active/paused originals, failure after storing the new job,
occupied target keys and recovery after an actual firing. Injected faults affect
only the failing Quartz operation. The four original-preservation cases fail
against the prior implementation because the original key has been deleted.

The disposable MySQL/Redis harness additionally submits an invalid legacy
misfire policy that fails inside scheduling after a real SQL update and old-key
deletion. It checks SQL rollback of the original fields, successful manual
execution through the restored original key, the original target in the real
execution log, and absence of the failed replacement key. It deletes only its
owned extra execution log before continuing the existing task-log regression.

Remaining requirements include canonical task input validation and CRUD,
transaction commit failures, concurrent mutations, partial batch deletion,
preventing precommit activation, recovery under persistent scheduler faults,
and the task/Cron/log React pages. Compensation itself can fail; its exception
is attached to the original failure rather than claiming successful recovery.
This repair does not establish a distributed transaction or full module parity.