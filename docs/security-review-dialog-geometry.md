# Shared native dialog movement and resizing

Fixed RuoYi frontend0e2d75c registers dialogDrag, dialogDragWidth and
dialogDragHeight. They support header movement, right-edge width and corner
width/height resizing. The inventory contained these facilities but the existing
native ResourceDialog implemented only modal focus/Escape/backdrop ownership.
This is an independently discovered missing shared capability, not task-runtime
work and not deferred form-builder work.

ResourceDialog now supplies header-pointer movement and three keyboard-capable
controls. Width and corner handles preserve the original adjustment abilities.
Arrow keys adjust10px, Shift50px and Home restores the pre-adjustment CSS layout.
Explicit geometry uses a plain immutable numeric rectangle; DOMRect prototype
properties must not be spread as an object. The initial implementation exposed
that actual browser defect and the corrected focused tests now pass.

Movement/size are clamped to the actual viewport, retaining16px margins and
readable dimensions. Resizing the viewport reapplies bounds. Native scrolling,
form values/selection, write ownership and semantic validation remain. Geometry
does not write data, call APIs, persist across accounts or change authorization.
Busy saves disable all handles and ignore pointer/keyboard mutations; the
existing pending-cancel protection remains. Alert confirmations are not
adjustable by default. The mobile navigation drawer explicitly opts out so
drawer position, focus trap and original dimensions stay intact.

Pointer capture is owned by the dialog instance, ended on up/cancel/lost capture,
window blur, viewport resize, busy transition or cleanup. No document mouse
property is overwritten. All native listeners/title class are removed when the
effect is disposed, including hidden retained React Activity. Geometry is
revalidated upon resume. Closing restores a still-connected, visible, non-inert
opener only when no other native modal is open; this fixes the actual cancellation
focus regression found while testing the editor on mobile.

Actual posts editor regression fails before implementation in
dialog-geometry-before.log. Two focused cases pass in
dialog-geometry-focused-final.log: actual pointer header/corner, keyboard width,
viewport narrowing, retained draft, cancel/focus, keyboard move/Home and a gated
real-browser POST response proving busy geometry/cancel protection and failure
recovery. Frozen full frontend lint/type/repro/98 units/build and141 mocked
browsers pass in dialog-geometry-final-*.log. The real posts CRUD test now adjusts
the native editor before actually persisting and exporting the owned SQL row;
two full real profiles are currently running and are not yet accepted. Exact new
source cloud is required. Java/contract source is unchanged; no new local Maven
or jar package is claimed for this frontend-only stage.

Current aggregate review: current-scope-acceptance.md. Task mutation runtime
proposal remains specifically unapproved; form builder deferred. Full project
completion is not claimed.

Final local authority97313 terminated0: default and enabled configurations each62 real browsers and complete MySQL/Redis/Quartz/OSHI/ACL/permission/rollback/captcha API PASS, including the new actual post editor move/width/Home before genuine SQL persistence/export. Both live OpenAPI hashes equal unchanged CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C. All owned processes/fixtures were cleaned by their parent. Final source41f3b6aa62b157b0ce0d010e39fc2e94d3504dc1 is published; precise server37643644308/web37643644236 are running, not yet accepted. Normal Git receive repeatedly returned HTTP500; authenticated Git API recovery required matching every blob/tree/complete original commit SHA before ordinary force=false fast-forward. Initial message-newline/metadata attempts failed identity guards without publishing a ref; the original complete message recovered exactly the same SHA. No local/published history or product contents were rewritten. Direct dialog-geometry-git-original-publish.log and git fetch establish publication. Full project remains incomplete.

Base41f3b6a precise server37643644308 all3/web37643644236 now terminal SUCCESS; direct dialog-geometry-cloud-*-base-accepted.log establishes both62/fullAPI/OpenAPI,661 declarations including10 scope/one existing platform skip,98 units/141 mocks and both generated hosts. Final source audit then reproduced a separate retained-heading ownership defect: document.getElementById can choose an earlier hidden heading with the same static ID. dialog-title-owner-before.log retains the actual failed title drag. The listener now queries only inside its dialog using CSS.escape. Frozen final lint/type/repro/98 units/build/141 mocked browsers pass, including the unchanged movement assertion in a duplicated hidden-heading DOM. Focused final real posts2/fullAPI authority88070 is running; the newer scoped source still requires its own exact cloud acceptance. Earlier base success is not substituted for this final patch.

Final scoped caption correction: a second controlled retained heading with a different name reproduces the native aria-labelledby collision in dialog-caption-owner-before.log. ResourceDialog now has a per-instance useId caption/help identity, derives the caption only from its own heading before showModal, and observes only that heading's text changes. It removes its observer on layout cleanup/Activity hide and restores it on resume. The invisible caption is literal text, not HTML. Pointer binding is separately scoped to the dialog. Original visible headings, drafts, permissions and all modal operations remain.

Final local98 units/lint/type/repro/build and141 mocks pass in dialog-caption-final-*; corrected final test set also passes lint/type and141 in dialog-caption-viewport-final-*. Local59827 completed0 with2 actual posts browsers and complete enabled API; unchanged OpenAPI is CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C. Earlier88070 used a test-name regex where the runner requires a file pattern and ran zero tests, then cleaned its owned runtime; it is not product acceptance or a product defect. The corrected invocation uses posts.spec.ts and preserves both original tests.

Intermediate08bb4e4 web37646585561 failed140/141 at the viewport resize check; no claim of all-green acceptance for that source. The old check read boundingBox immediately after viewport emulation, before owned native resize/ResizeObserver layout delivery. The corrected assertion waits for the same non-null positive-height and exact bottom-within-viewport condition with normal expect.poll, without increased timeout, retries, force clicks or relaxed bounds. All8 repeated ordinary resize cases and the final full141 pass. ConsolePage production source is unchanged. Its previously demonstrated forced-min-height defect remains fixed and the original native authorization interactions stay tested. A precise final source cloud remains required; baseline41f3b6a success does not replace it.
