# Authorized navigation breadcrumbs and header search

This stage implements original RuoYi v3.9.2 behavior from the immutable reference
0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0, without importing its Vue code or
changing either architecture baseline. HeaderSearch uses the original pinned
Fuse.js6.4.3 with threshold0.2 and title/path weights0.7/0.3. Search supports
layered titles, path substring plus fuzzy title matches, unique stable menu keys,
empty/clear states, literal match highlighting, keyboard wrap/Enter/Escape and
external links. Fixed attributed static icon choices are used; unknown names do
not become dynamic React imports or arbitrary asset paths.

Only projected, authorized bootstrap navigation enters the pool. Groups have no
search URL or fake React route. Invalid external schemes/credential URLs and
unknown or unauthorized ROUTEs remain rejected by the existing projection.
React text/mark nodes render labels and queries; no HTML injection API is used.
External HTTP(S) results open with noopener/noreferrer and no JWT in the URL.
Permission updates recompute the pool/results directly rather than retaining an
old search cache. Logout unmounts the authenticated shell and dialog.

Breadcrumbs use the authorized menu hierarchy, stable menu keys and public pinned
EForge route ancestry/materialization for actual internal parameter pages. Role
allocation, dictionary entries and task logs have static frontend parent route
identities. Groups remain non-links; the current page is text. The authorized
home is prepended only when present. Unknown/forbidden pages have no breadcrumb.
No canonical endpoint, SQL/data scope or backend authorization semantics change.

Actual browser regression70129 identified a real focus restoration bug: focusing
the search trigger while the modal still existed was too early. Restoration now
occurs after modal unmount. The original group-navigation test also needed its
existing group assertion scoped to the actual sidebar because breadcrumbs now
legitimately contain the same group text. No permission assertion was removed.
Corrected59988 ended0: client reproduction, lint/typecheck,94 units, production
build and all74 mocked browsers pass. New cases prove title/path search, literal
hostile labels, keyboard selection/wrap, empty/clear, mobile width, focus recovery,
exact long-ID internal ancestry, revoked grants and no-opener external navigation.
A mistaken fuzzy fixture expected a one-error three-character word to match the
original0.2 threshold; the corrected long-word typo proves the original algorithm
without loosening its threshold.

Production backend source/jar remains the verified77c43dc source (618 Maven tests,
including10scope); this stage changes only frontend source and its tests. The earlier two focused navigation browsers/full API profiles19525 ended0, with
both exact live OpenAPI snapshots matching36EE572B9178EC84786C721AFBB477588C1F0D006D0CD9250467323831E7763F; these precede final presentation changes below.
Exact cloud and full49-case framework profiles remain pending.

A controlled actual browser38192 ended1 because a title containing Unicode İ
expanded during lower-casing, moving the abc highlight to bc followed by a space.
The final renderer matches escaped literal regular expressions against original
text and uses actual match indices/lengths.42089 ended0 with94 units/all74 mocked
browsers plus lint/typecheck/build/reproduction on the final production source.
The search modal now also supports original backdrop closing through an opt-in
ResourceDialog property whose default preserves existing editors; current
breadcrumb text has aria-current. Final literal Unicode/parenthesis plus backdrop
cases pass all3 focused mocked tests in shell-navigation-literal-final-target.log.
The initial parenthesis fixture placed its match beyond the original Fuse0.2
location threshold (28247); moving the literal near the prefix verifies escaping
without changing the original search algorithm. Final exact-source two actual focused browser/full API profiles83456 ended0.
Both real navigation cases and complete MySQL/Redis/Quartz/OSHI/ACL/permission/
SQL fault/calendar/XLSX/generator/console/captcha regressions pass. Final logs:
shell-navigation-final-disabled/enabled-runtime.log. Both live OpenAPI snapshots
match committed36EE572B9178EC84786C721AFBB477588C1F0D006D0CD9250467323831E7763F.
Exact cloud and both full49-case framework browser profiles remain pending.
This stage is not full shell parity: tabs/cache, collapse/top-navigation,
embedded routes, original query/cache metadata and theme/density/settings remain.
The active goal stays incomplete; form builder is deferred and the specific
Quartz runtime rejection remains in force.