# ADR-0011: Authenticated internal self-service routes

## Status

Accepted for profile parity at the existing architecture baselines.

## Decision

Preserve the original frontend's constant hidden personal-profile route as a
fixed lazy React route at `/user/profile`, reachable from the authenticated
application header. All application pages remain behind session bootstrap.
Self-service requires authentication, with account identity enforced by the
server; it does not invent a management permission or a database menu row.

`web/app/route-contract.json` continues to describe backend-seeded navigation
routes. `web/app/internal-route-contract.json` explicitly records internal routes.
Unit validation checks their combined actual registry and the self-service access
rule; seeded-route validation still requires every navigation contract binding.
GROUP nodes remain groups, and database strings never resolve React components.

Profile saving refreshes authoritative bootstrap without unmounting the current
authenticated page. The same abort/generation boundaries prevent a response from
restoring an obsolete session after logout or a newer login. No user profile,
grants or password is added to browser persistence.

Avatar cropping stays a local feature with a fixed 200-pixel square, bounded
zoom/pan, quarter-turn rotation and PNG output. Native canvas plus accessible
keyboard controls implements the original crop behavior without copying EForge
or adding a global framework abstraction. Actual server decoding and ownership
checks remain authoritative. Uploaded `/profile/**` resources use the original
same-origin serving behavior and must be proxied separately from SPA fallback.

## Consequences

Personal-center navigation exists even when an account has no management grants.
It does not appear in the backend sidebar menu or require navigation migrations.
Future internal routes must be explicit and individually authorized; this decision
does not grant access to arbitrary or unknown backend route IDs.
