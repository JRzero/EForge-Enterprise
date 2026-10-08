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

This is still a staged visual review. Expanded icon choices, grant trees,
payload/detail dialogs, upload/image-preview states and generated business-page
component states need a separate appearance review. Passing the functional
browser suite alone does not mark every component's appearance accepted.

Follow-up validation on 2026-10-08: final lint/typecheck and production build
passed; the full browser suite passed 174 checks after the desktop generator grid
change (`ui-layout-e2e-accepted.log`). Unit tests passed 125 and client generation
remained reproducible before that CSS-only final adjustment. The actual local
read-only audit passed 39 checks (`ui-layout-visual-final.log`); a subsequent Cron
capture additionally waited for actual execution-time preview and passed
(`ui-layout-cron-accepted.log`). Generator panel screenshots from the final
browser suite were reviewed independently from the actual-backend screenshots.
