# ADR-0013: Canonical menu administration and packaged route catalog

## Status

Accepted under the pinned architecture baselines.

## Decision

Canonical `/api/v1/system/menus` represents GROUP, ROUTE, EXTERNAL and FUNCTION
nodes with concrete DTOs. A FUNCTION is an authorization entry, not a navigation
route. Stable `menu_key` identities are immutable once assigned. Numeric database
identities remain decimal strings. Existing legacy rows with no key can receive
an identity through an explicit edit.

Package `web/app/route-contract.json` into the boot artifact during Maven resource
processing. The menu route catalog reads that exact resource; it does not
duplicate route IDs or read a workspace at runtime. Hidden/internal routes are
excluded. New ROUTE entries require a registered ID and its corresponding backend
permission; existing unbound legacy route entries can retain a null binding while
their pages are pending. GROUP/EXTERNAL/FUNCTION entries cannot bind routes.
Only the actual React page implementation may add a route to that shared catalog.

Do not expose or accept database component expressions. Route paths derive from
the static catalog. Legacy component/route-name fields remain untouched behind
the compatibility boundary; query/cache metadata is preserved as data without
evaluating it. External links require an HTTP(S) host and no credentials.

Acquire the existing canonical root-department mutex before reading menu mutation
state. Validate object grants, parent types, depth/cycles, identities, sibling
names and route bindings before writes. Batch sort validates every item first.
V011 makes original sibling-name uniqueness authoritative in MySQL. Child/role
associations prevent deletion. Committed permission/status edits reuse the
existing expiry-preserving role-session refresh, with its documented separate
MySQL/Redis failure boundary. Canonical menu writes do not change the original
data-scope algorithm or implicit child-button permission semantics.

## Consequences

Backend packaging requires the committed web navigation contract, rather than
frontend dependencies or a frontend build. Catalog and controller tests verify
the packaged contract. Complete menu page, icon selection, keyboard/mobile and
live browser evidence remain required by the full parity inventory. The legacy
compatibility controller remains available and does not participate in the new
canonical hierarchy mutex; its writes retain their original limitations.
