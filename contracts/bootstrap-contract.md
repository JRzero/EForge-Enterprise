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

```json
{
  "accessToken": "...",
  "tokenType": "Bearer"
}
```

The initial implementation may preserve RuoYi's Redis-backed token/session behavior behind this contract.

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
