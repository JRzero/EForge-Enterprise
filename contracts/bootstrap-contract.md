# Application Bootstrap Contract

## Goal

Avoid multiple loosely coordinated startup APIs and define one canonical post-login application bootstrap response.

## Authentication flow

```text
POST /api/v1/auth/login
        ↓
access token
        ↓
GET /api/v1/app/bootstrap
        ↓
EForge application startup
```

## Login response

The canonical login endpoint accepts `username`, `password`, and optional
`code` / `uuid` captcha values. Username and password are required and bounded
to the preserved upstream maximum of 20 characters. Omitted captcha values
are normalized to empty strings; captcha validation remains authoritative in
the existing authentication service. Until a canonical captcha endpoint is
implemented, clients obtain challenges from legacy `/captchaImage`.

Successful login returns HTTP 200 with `Cache-Control: no-store`.

```json
{
  "accessToken": "...",
  "tokenType": "Bearer"
}
```

The initial implementation may preserve RuoYi's Redis-backed token/session behavior behind this contract.

The implementation reuses that existing authentication service and Redis TTL.
It does not change password retry, account lockout, captcha consumption, or
data-scope behavior. Legacy `/login` remains available during migration.

Failures use `application/problem+json` with real HTTP statuses:

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing/invalid fields or unreadable JSON |
| 400 | `CAPTCHA_INVALID` | Incorrect, expired, or already consumed captcha |
| 401 | `AUTHENTICATION_FAILED` | Credentials or authentication provider rejected login |
| 403 | `LOGIN_BLOCKED` | Existing IP blacklist denied login |
| 500 | `INTERNAL_ERROR` | Unexpected failure outside the upstream provider-rejection boundary |

Responses never include the upstream exception message or rejected values.
The upstream login service collapses provider failures into `ServiceException`;
the login adapter deliberately maps that coarse rejection category to 401.
Distinguishing provider outages from account rejection requires a later,
isolated change to that compatibility boundary.

The authenticated OpenAPI group `/v3/api-docs/api-v1` contains canonical APIs
only. OpenAPI remains disabled by default. The authenticated integration run
exports the canonical snapshot to `contracts/openapi/api-v1.json`; the pinned
generator produces concrete TypeScript DTOs and request functions under
`web/generated/`. Required response fields are explicit in the server schemas.
Client generation is checked for reproducibility and CI compares a live export
with the committed snapshot.

## Bootstrap response

```json
{
  "user": {
    "id": "1",
    "username": "admin",
    "displayName": "Administrator"
  },
  "roles": ["admin"],
  "permissions": [
    "system:user:list",
    "system:user:add"
  ],
  "navigation": [
    {
      "key": "system",
      "type": "GROUP",
      "label": "System",
      "order": 10,
      "children": [
        {
          "key": "system-users",
          "type": "ROUTE",
          "routeId": "system-users",
          "label": "Users",
          "order": 10,
          "children": []
        }
      ]
    }
  ]
}
```

## Why bootstrap is combined

The original RuoYi flow exposes user info and router data separately.

For EForge Enterprise, one bootstrap request after authentication:

- removes startup waterfalls
- keeps roles/permissions/navigation from one authorization snapshot
- simplifies cache invalidation
- produces a clear frontend initialization boundary

## Rules

The implemented endpoint reads the current account, active roles, permissions,
and granted menu rows in one read-only MySQL REPEATABLE READ transaction. It
refreshes the existing Redis session with that snapshot, including role-level
permissions and data-scope values. Disabled/deleted accounts invalidate the
current session and return HTTP 401. Responses use `Cache-Control: no-store`.
See `docs/bootstrap-security-review.md` for the freshness boundary and review.

- bootstrap navigation is already filtered for the current user
- frontend route guards still validate permissions from the same bootstrap snapshot
- backend endpoint authorization remains authoritative
- dictionaries and large reference datasets are not part of bootstrap
- unknown route IDs are ignored and reported as configuration diagnostics

The React shell persists only the token in tab session storage via EForge's
auth store and restores bootstrap before rendering protected routes. It converts
the preserved administrator marker `*:*:*` to EForge's `*` for UX only. A 401
clears the current session; transient failures permit retry. Generation/abort
guards prevent stale requests from restoring an earlier login. Captcha and
POST logout remain isolated in `web/integration/legacy-auth.ts`; confirmed logout
invalidates Redis before clearing the local token. See ADR-0010.
