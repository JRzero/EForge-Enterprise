# Original shared consumers — 2026-10-08

Reference: immutable frontend behavior commit
`0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0` (v3.9.2).
The complete official archive was inspected under ignored
`server/eforge-boot/target/original-frontend-0e2d75c/`. It is reference evidence,
not imported Vue application code; neither upstream baseline changed.

This audit follows actual imports, global registration in `src/main.js`,
directive registration and page consumers. A source-path assignment alone is
not acceptance. Existing exact-source verification at
`2a20eb3726b75ec663588ac10e4a42281052ed3e` is server37683623514 (four successful
jobs) and web37683623639. The table identifies the evidence relevant to each
consumer; it does not declare all utility exports independently reproduced.

| Original shared capability | Current actual consumer and scoped proof |
| --- | --- |
| Breadcrumb, ParentView, Hamburger | EnterpriseShell/navigation-model/NavigationTools; navigation-tools mocked and live cases cover literal route/query ancestry, GROUP without fake routes, disclosures, mobile focus trap and original991 breakpoint |
| HeaderSearch | NavigationTools and navigation-tools cases: title/path search, original nested paths, Unicode matching, literal highlights, empty/clear, arrow/Enter/Escape, safe external windows and focus restoration |
| TopNav | TopNavigation and navigation-tools cases: top/mixed/sidebar modes, group selection without navigation, retained page drafts, real child ancestry, overflowing groups and mobile fallback |
| Screenfull, SizeSelect, ThemePicker | HeaderUtilities/layout-preferences/EnterpriseShell; actual fullscreen API, density computed fonts, theme/side theme, storage failure, settings save/reset and draft retention in mocked/live navigation-tools |
| RuoYi Doc/Git | HeaderUtilities preserves reference-document and repository-window actions with no opener. Product repository is EForge Enterprise; reference docs currently point to the official documentation root rather than the original Vue-specific path. This URL adaptation is explicit, not an identical-URL claim |
| SvgIcon, IconSelect | Pinned attributed static icon assets and local allowlist; menu editor search/selection and sidebar/browser rendering. See ADR-0014 and menu/navigation metadata reviews; database strings never resolve React components |
| RightToolbar | Actual list refresh/filter visibility and ColumnVisibilityMenu. Nine consumers have independent all/partial selection with native indeterminate and unrelated key preservation; see column-selection review and real users regression |
| DictData, DictTag | useDictionary/DictionaryTag/dictionary-values and real configuration/user/role/generated controls. Typed values, actual Redis invalidation, fault/no-role behavior, original styles and exact value handling; dictionary and generated boolean-dictionary reviews |
| Editor | Actual notice editor and generated textarea/rich content consumers; real safe images, retained selection/owned pending upload, inert display and SQL persistence. Rich-text/notices/cached-upload and generated-control reviews |
| FileUpload, ImageUpload | Actual generated root/subtable editors: editable preview/file windows, one duplicate item deletion, pointer/keyboard sorting persisted in SQL, strict original count/size limits, mixed HTTP success/failure and no-opener. Generated-upload-controls review and both seven-family cloud runs |
| ImagePreview | Shared gallery in actual generated CRUD/tree/sub detail/list/editor/child contexts: original gallery, first thumbnail, keyboard/wheel/rotation/zoom/mask/close, image failure, nested focus and mobile bounds. Image-preview fidelity review and installed generated browser evidence |
| Pagination | Thirteen framework consumers and generated CRUD/sub lists: numbered/jump/10/20/30/scroll, actual SQL paging, successful count shrink, failed-read retry distinction and retained filters. Pagination-fidelity and pagination-shrink reviews; both live post sessions in both cloud profiles |
| iFrame and original inner-link hosts | Typed owned embedded routes and original Druid/Swagger consoles. Actual enabled HTML/assets/schema/authentication/cookie chain, default-disabled configuration, logout/withdrawal/expiry, safe URL policy and viewport. Console/navigation/page-tabs reviews and live suites |
| dialog drag/width/corner directives | ResourceDialog/useDialogGeometry in actual native editors, selection and alert dialogs; pointer/keyboard, busy boundaries, independent retained captions, viewport and focus ownership. Dialog-geometry review and installed generated/browser cases |
| clipboard directive | Actual operation log JSON formatter/copy consumer; literal hostile data, browser clipboard success/failure and no evaluation. Logs review and mocked/live logs cases |
| hasPermi/hasRole and auth plugin consumers | Server-authoritative bootstrap/routes/permission gates; original role directive has an actual generator-create consumer, retained there with original backend admin-role authority. Menu, generator-create and no-role/grant/withdrawal API/browser checks. No unsupported global Vue plugin surface is claimed |
| tab plugin and TagsView/ScrollPane | Actual PageWorkspace/app router: refresh/close/other/left/right/all, affinity/scroll, cache instance ownership, interrupted read cancellation, remembered user identity, query defaults and safe iframe retention; page-tabs mocked/live and original shell reviews |
| request/download/auth/cache/modal utilities | Typed generated API transport, canonical export consumers, session and owned pending-write state. HTTP error before blob, exact XLSX, logout/revocation, CAPTCHA, retry, bounded owned confirmations and storage/cache isolation are covered at actual consumers; legacy object contracts stay behind adapters |
| parseTime/date range/tree/dictionary utility consumers | Canonical calendar/zone query contracts, local formatters, literal dictionary projection and typed department/menu tree composition. Actual UTC/Shanghai/NewYork DST boundaries and XLSX agreement, exact long IDs, cycle/root/permission constraints are covered by calendar, XLSX, hierarchy and metadata reviews. Unsafe prototype-recursive legacy helper copying is not required or performed |
| Crontab seven fields/results | CronEditor and task read/detail tool: actual Quartz special/exhausted expression preview, named fields, original reset/cancel/confirmation, stale/invalid response refusal and focus. Actual task create/edit forms now integrate the editor, including independent add-only access without a query grant; final task-management acceptance is tracked separately |

## Unconsumed source is retained, not falsely implemented

`components/PanThumb/index.vue` is a standalone slot-based hover thumbnail.
Whole original `src` search found no import, registration or template consumer;
all `PanThumb`/`pan-thumb` occurrences are inside that component. `main.js`
registers its shared business components explicitly and does not register
PanThumb. Its exact original file SHA256 is
`6E07BF04C9F820B5465EC899D428F5E6DD0622731B32B7968A8A800D58E61082`.
The inventory entry is retained as unconsumed-original-source, not an implemented
avatar/gallery claim and not evidence for header/profile behavior. Header and
profile have their own actual image upload/fallback/refresh proofs.

Online form builder stays explicitly user-deferred, including its original
source inventory. Task add/update/delete/status/run now have implementation in
progress, but their canonical contracts/forms still await final acceptance.
The user explicitly approved the narrower execution-gated runtime proposal on
2026-10-08; its foundation is accepted at exact `fb7c7b12de8e157942d5132e79c7eac134d23f82`,
server `37705061672` (four successful jobs). The abandoned scheduler-wide rebuild
remains excluded. See task-mutation-boundary and task-writes-v1 security reviews.
This audit does not make the whole objective complete, does not waive the final
requirement-by-requirement audit, and does not treat test counts as a completion
percentage.

## Final current-scope acceptance — 2026-10-08

Product source d2e051955ff040896b76ed458e9da9cadedce766 is accepted at exact server37712204477 (all four jobs terminal SUCCESS) and web37712204380 (SUCCESS). Direct task-management-cloud-server/web-accepted.log proves690 backend declarations including10 data-scope cases (one existing platform skip), actual MySQL task boundary modes0/1 each35,107 frontend units,147 mocked browsers, default and enabled configurations each64 real framework browsers/fullAPI, and both configurations of all seven installed generated families (CRUD/tree/sub, auto/autotree/autosub, String-key). Both live OpenAPI snapshots match the committed/generated contract at7FE11E39D73C1CA0C58C5E4B9F49DE073DD621CF50126A173FC7752E7D9B914E. The first observer ended with GitHub unexpected EOF; authoritative success and downloaded logs establish acceptance, not that observer's exit code. No product failure occurred in this final source's cloud runs.

The final original-consumer review combines the existing capability table and original-shared-consumer-audit with direct pinned task-page review and actual task-management/browser/SQL evidence. All19 original API modules now account for119 accepted operations and zero pending;175 original source paths remain inventoried. File assignment and counts alone are not the acceptance criterion: original grants, full task configuration/Cron, bulk/single actions, literal target delivery, actual manual/automatic execution, transaction recovery, SQL fault/audit privacy, large identities/XLSX and add-only access have direct consumer proofs. Existing shell/shared, calendar/timezone/XLSX, generator output and seven installed generated families are re-exercised by the final source's complete cloud suites. PanThumb remains an unconsumed original component, not a fabricated implemented feature. The online form builder remains explicitly user-deferred and is neither developed nor marked complete. Baselines and architecture remain unchanged; only the approved affected-task runtime boundary was implemented, never the abandoned global scheduler rebuild.

Current requested scope is complete and automatic development can stop. Historical pending checkpoints above remain chronology, not current blockers. This evidence does not promise mathematically bug-free operation, exactly-once scheduling, rollback after uncertain commit, completion of the deferred builder, or identical standalone Vue helper APIs. The user's finish-then-pause instruction applies now.