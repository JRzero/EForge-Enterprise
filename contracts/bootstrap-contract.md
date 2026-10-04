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
only. OpenAPI remains disabled by default. Client generation and bootstrap
implementation are subsequent milestones.

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

- bootstrap navigation is already filtered for the current user
- frontend route guards still validate permissions from the same bootstrap snapshot
- backend endpoint authorization remains authoritative
- dictionaries and large reference datasets are not part of bootstrap
- unknown route IDs are ignored and reported as configuration diagnostics
