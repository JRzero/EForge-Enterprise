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
Exact cloud real integration/generated React browser acceptance remains pending.
Form builder remains deferred by the user.
