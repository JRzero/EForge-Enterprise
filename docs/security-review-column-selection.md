# Shared column selection parity

The fixed original frontend0e2d75c RightToolbar/index.vue includes a master
checkbox, all/none toggle and native indeterminate state when only some columns
are visible. The existing React page menus provided individual selection only.
column-all-before.log reproduces that actual missing behavior on the users page.

ColumnVisibilityMenu now implements the master and existing individual choices
in nine actual consumers: users, roles, posts, dictionary types/data,
configuration, notices, operation/login logs, task/task-log reads and generator.
Each consumer supplies its existing label/key set, visibility state and setter.
Only supplied keys change; selection/action columns and unrelated keys remain.
Literal labels stay React text. No server request, authorization, business row,
filter, paging, selected row, write or persistence behavior changes. Original
menu labels remain; all-hidden is allowed and recoverable through the menu.

The actual user table before/after browser regression covers initially all,
individual hidden column, native mixed state, master restore, all hidden and
restore with exact long identity and read-only permission controls intact.
column-all-focused-fixed.log passes. Real user CRUD/export now includes the
same controls before binary workbook verification. Complete frontend and
actual MySQL/Redis/API regression are running; their results and exact new source
cloud must be accepted independently before this stage is complete.

This consumes pinned EForge table visibility; it does not copy dependency source
or introduce a configurable low-code component registry. Generated tables use
their existing pinned table controls and are not replaced by this page menu.
Specific task mutations remain approval-gated; form builder remains deferred.
Full project completion is not claimed.

Local39021 terminated0:6 real users browsers with all/partial/hide/restore, original CRUD/assignments/status/password/import/export and full API regression passed.98 units/142 mocks/repro/lint/type/build also pass. Contract remains exact CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C. Parent-owned fixtures/processes cleaned; no new local Maven claimed for unchanged Java. Exact source cloud remains required.
