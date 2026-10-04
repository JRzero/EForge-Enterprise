# Canonical menu security review

Date: 2026-10-04. Scope: menu API/client groundwork; React menu acceptance remains
pending. Neither this API checkpoint nor green subset tests prove full parity.

## Authorization and object boundaries

Original list/query/add/edit/remove permissions protect every operation. Options
and route catalogs require query/add/edit. Every detail, write, delete and sort
item must belong to the non-admin operator's active, undeleted role grants.
Admin retains the original global menu authority. No department-data-scope
algorithm is introduced for menu resources.

Changing or creating permission strings cannot grant permissions the operator
does not currently possess in a fresh database role/permission snapshot. An
unchanged existing permission can be retained; a parent unavailable to the
operator can be retained but cannot be newly selected. Unknown targets return
safe 404 problems, inaccessible existing targets safe 403 problems. Mixed sort
batches validate all objects before writing.

## Hierarchy and route safety

Stable keys, names within a parent and route identities remain unique. Keys are
immutable after assignment; null legacy keys can be adopted. The canonical root
mutex serializes validation/write transactions. V011 provides real database
sibling-name uniqueness alongside the existing key/route indexes. Parent loops,
excessive depth and leaf/external parents are rejected. Nodes with children cannot
be converted to leaves or deleted; role-assigned nodes cannot be deleted.

The boot artifact packages the same static navigation registry that the web
application consumes. Only that catalog may bind ROUTE IDs, and its permission
must match. Internal profile/allocation pages cannot be selected. Existing
unimplemented legacy rows can retain null routes until actual page implementation.
External URLs require HTTP(S), a host and no user credentials. No component path,
executable expression or legacy entity crosses the contract boundary.

## Session consistency and compatibility

After commit, affected users are refreshed using `RoleSessionRefresher`: current
database roles/permissions, existing Redis keys only, preserved remaining TTL,
and no logged-out-session resurrection. Redis and MySQL remain separate stores;
a refresh failure can follow a committed edit. See the role review for the full
failure boundary. Canonical writes share the mutex; legacy compatibility writes
retain their original concurrency limitations.

The original permission model evaluates each button/menu's own status. Disabling
a parent route removes its list grant and navigation, but does not implicitly
revoke a separately active child-button grant. Real protected-endpoint checks
must preserve this behavior. All ten data-scope parity cases stay unchanged.

## Evidence

`MenuControllerTest` covers safe/scoped projections, exact large IDs, original
operation permissions, invalid requests, stable keys, route/permission matching,
internal-route rejection, external URL safety, privilege escalation denial,
hierarchy/deletion guards, clearing fields, atomic sort and post-commit refresh.
`MenuRouteCatalogTest` checks the packaged public navigation registry.
`verify-menus-integration.ps1` exercises actual MySQL/Redis persistence, Unicode,
filters/sort/clearing, object scope, route constraints, live session revoke/grant,
independent child permission semantics, real indexes and concurrent duplicates.
Final validation and CI evidence are recorded in the parity inventory.
