# Task read and task-log page review

Scope: the original task route now has a read/detail/export page and an internal
/job/log/:jobId route implements the original task-log UI. Task create/edit/
status/run/delete, Cron editing and full scheduler/SQL consistency remain
pending; this is not complete task management.

The task menu retains its original stable monitor-jobs identity and list grant.
Migration V023 binds only that existing ROUTE to an actual React page. Logs are
an internal child route; no GROUP becomes a fake React route. Specific task IDs
load the query-protected canonical task detail before applying name/group log
filters. A failed context lookup does not issue an unfiltered log query. ID 0
opens all logs; closing returns to the implemented task page.

The frontend uses generated task/log API functions through the existing
credential-free bearer transport. Original monitor:job list/query/remove/export
grants control UX; server authorization remains authoritative. Logs preserve
name/group/status/date filtering, time ordering, paging, selection, detail and
exception text, deletion/clear confirmation and filtered sorted XLSX. Canonical
clear keeps the identity sequence. Task reads retain filters, ID/name/time
ordering, detail, XLSX and task-specific/all-log entry points. These reads do
not change task schedules.

Task targets, remarks, messages and exception text are rendered as React text.
No HTML insertion, executable link or database-driven component lookup is used.
Dictionary group/status labels use shared safe tag/options components. List,
context and detail requests cancel on navigation; action responses are ignored
after abort. Confirmed mutations retain captured IDs and retry failures without
closing the dialog. Deleting the last page returns to the current valid page.

Fixture browsers cover read-only grants, route denial, HTML-like text,
custom group labels, list/context/detail faults, no unfiltered context fallback,
calendar validation, actual request ordering/export filters, exact large IDs,
mutation retries, confirmation cancellation, page recovery and mobile bounds.
Real browsers use twelve owned paused compatibility tasks in the disposable
backend, actual success/failure Quartz dispatch and canonical logs. They check
task/log detail, stored normalized text, sorted full XLSX, date/group/status
filters, task context/close, paging deletion, clear and actual no-role denial.
Legacy fixture setup calls the owned backend directly; the product still calls
canonical endpoints only. Exact navigation assertions include the new task leaf.

The React checklist review verifies lazy route loading, stable generated-client
queries, abort cleanup, component-local state, labeled controls/dialogs, keyboard
cancel/focus and inert text. Full runtime/frontend/backend and exact-head cloud
results are tracked in the parity inventory rather than inferred from components.
The approval-pending mutation boundary in proposed-task-mutation-boundary.md is
not implemented by this UI change; neither rejected runtime patch exists.