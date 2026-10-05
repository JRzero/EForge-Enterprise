# Job-log viewer calendar boundary review

The enabled real browser regression selected 2026-10-06 in Asia/Shanghai while the
owned UTC JDBC database stored executions on 2026-10-05. The API rendered those
instants as October 6 in the browser but its raw SQL date filter returned no rows.
This was an actual filtering defect; changing the test to UTC dates would hide it.

Canonical job-log list and XLSX export now accept an optional validated IANA
`timeZone`. The page sends its viewer zone for both operations. The service binds
calendar start/end as `java.util.Date` instants through prepared MyBatis parameters;
JDBC maps them using the same configured calendar as stored execution timestamps.
Omitting the zone preserves the original SQL-calendar behavior and compatibility
endpoints. Invalid zones fail before SQL. Existing original list/export grants,
fixed sorting, pagination and generated OpenAPI client boundaries stay intact.
No scheduler, dispatch, task mutation or data-scope behavior is changed.

MVC tests verify Shanghai bounds, New York's 25-hour DST day, export filtering,
invalid-zone rejection and omitted-zone compatibility. Actual MySQL fixtures place
rows immediately before/at/after both calendar bounds and prove exact list IDs and
matching full XLSX selection despite pageSize=1. The real browser test explicitly
uses Asia/Shanghai and derives its range from the actual executions' displayed
calendar dates, avoiding a midnight-crossing assumption. The previously failing
real Quartz test now passes with all 43 browser cases and full runtime in each enabled/default-disabled configuration.

This is a job-log filtering checkpoint. Other modules' date filters and XLSX time
presentation still require the final shared calendar audit. Full task mutation
consistency, the pending rejected proposal's explicit approval, and remaining
original frontend capabilities are not accepted by this read/export repair.
Evidence: generator-configuration-calendar-* boot target logs, JobLogControllerTest,
verify-job-logs-integration.ps1 and web/tests/live/jobs.spec.ts. Exact-head cloud
acceptance is pending until its runs actually terminate successfully.
