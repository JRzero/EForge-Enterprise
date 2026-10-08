# spcore visual alignment

Reference: user-selected chat `01a11683-7247-7cc3-9555-ca7dea1a9b4a`, project
`D:/Projects/spcore/spcore.nebula.mgt`, original AMIS preview and Element Plus
shell. This is a visual adaptation using the pinned EForge components, not an
AMIS/Vue migration or an upstream dependency change.

## Visual contract

- Blue primary actions, neutral gray canvas, white panels, thin separators and
  4px control corners. Semantic success/warning/error colors remain distinct.
- Input containers own borders and focus indication. Their inner inputs have no
  independent outline or border. Default height is 36px, horizontal padding 12px;
  small and mini preferences retain their 13px/12px type sizes.
- Error and disabled fields keep distinct states. Native select, number,
  pagination and checkbox controls retain native keyboard behavior.
- Form labels align left. Submit actions and explicit add actions have primary
  styling; other actions do not become primary based on their DOM position.
- Shared list, table, pagination, dialog, profile, dashboard and monitoring
  surfaces use the same product-owned theme. Tables scroll within their container
  on narrow screens; modal controls remain reachable.
- Existing saved theme/sidebar/density choices are retained. Fresh settings use
  blue with the original dark sidebar; the light sidebar option remains available.

`web/app/enterprise-theme.css` owns the visual tokens and EForge rendered-control
adaptation; `styles.css` retains feature layout and uses the shared tokens.
No backend endpoint, authorization, API schema, session or draft behavior changes.
The form builder remains deferred.

## Validation

2026-10-08: lint, typecheck, 125 unit tests, production build and generated-client
reproducibility passed. The full mocked browser suite passed 173 tests. After the
final label/control-width adjustment, all 19 theme/navigation browser checks and
the production build passed again; desktop/dialog/mobile screenshots were reviewed.

The browser regression includes a new desktop/mobile list and dialog check and
an input focus regression for the reported inset double-blue outline. Screenshots
are emitted under `web/test-results/fixtures/ui-theme-*`. Existing navigation
tests continue to assert saved theme, density, keyboard behavior and draft
preservation. The invalid-preference fallback assertion now expects the new blue.

The live development login was visually inspected at `127.0.0.1:5174`; the
container focus border and 12px inset were checked directly. Backend services and
local database data are unchanged. Full backend rebuild/integration is not part
of this presentation-only change.

## Layout and component detail follow-up

The follow-up uses the reference's actual sidebar, Navbar, TagsView and generator
form styles: 200px/54px sidebar widths, 50px header, 35px tag strip, 16px sidebar
icons, compact header actions, thin table separators and two-column generator
configuration on desktop. Phone layouts retain a single column and local table
scrolling. EForge public components remain the pinned dependencies.

`workspace-layout.css` owns these proportions. Application controls use a 32px
default, 30px small and 28px mini minimum; the login retains its 36px minimum.
Both retain the 12px horizontal input inset and a single container focus border.
Job and generator dialog footers now group their actions; rich-text toolbar,
editor borders and text inset use the shared palette. Account display-name
refresh, draft protection and keyboard labels retain their original contracts.

The opt-in `playwright.visual.config.ts` audits the already running local preview
using a dedicated, short-lived session supplied by the caller. It emits no traces
or videos containing that session and does not create fixture tables or submit
business writes. The caller logs out afterwards. Its 39 checks cover 23 pages,
12 editor/import/avatar dialogs, all three navigation modes and the seven Cron
tabs. Desktop/390px screenshots are available under `web/test-results/visual`.
Actual default console pages are disabled; these screenshots do not prove an
enabled embedded console's internal appearance.

Generator metadata is empty in the local preview, so its three populated editor
panels are additionally captured with explicit browser fixtures. That check
asserts zero writes and covers desktop/phone widths. Screenshots distinguish
fixture evidence from actual local-backend evidence.

This is still a staged visual review. Passing the functional browser suite alone
does not mark every component's appearance accepted. The component detail review
below extends the first pass; remaining families are recorded explicitly.

Follow-up validation on 2026-10-08: final lint/typecheck and production build
passed; the full browser suite passed 174 checks after the desktop generator grid
change (`ui-layout-e2e-accepted.log`). Unit tests passed 125 and client generation
remained reproducible before that CSS-only final adjustment. The actual local
read-only audit passed 39 checks (`ui-layout-visual-final.log`); a subsequent Cron
capture additionally waited for actual execution-time preview and passed
(`ui-layout-cron-accepted.log`). Generator panel screenshots from the final
browser suite were reviewed independently from the actual-backend screenshots.

## Expanded component review

Desktop editors now place field labels beside their controls. User editing uses
two columns at 992px and above, with the note and action row spanning both;
phones retain vertical fields. Native checkbox/radio labels remain inline.
The reference's icon picker uses three compact columns and a 200px scroll area;
the local picker follows those proportions and retains all icons and keyboard
selection. Grant rows use compact tree spacing and a separate toolbar border.
Log metadata and JSON panes use restrained separators and a monospace scroll
area. Upload entries have thin 4px borders; image-preview controls retain the
dark viewing canvas with a readable white title. Field error/warning/success
messages appear in normal flow below the input without an attached color block.

| Component family | Evidence reviewed | Current state |
| --- | --- | --- |
| Menus, breadcrumb, compact header, tags and three navigation modes | Actual local desktop screenshots and navigation regressions | Reviewed |
| System lists, filters, trees, tables, paging and standard dialogs | Actual local 23-page/12-dialog audit | Reviewed |
| Input inset/focus, disabled/error fields and button variants | Actual shared-component gallery, visible-message geometry assertion | Reviewed |
| Icon picker and column visibility popover | Expanded actual menu editor plus gallery desktop/phone | Reviewed |
| Menu and department grant trees, including mixed selection | Actual role dialogs; gallery mixed state and existing keyboard/payload tests | Reviewed |
| Log metadata, formatted JSON and copy controls | Actual expanded log dialog plus existing copy/permissions tests | Reviewed |
| Files and image preview | Shared gallery plus installed generated pages against disposable real SQL/files; ordering, upload recovery, focus restoration and phone bounds | Reviewed |
| Generator editor basic/fields/output tabs | Populated browser fixtures and local empty-state page | Reviewed in fixture |
| Rich editor, Cron and profile/avatar controls | Actual local dialogs and existing formatting/upload/keyboard tests | Reviewed |
| Login/registration/lock and alternate dashboard views | Desktop/390px appearance captures, focus/error geometry and original authentication/dashboard regressions | Reviewed |
| Generated business CRUD/tree/subtable page instances | Seven installed page categories; actual desktop/phone lists and CRUD/tree/sub editor upper/lower screenshots, real HTTP/SQL regression | Reviewed |

2026-10-08 expanded evidence: `ui-component-real-audit.log` passed 44 actual
local checks. After final password layout and label adjustments, the six relevant
expanded/user-editor checks passed again (`ui-component-real-final.log`).
The full mocked suite passed 175 (`ui-component-detail-final.log`), with 125 unit
tests, lint/typecheck, build and generated-client reproducibility. Final image
title, native label and field-message adjustments passed all 23 existing affected
checks, then the shared appearance check passed separately after distinguishing
the visible status from its intentionally duplicated screen-reader live-region
text. Its final screenshots are under `web/test-results/appearance-final`.

An earlier 21-check attempt was interrupted while the gallery's style imports
were being added: traces show Vite reconnecting during the run and disappearing
dialogs. The frozen-source full run subsequently passed. The last status test's
strict-locator failure was a fixture selector problem; both visible and live
region text matched, and the production announcement behavior was retained.
No backend source, authorization, sessions, business rows or DDL changed.

## Account and dashboard appearance

Login and registration now share a centered white 400px panel following the
reference login's proportions, with 40px controls, 25px panel padding and a 6px
corner. The backdrop is owned CSS, rather than a copied reference image. Lock
retains its existing background and authentication behavior with compact panel,
input and button proportions. Mobile fields remain inside the viewport; inner
inputs do not introduce a second focus outline. Visible registration errors use
the same red text as login validation.

Dashboard cards use restrained 4px corners and borders. Appearance review found
default chart legends overlapping weekday labels; line and stacked-bar legends
now explicitly occupy the top. Long radar labels wrap without changing their
data. Accessible legend controls, animations and complete data tables remain.

2026-10-08 validation: lint/typecheck, reproducible client, 125 unit tests and
production build passed; the full mocked browser suite passed 179. Final
legend/radar-only adjustments then passed lint/typecheck and all three dashboard
browser checks. Reviewed final chart captures are in
`web/test-results/dashboard-final`; account/lock captures are in
`web/test-results/fixtures`. These account appearance tests use explicit fixtures
and are not evidence of a new real-backend registration. Generated business
page-instance appearance remains pending; no backend source changed.

## Installed generated page acceptance

The seven categories (`crud`, `tree`, `sub`, `auto`, `autotree`, `autosub`,
`stringkey`) were actually generated, compiled, installed and run in a separately
owned Boot/MySQL/Redis environment. The browser entry now loads the complete host
theme/layout CSS. Opt-in captures wait for the current page heading, cover desktop
and 390px lists, and include both upper and lower scroll positions for the three
representative editors. Final images are retained in
`web/test-results/generated-final`, with the terminal success log in
`ui-generated-final-runtime.log`.

This revealed missing native date/text borders, cramped phone labels and a rich
editor whose percentage height overlapped later fields. Generated filters,
toolbar, labels, native date/text/file controls and action rows now use the host
proportions. Radio/checkbox groups remain inline. Wide child tables scroll within
their own section; upload/editor columns have enough space for their controls.
Rich editors use natural height and a single focused container border. Actual
browser geometry asserts that the editor ends before the next generated field.

The final focused runtime passed actual CRUD/tree/sub mutation/detail/search,
automatic and String-key CRUD, pointer/keyboard file ordering, upload retry and
history retention, gallery controls, exact Long/decimal/date values, paging,
XLSX, parent/child cleanup, original permission withdrawal, logout and SQL audit.
The temporary runtime owns and cleans its fixtures; the user preview database
and service were not used for these writes. Backend product source and generated
templates were unchanged. The temporary worktree was archived after retaining
evidence.

Final lint/typecheck and build passed. The full frontend suite passed 179, unit
tests passed 125 and client reproduction passed before the final rich-editor and
child-column-only adjustments; all 17 affected rich-editor/notice/generator
checks and the complete actual generated-page runtime then passed. One earlier
focused runtime timed out during the first cold OpenAPI request while broad
frontend work ran concurrently; sequential retries succeeded. It is recorded as
a failed verification attempt, not silently counted as a pass.

Product UI implementation `011b30e80bb40198ae99ac311345f2e49a7910cf` is pushed.
Its exact `web-ci` run `37778837048` and `server-ci` run `37778836912` are still
pending final cloud acceptance at the time of this entry. Local visual review
is complete for the families above; pending cloud checks are not reported as
successful. Form builder remains explicitly deferred.

Cloud follow-up: product UI `011b30e` web run `37778837048` completed
successfully. The final opt-in capture wait and evidence commit
`3858f84c1d80b7417285cbfd4cf95ed0adb40d03` has exact runs web `37779845297`
and server `37779845337`; both remain in progress. Its local focused runtime
(`ui-generated-final-runtime.log`) is terminal success and all 26 final captures
are preserved. The dedicated worktree is confirmed archived. Final cloud
acceptance is the only outstanding verification; no UI family in the table
remains unreviewed.
