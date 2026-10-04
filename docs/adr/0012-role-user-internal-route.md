# ADR-0012: Explicit role user authorization route

## Status

Accepted for role parity under the pinned architecture baselines.

## Decision

Register the lazy role page `/role` as the actual `system-roles` navigation route.
V010 binds that route to the existing stable `system-roles` menu identity.
Preserve the original distinct user-authorization subpage with the explicit
internal pattern `/role/users/:roleId`. The existing pinned EForge route matcher
supplies string parameters; product code neither resolves components from
database strings nor invents a group route. The internal route requires
`system:role:list`, matching allocated/unallocated reads. Server object scope
and `system:role:edit` remain authoritative for assignment/cancellation.
The original frontend's inconsistent add/remove button guards are aligned with
its backend's existing edit permission. No permission algorithm changes.

The subpage does not require a database menu row. It validates positive decimal
identities without coercing them to JavaScript numbers. Parameter changes reset
the page's local selection/dialog state. Browser refresh/deep-link and close
behavior are verified along with authorization and missing-object failures.
Seed contracts continue to describe only actual navigation routes; internal
contracts describe individually authorized hidden routes. Route matching and
denial tests supplement real backend/browser checks.

## Consequences

User authorization has its own address and retains normal browser history.
No generic dynamic backend component mechanism or frontend source copying is
introduced. Other hidden routes must be registered and authorized explicitly.
