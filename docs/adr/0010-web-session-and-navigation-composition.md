# ADR-0010: Web session and navigation composition

## Status

Accepted for the Phase 2 application shell.

## Decision

Consume the immutable EForge package artifacts at the existing architecture
baseline. Generate TypeScript DTOs and request functions from the authenticated
canonical Spring OpenAPI group, with a pinned generator and committed snapshot.

Use EForge's public `AppShell`, `PermissionProvider`, `defineAppRoutes`,
`matchAppRoute`, `canAccessRoute` and browser router adapter. At the pinned
baseline `EForgeApplication` provides only flat route-derived navigation and no
custom navigation prop. Keep tree rendering and session orchestration local to
the enterprise integration layer instead of changing upstream or inventing
routes for navigation groups. The dashboard is the first real registered route.

Persist only the bearer token in tab-scoped session storage through EForge's
auth store. Reload performs bootstrap before rendering protected pages. Neither
permissions, credentials nor bootstrap user data are persisted. In-memory
storage is a fallback when browser storage is unavailable. Expired sessions
clear local state; transient bootstrap failure retains the token for retry.
Abort/generation guards prevent stale requests from restoring an older session.

Keep `/captchaImage` and POST `/logout` in one explicit RuoYi compatibility
adapter until canonical replacements exist. Failed server logout does not claim
revocation or silently discard the session; the user can retry. Confirmed logout
removes the Redis session and then the tab token. Local "return to login" from a
bootstrap connectivity error only forgets the tab token and does not promise
server revocation.

Convert the backend administrator permission marker `*:*:*` to EForge's `*`
only at the UX boundary. Backend authorization remains authoritative. Unknown
route IDs are diagnosed and omitted, groups have no route URL, and external
links accept HTTP(S) without credentials and use `noopener noreferrer`.

## Consequences

Bootstrap revalidates permissions on startup/reload and retry, not continuously.
Future protected API requests must use the integration transport so authenticated
401 responses invalidate the current session. Tab-scoped tokens are still
accessible to same-origin script; this does not introduce cookie authentication
or redesign the existing server token implementation.

Production must serve the SPA with history fallback and proxy `/api/v1`,
`/captchaImage`, and `/logout` to the server under the same origin. The Vite
proxy is only a local development convenience.
