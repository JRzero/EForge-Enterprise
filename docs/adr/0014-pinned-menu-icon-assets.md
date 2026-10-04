# ADR-0014: Pinned menu icon asset bundle

## Status

Accepted for original menu/icon parity under unchanged architecture baselines.

## Decision

Ship all 88 SVG icons from the immutable RuoYi v3.9.2 behavior reference
`0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0` as attributed static assets.
This adds an explicit asset bundle, not a Vue application or an EForge source
copy. The RuoYi backend and EForge dependency pins remain unchanged.

`web/scripts/import-ruoyi-icons.mjs` reads a local reference checkout at that
exact commit. It records original and normalized SHA-256 values in
`web/features/menus/icons.json`, preserves glyph paths, removes XML/external DTD
and unused font stylesheet declarations, and adds a numeric viewBox where
needed for small-size scaling. Repair the upstream button icon's duplicate closing
path tag so a browser can decode it as a standalone image; glyph paths stay intact.
Unexpected glyph styles or active/external SVG
content fail import. The original MIT license ships with the asset directory;
third-party notices identify the reference and normalization.

The local menu icon picker selects from the complete manifest. Preview URLs are
resolved only from exact registered names; arbitrary database strings do not
become URLs, inline SVG markup or React component references. Unknown existing
names remain editable/retainable, with a neutral preview. The static asset files
load as needed; the menu page remains lazy. Unit checks validate the entire
manifest, asset hashes, viewports and unsafe-content exclusions. Browser checks
decode and draw all 88 images, and verify search, selection, clear, keyboard,
Escape, focus return and mobile bounds.

## Consequences

Menu users retain the original complete icon choices with consistent scaling.
An update to the asset baseline requires an explicit reviewed manifest/import
change. Icon selection is local to menu administration until further repeated
use justifies a shared control. Shell icon rendering and the remaining shell
capabilities stay in the full parity inventory.
