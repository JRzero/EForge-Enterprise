# Canonical generator read API review

Scope: imported table list, database table discovery, imported configuration/detail
and fields under /api/v1/tool/generator. Import/create/edit/delete/sync/preview/
archive/custom-output APIs, React/EForge generation and generator UI remain
required. This read checkpoint does not complete the generator module or parity.

Original tool:gen:list controls both lists and the field endpoint; tool:gen:query
controls detailed configuration and all imported-table choices. Actual server
method security is authoritative. Anonymous/no-role requests are denied. No
compatibility BaseEntity, AjaxResult, TableDataInfo or raw options JSON is exposed.
Explicit records retain Java/database/control/dictionary types, all field flags,
layout/output/author/subtable configuration, tree/menu/detail options and dates.
Long IDs, including nested parent/column IDs, are projected as strings.

The unchanged attributed RuoYi mappers stay behind the projection boundary.
Discovery keeps the original current-schema, Quartz/generator-prefix and imported
table exclusions. Name/comment and inclusive date filters remain bound values;
validated page bounds, enum-selected SQL order and fixed tie fields precede
paging. Invalid IDs/dates/enum/lengths do not query SQL. PageHelper state clears
on success and failures. Detail and field reads use read-only transactions.
Options use an explicit six-field projection, retain root/long menu identity and
genView, ignore unrelated stored keys and report malformed stored JSON without
publishing its contents. Missing imported resources return typed 404.

Seventeen new MVC cases cover exact IDs, full configuration and field flags,
original split grants, both list shapes, parameter binding/fixed ordering,
calendar and paging guards, missing resources, malformed options, SQL sanitization
and pagination cleanup. The disposable parent runtime creates only three uniquely
named physical tables and two owned metadata rows/fields. It verifies actual
information_schema/import exclusion, combined filters/order before page/date,
configuration/column ownership and choices, injection-as-data, anonymous/no-role
refusal, malformed stored options and recoverable SQL failure without metadata
loss. Only that owned schema and fixture are changed; cleanup drops owned names.

New read endpoints do not execute DDL, write metadata or output files, invoke
Velocity or choose a frontend template. Existing legacy generator behavior is
unchanged. Generated TypeScript comes from the live canonical contract. Full
regression counts and exact-head cloud results are recorded in the parity inventory
only after verification; template, page and end-to-end generation gates remain.
