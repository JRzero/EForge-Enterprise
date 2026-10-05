# Canonical task read API review

Scope: task list, detail and filtered XLSX export only. No task mutation,
scheduling, execution gate or global lock is introduced by this change.

GET /api/v1/monitor/jobs retains monitor:job:list; GET /{id} retains
monitor:job:query; POST /export retains monitor:job:export. Anonymous and no-role
requests are denied before mapper access. Compatibility entities stay behind
explicit projection/export boundaries. JSON IDs remain strings across Java long
precision; missing and invalid identifiers use typed 404/400 ProblemDetail.

Paging, status, filter lengths, sorting and direction are validated. Sorting
uses fixed SQL columns and enums, followed by stable ID ordering. Search values
are mapper parameters. Export includes the full filtered sorted set regardless
of page size. All PageHelper state is cleared after success or SQL errors; SQL
failure details are not exposed to callers. Next execution is calculated by the
same actual Quartz Cron utility as the original task detail, including exhausted
expressions returning null.

Thirteen MVC tests cover original grants, projection/long IDs, invalid queries
and identifiers, full export access, filter binding and fixed ordering, missing
detail and SQL error sanitization/paging cleanup. The disposable real SQL/Quartz
fixture checks combined filters/sort-before-paging, actual detail/next time,
full sorted XLSX and anonymous/no-role denial.

Canonical task CRUD, scheduler/database consistency, task/Cron/log pages and
full capability acceptance remain pending. The execution-gated mutation proposal
is approval-pending after automatic review rejected its potential effect on task
dispatch latency/availability. See proposed-task-mutation-boundary.md. This read
API checkpoint does not narrow or complete the original full frontend objective.