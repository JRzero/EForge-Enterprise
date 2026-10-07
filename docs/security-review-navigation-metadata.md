# Navigation route query and cache metadata security review

## Implemented boundary

Canonical bootstrap ROUTE nodes now expose optional queryText and cached
through concrete OpenAPI DTOs and the generated TypeScript client. The original
SQL query and is_cache columns are read by both granted-navigation and role
selection projections; the canonical MyBatis constructor is explicit. GROUP
and EXTERNAL nodes cannot carry this route metadata. Original is_cache=0 means
cached=true;1 means false; old fixtures/null preserve the original default.

This stage consumes query defaults in registered route links, navigation search
and internal parent breadcrumbs. Active state and ancestry match the static
registered path rather than the query-bearing URL. Authorization and menu_key/
route_id identity rules are unchanged. No database component string is resolved.

JSON is parsed as data, own entries are URL encoded, arrays retain repeated
parameters, null remains a bare parameter and empty/zero/false remain distinct.
Quoted long IDs, Unicode and legal prototype-name keys remain exact URL values;
nothing is spread into a prototype or executed. Nested objects produce the safe
original object-string value rather than invoking an own toString property.
Malformed JSON or primitive roots leave a visible fixed configuration message
and remove only that malformed link/search result. Raw invalid values are not
rendered as markup or included in the diagnostic.

The cached preference is delivered to the frontend model; actual tab/cache
behavior is not implemented or accepted by this stage. Embedded routes, tabs/
pin/context/refresh, collapse/topnav and settings remain active work. The form
builder is deferred and the previously rejected Quartz runtime scheme remains
outside this change.

## Verification in progress

Full Maven29771 ended0:609 boot tests (one existing OS skip) plus10 data-scope
cases,619 total. Actual API-only44211 ended0: the disposable SQL fixture modifies
a seeded owned menu, reads exact queryText/cached=false through bootstrap,
asserts GROUP metadata absence and restores the menu. Complete MySQL/Redis/
Quartz/OSHI/ACL/permission/generator/console/captcha/API regressions pass.
The actual live OpenAPI export regenerated the TypeScript client.

98 units, lint/typecheck, generated-client reproduction and production build
passed. The first mocked query test omitted ArrowDown before Enter, which the
existing original keyboard behavior requires; the first real test counted native
page select options together with modal results. Those are fixture failures,
not changes to search semantics. navigation-metadata-before-runtime.log retains
the real failure; the fixture now selects a result and scopes the result count
to the navigation dialog. Final mocked and two-profile actual browser/API
verification and exact cloud acceptance remain pending.

The final mocked suite95431 ended0:all75 pass. The intervening97834 run
passed the other74 but the new fixture mistakenly hard-coded4173 instead of
the configured4175; the corrected assertion derives the existing page origin.
All4 navigation mocked cases also pass navigation-metadata-mock-final.log.
No production navigation code changed in these fixture corrections.
Final real verification is uniquely20514; it is still pending.
## Final local acceptance

The unique20514 process ended0. Default and enabled-console/custom-output
profiles each passed both real navigation browser cases and the complete actual
MySQL/Redis/Quartz/OSHI/ACL/menu-role/session/captcha/generator/console regressions.
Logs:navigation-metadata-final-disabled/enabled-runtime.log. Both live schemas
and the committed contract have SHA256
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
No local app remains; no package or production source edit occurred during the
final running application. 619 Maven,98 units,all75 mocked,client reproduction,
lint/typecheck/build and both real focused profiles are locally accepted.
Exact cloud and the two complete50-case framework browser profiles remain
pending. This accepts query propagation and cache preference delivery only,
not actual retained pages, tabs or the full shell/active parity objective.