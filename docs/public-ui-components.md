# Public UI and page templates

This application consumes the pinned EForge packages. `web/ui` is the product's
public presentation boundary; it does not copy their implementation or change
backend authorization. Business queries, permissions, drafts and persistence
remain in their existing owners.

## Entry points

| Entry | Components and intended use |
| --- | --- |
| `ui/controls` | Pinned EForge controls, with product Button/Input wrappers that forward props and refs |
| `ui/native` | Native input, button, select, textarea and table adapters; keep browser semantics and caller props |
| `ui/data` | Generic DataTable; preserves EForge columns, selection, sorting and pagination types |
| `ui/patterns` | EForge pattern components, including PermissionGate; frontend checks remain UX only |
| `ui/pages` | ListPage, ListFilters, ListToolbar, FormPage, PageForm, FormSection and FormActions |
| `ui/index` | Basic controls plus tags, feedback, pagination, column visibility, dialogs, uploads, file/image display, avatars, brand and icons |
| `ui/workspace` | EnterpriseShell, PageWorkspace, navigation, search/breadcrumbs, TagNavigation/TagMenu, header utilities and error boundaries |
| `ui/editors` | Rich text editor/safe content, password field, icon picker and SelectionTree |
| `ui/account` | AccountLayout, avatar, password field and password reminder |
| `ui/charts` | ChartCard with accessible legends/data/retry and AnimatedNumber with reduced-motion support |
| `ui/theme.css` | One CSS entry for the pinned dependencies and the application theme/layout/component rules |

Heavier editors/charts and the authenticated workspace have separate entry
points. The public FrontendLayout does not mount PageWorkspace, tag navigation,
authentication providers or an administrative API client. Compatibility exports
at old feature paths preserve existing imports; those files delegate to the
shared implementations. Cache monitor chart behavior remains a domain adapter
because it owns Redis command interaction and its tested keyboard tooltip rules.

## Reference and colors

Reference: spcore's list object model at `http://127.0.0.1:5173/model-app.html`,
customer management. Computed button styles were inspected on 2026-10-08:
primary `#2468f2`, primary text white, secondary text `#151b26`, border `#e8e9eb`.
The model canvas uses `#f5f7f9`. `ui/tokens.ts` records these defaults; existing
saved user themes continue to override the accent. Semantic status colors retain
spcore/Element's success/warning/danger/info meanings. The original EForge logo
is an application brand asset, not a third-party logo.

## Page composition

Use ListPage for the heading and white content panel, ListFilters for inline
labels/controls/search actions, ListToolbar for operations, DataTable for rows
and ListPagination for paging. The existing management lists use this structure.
Filter visibility, reset/query execution, columns and selection remain controlled
by each feature. FormPage reuses the page frame; PageForm forwards native form
props and refs, with optional FormActions. Labels use the shared desktop/mobile
alignment rules. Profile, account and resource forms use the shared form boundary.

ESLint prevents app/features/templates from importing controls directly from
the upstream presentation packages or introducing raw input/button/select/
textarea/table components. Native implementations stay inside the public layer.

The React generator's `vm/react/Page.tsx.vm` also imports these public entry
points. Generated CRUD/tree/sub pages keep the original API contracts and
permission checks while using the shared filters, toolbar, form and controls.

TagNavigation is controlled by items/activePath and callbacks. It provides
scrolling, keyboard navigation, pinned/current presentation, close controls and
workspace actions. TagMenu implements accessible menu movement and dismissal.
PageWorkspace retains cache, permissions, dirty-page confirmation and persistence;
the components do not duplicate those policies.

## Frontend layout without tags

Open `/frontend-template.html` (local preview:
`http://127.0.0.1:5174/frontend-template.html`). Source:
`web/templates/frontend-example.tsx`. The entry is included in the Vite production
build. FrontendLayout has a brand/header, controlled navigation, content and
footer; it supports a mobile menu, Escape/focus restoration and a skip link.
The example uses the same list/table and form templates with local sample data.
It makes no admin API requests and has no page-tag navigation. Replace the sample
state with the site's own authorized data source when building a real frontend.

## Verification status

Local frontend lint/typecheck/client reproducibility/build, 126 units and all
184 browser cases passed. Targeted template/profile/dashboard/navigation/
recovery browsers: 32 passed after the shared chart container width repair.
Maven test passed without repackaging the live preview jar. Both actual MySQL
case modes passed 122 generated CRUD/tree/sub SQL/Spring/HTTP assertions each.
Logs: `ui-public-components-maven.log`, `ui-public-components-browser.log`,
`ui-public-generator-native-0.log` and `ui-public-generator-native-1.log`.
The earlier mock browser failure exposed actual chart resize overflow; the
shared container now constrains its width, and the original assertion passes.
Source `a368d81` passed web `37797518603` (126 units, 184 browsers and build).
Server `37797518592` passed runtime integration and both complete framework
configurations, but its generated React verification failed ESLint: unused
NativeButton on every variant and Table on non-sub variants. This is a product
template defect, not an infrastructure failure. Removed the unused import and
made Table conditional on the subtable template. The four template tests and
all seven actual generated page/static-route variants then compiled and linted
locally against the captured Boot contract (`ui-public-generator-import-fix.log`,
`ui-public-generator-static-check.log`). The isolated static checker needed
compatibility-module bridges matching the host feature layout; missing bridges
were a checker fixture error and were corrected without changing product paths.
On `fe9d548`, all seven generated variants also passed cloud compilation/lint.
The subsequent production build failed because the newly declared HTML inputs
were relative to the launcher working directory. Vite inputs now resolve from
the config's file URL. The actual programmatic Vite build launched from the
repository root passed for both entries (`ui-public-root-build.log`). This is
a corrected build configuration defect; no assertion or browser behavior was
weakened. The generated-page browser fixture now imports `ui/theme.css` and the
public provider entries, matching the application's actual cascade including
list/form templates. Its original operation and boundary assertions remain.
Source `321e712` passed server `37801256465` (all four jobs) and web
`37801256483`. Local default/enabled generated deployments also passed with
identical installed OpenAPI hashes. That proves functional integration, but the
additional screenshot/size run found a real generated tree-list layout defect:
the legacy direct-div toolbar selector matched ListPage's entire body because
tree expand/collapse buttons are direct body children. It made the body a flex
toolbar and widened the document. The selector now targets `.list-toolbar`.
The same strict run then passed all seven generated variants at desktop/mobile
sizes and verified rich-text fields do not overlap following fields
(`ui-public-generated-appearance.log` before,
`ui-public-generated-appearance-after.log` after). Both local complete frontend
checks and 184 browsers passed after the selector repair.

Generated primary create actions now explicitly use the public primary Button
variant, matching the existing management pages. Generated browser checks always
verify the exact primary color, both viewport widths and editor non-overlap;
the screenshot flag controls image saving only. Final repaired cloud acceptance
remains pending. Superseded `f5f3cb1` workflows were cancelled deliberately after
the product-theme fixture update; cancellation is not a test pass.
Form builder remains deferred by the user.

## Final source acceptance — 2026-10-09

Exact product source `745a91ac8567fc4196d648bd22a8275cba7fc2e5` passed web
`37803938342` and all four server `37803938248` jobs. Direct logs:
`ui-public-cloud-745-web-accepted.log`,
`ui-public-cloud-745-server-accepted.log` and
`ui-public-cloud-745-verify-accepted.log`. Web checks passed lint/typecheck,
reproducible client, 126 units, production build with both HTML entries, and
184 browser cases. Default/enabled framework configurations each passed all
64 real browsers plus their complete API/MySQL/Redis/Quartz/ACL/OpenAPI checks.
Both installed generated React configurations passed all seven variants with
the public theme, exact primary color, viewport and rich-editor layout checks,
real CRUD/export/upload/retained-page behavior, permission withdrawal/logout
and mutation/export audit.

The final local generated deployment also passed the same strict checks
(`ui-public-generated-final.log`); 26 desktop/mobile list/editor captures in
`web/test-results/generated-appearance` were inspected. Its Java host reused
the existing preview jar because Java source is unchanged; fixture generation
used the current verified Maven classpath/resources. The cloud deployments
packaged the exact accepted source. Earlier unused imports, launcher-relative
entry paths and tree body/toolbar selector failures remain documented above.

| Requested capability | Delivered and verified |
| --- | --- |
| Public UI components | Control/data/pattern entry boundaries; tags, controlled tag strip/menu, common dialogs, pagination/columns, trees/icons, rich text, files/images, account widgets and charts; product imports and native controls checked by ESLint |
| spcore component colors/details | Actual reference palette, shared CSS entry, focus/disabled/error states, desktop/mobile gallery and page regressions; saved user accents remain supported |
| List/form page templates | Existing lists and forms, profile and standalone examples, plus actual generated CRUD/tree/sub and automatic/String-key variants |
| Layout without tag navigation | FrontendLayout and buildable `/frontend-template.html`, responsive navigation, no admin API requests, actual list/form interactions |
| Login and logo | Shared account frame, aligned CAPTCHA row with pointer/keyboard refresh, original SVG brand assets used in login/sidebar/favicon |

Local frontend preview at port 5174 reflects the accepted UI source. The running
backend jar still contains the earlier generator template: an attempted managed
backend refresh was rejected by automatic approval review before execution,
citing the running-app packaging constraint and interruption/old-jar overwrite
risk. No preview process, database or Redis container was changed. Activating
the new generator resource in that existing backend requires an explicitly
approved backend refresh; this does not invalidate the accepted source and
isolated/cloud deployment evidence above.

### Search-field layout correction (2026-10-09)

`ListFilters` now recursively expands React fragments before assigning layout
cells. Conditional dictionary type/date fields previously occupied one cell;
they now wrap independently like ordinary fields. Keys retain their fragment
ancestry. The search-scoped label alignment also overrides the older page-wide
stretch rule so date/status label text is vertically centered.

The dictionary browser regression reproduced the original 63 px vertical
misalignment before the fix. It now verifies control and label alignment,
wrapping/spacing and viewport bounds at 1920, 1280 and 390 px, plus reset.
All 15 related dictionary/log/component/front-template browser tests pass.
The frontend unit suite (126 tests) and generated-client reproducibility pass.
This change is confined to frontend layout; no backend service was restarted.

The shared pagination size/jump labels now use an explicit `pagination-field`
layout with separate text spans. Its alignment overrides the legacy form-label
stretch rule on list pages and also works outside the administrative shell.
Browser checks at 1920/1280/390 px verify text/control centers, spacing and
bounds, then change page size and submit a page jump. All 15 related dictionary,
log and standalone-template tests pass; screenshots are under the ignored
`web/test-results/pagination-layout` directory.

### Cross-page template acceptance (2026-10-09)

Source inventory confirms that all 16 ordinary list route entries use the
shared ListPage/ListFilters/ListToolbar layout and public DataTable surface:
users, roles, role users, departments, menus, posts, dictionary types/data,
configurations, notices, operation/login logs, online sessions, jobs/job logs
and generator tables. Paged lists also use the shared Pagination; department
and menu trees intentionally do not add pagination.

Native Table remains appropriate for three non-list structures: user-import
result reports, the editable generator field matrix and server memory property
comparison. Cache name/key lists and disk tables use DataTable within their
specialized monitoring layouts. These are not unconverted ordinary lists.

The new `list-template-audit.spec.ts` visits all 16 entries at 1440 and 390 px
with mocked empty data. It checks shared table mounting, no page errors,
search/toolbar label centers, one control per filter, pagination alignment and
viewport bounds, and saves 32 screenshots. Populated-state behavior remains
covered by each feature's existing browser tests. Screenshot review additionally
found the generator sort selector inheriting vertical form-label layout; the
shared toolbar now explicitly aligns label/control horizontally.

This is frontend template acceptance, not a new backend or generated-code
deployment acceptance. The previous local backend-refresh restriction remains.

Final local acceptance: all **202 browser tests** pass, including the 16-route
matrix and populated-state feature regressions. Lint, typecheck, generated-client
reproducibility, all **126 unit tests** and the final production build pass.
Evidence: ignored `web/template-acceptance-final.log`,
`web/template-acceptance-build.log`, and 32 route captures in
`web/test-results/template-acceptance-final/list-template-audit-*`.
The earlier full run was not accepted: two toolbar alignment assertions failed,
and three resource-loading cases overlapped the generated-client check writing
the watched API file. The final run used the corrected CSS specificity and ran
without concurrent generation or source changes; all 202 passed without retries.

### Compact list presentation (2026-10-09)

Per the subsequent UI request, ListPage now omits its visible title/description
block by default. A visually hidden heading preserves assistive navigation;
breadcrumbs and workspace tabs still identify the page. FormPage explicitly
retains its form heading via `showHeader`.

Search field labels drop the redundant Chinese suffix “筛选”. Both EForge Input
and native select/date fields use the same 80 px right-aligned label column,
8 px gap and 160 px desktop control column; mobile retains the label width and
lets controls fill the available space. The 16-route audit now asserts the
absent visible header, simplified field text and exact label-column width.
Search-related tests scope their field lookup to the search form so identically
named editor fields and column-visibility checkboxes remain unambiguous.

Validation for this change: lint/typecheck, 126 unit tests and production build
pass. The full 202-case browser run passed 200; two tests still clicked the
removed visible title to dismiss popovers. Those interactions now click the
list's blank padding instead, and all 19 navigation/user tests passed on rerun
without product-code changes. The 16-route layout matrix passed with 80 px
label columns on desktop/mobile. Logs: `web/list-labels-final.log` and
`web/list-labels-clicks.log`. Live-test selectors were updated but the live
backend suite was not rerun for this presentation-only change.

### Search action placement (2026-10-09)

Compared the spcore model-app `schema.js` inline filter with its paired primary
submit and secondary reset actions. The product keeps that compact pair, with
an intentional adaptation for multi-row enterprise filters: the group aligns
to the right of the final filter row instead of immediately following the last
field. At mobile width it occupies its own right-aligned row, 12 px below the
fields. Actions never split internally; button spacing remains 8 px.
All 16 route checks assert the right edge and mobile row separation; the related
browser run passed 20 tests (`web/search-actions.log`). Role desktop/mobile
captures were inspected. Lint/typecheck and production build pass.

### spcore palette and typography (2026-10-09)

Measured the running spcore model-app customer list and checked its source.
The default sidebar now uses white, inactive text #616c79, selected background
#eaf3fc and selected text #2174cc (14 px, weight 600). Primary buttons remain
#2468f2 at 14 px. Search labels use #5c5f66 at 14 px; table headers use #151b26
at 14 px/400 on #f7f8fa, with body cells at 12 px/400 and #e8e9eb separators.
These overrides live in the shared `web/ui/spcore-theme.css` entry.
Existing saved appearance preferences are preserved, and custom primary colors
also continue to affect selected menu text/background. The default is light;
users with a saved dark sidebar can explicitly change it in layout settings.

Validation: 126 unit tests passed; final lint, typecheck and production build
passed. The 16-route desktop/mobile layout matrix and standalone template passed
in the initial targeted run. Two obsolete navigation expectations (dark default
and selected-menu left border) were updated; the final navigation/theme run
passed all 19 tests, including exact reference colors/font sizes and custom
theme persistence (`web/spcore-colors-final.log`). Populated desktop, focus,
dialog and mobile screenshots were inspected. No backend code changed or
backend service was restarted for this presentation change.

### Buttons and status tags (2026-10-09)

The shared theme now follows the reference project's installed AMIS cxd button
and Tag tokens: desktop buttons are 32 px minimum, 14 px/400, 4 px radius and
4/12 px padding. Primary hover/active are #528eff/#144bcc; secondary hover stays
white with blue text/border. Disabled buttons use #f7f8fa and #b8babf without
opacity stacking. Text actions stay transparent; current-page highlighting and
40 px mobile touch targets are retained. Custom themes derive their own states.
Existing secondary-variant form submit buttons also receive primary states.

Public Tag and DictionaryTag share 24 px height, 12 px/400 text, square corners,
no border and solid reference status fills: blue, green #30bf13, orange #ff9326,
red #f23d3d and gray #b8babf with white text. Status labels remain visible.
Validation includes 126 unit tests, lint/typecheck and production build, 18
navigation tests and the final two desktop/mobile theme/template browser tests.
The theme test exercises hover, pressed, disabled and real dictionary-tag CSS;
desktop capture was visually checked. Initial sandbox file access failures were
rerun with normal local permissions; missing test dictionary data was supplied.
Evidence: `web/button-tag-theme-accepted.log`, `web/button-tag-build.log`.

### Component detail review (2026-10-09)

Replaced font-dependent tag-strip arrows and close glyphs with centered SVGs.
Desktop strip controls/tabs share 28 px height; mobile controls/tabs are 36 px.
Dropdown expanded/hover/disabled states, close-button feedback and menu rows now
use the shared palette. The dropdown declares a menu popup. Escape restores the
actual opener (dropdown button or context-menu tag), falling back to the active
tag only when that opener is gone.

Scoped compact header icon buttons and table row actions so the general button
padding no longer enlarges them. Pagination controls share a height, and the
current page keeps its selected contrast on hover. Existing form alignment,
custom theme settings and mobile table scrolling remain intact.

The initial 42-case browser audit passed 41, including all 16 list routes in
desktop/mobile and navigation/template/workspace checks. Its new focus-return
assertion exposed the opener bug; after fixing it, all seven theme/workspace
cases passed. Desktop dropdown and mobile captures were visually reviewed.
126 unit tests passed, as did lint/typecheck and production build. Evidence:
`web/component-detail-audit.log`, `web/component-detail-final.log`, and
`web/component-detail-build.log`. Backend services were not changed.
