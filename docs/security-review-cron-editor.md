# Cron editor review

Scope: a reusable feature-local React editor plus task read-page tool and task
read-detail expression handoff. Confirmation returns text to the caller and
read-page output; it does not change a task or schedule. Integration into the
future task create/edit forms remains required. Neither approval-rejected task
mutation boundary is implemented or bypassed.

Behavior reference is the original Crontab index/day/week/year/result and other
field components at the immutable frontend baseline 0e2d75c. The React model and
editor are independently implemented; the pinned EForge dependency is consumed.
All seven fields preserve every/range/interval/specified values, optional years,
day/week exclusion and W/L/# special dates. Raw named or advanced Quartz fields
remain intact until explicitly edited. Manual text can be refilled; reset uses
the original '* * * * * ?'. Calendar computation uses the existing canonical
Quartz API rather than a second browser implementation. Five next instants and
the authoritative server timezone are displayed; exhausted but valid expressions
remain confirmable. Numeric/list failures disable confirmation.

Preview uses the generated function and existing bearer/omit/no-store transport.
Backend add/edit/query grants remain authoritative. The read-page tool and detail
handoff use the original query grant; list-only readers cannot see the tool.
Future add/edit dialogs can use their original grants with the same component.
No JWT is placed in URLs. Expression text is URL-encoded data, bounded to 255
characters and rendered as text. No HTML or database-driven component lookup.

Debounced requests cancel on edits/unmount. Changing raw whitespace still
revalidates the normalized expression. Only a successful result for the current
normalized expression can enable confirmation; old responses are ignored. Error,
retry, pending, exhausted and invalid states are distinct. Cancel remains usable
while preview is pending. Original text and the saved task remain unaffected by
cancel; the calling tool/row button regains focus after closing either entry path.
Tabs support ArrowLeft/Right/Home/End and labelled panels; controls are labelled,
long selections scroll, and the modal remains within a mobile viewport.

Four model tests cover preservation of named/advanced syntax, day/week exclusion,
empty/bounded integer inputs, wraparound week ranges, expired/omitted years and
sorted distinct selections. Three fixture browsers cover all field mode groups,
raw refill/detail handoff/reset/cancel, invalid numbers, timezone rendering,
failed/retried/stale previews, normalized-input revalidation, current-expression
confirmation, focus/mobile/keyboard and list-only tool denial. Actual Quartz
browser tests compare special-date previews to protected API instants, check
invalid/exhausted expressions, explicit date-mode edits and unchanged persisted
task read fields. The no-role account additionally verifies real preview denial.

Review under the React best-practices checklist checks component-local state,
feature-local abstraction, cancellation cleanup, stable generated API functions,
text rendering, labelled keyboard controls and no extra client date calculator.
Final command counts, live OpenAPI equality and exact-head cloud acceptance belong
in the parity inventory; component existence is not task-module completion.
