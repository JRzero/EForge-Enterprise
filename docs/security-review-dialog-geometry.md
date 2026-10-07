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
