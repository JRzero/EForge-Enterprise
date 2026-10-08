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
