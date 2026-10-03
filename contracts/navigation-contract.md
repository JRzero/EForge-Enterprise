# Navigation Contract

## Purpose

Define the stable boundary between backend menu/permission assignment and the EForge frontend route registry.

## Principle

The database controls **grants and navigation metadata**.

The React application controls **component implementation**.

They are connected by `routeId`.

## Response shape

Recommended endpoint:

```http
GET /api/app/navigation
```

Response:

```json
{
  "data": {
    "items": [
      {
        "routeId": "system",
        "parentRouteId": null,
        "label": "System",
        "order": 10,
        "visible": true,
        "icon": "settings",
        "externalUrl": null
      },
      {
        "routeId": "system-users",
        "parentRouteId": "system",
        "label": "Users",
        "order": 10,
        "visible": true,
        "permission": "system:user:list",
        "icon": "users",
        "externalUrl": null
      }
    ]
  }
}
```

## Frontend registry

```ts
const routes = defineAppRoutes([
  {
    id: 'system-users',
    path: '/system/users',
    title: 'Users',
    access: {permission: 'system:user:list'},
    component: UsersPage
  }
]);
```

The application intersects:

```text
frontend route registry
        ∩
backend navigation grants
        ↓
visible application navigation
```

## Authentication bootstrap

Recommended bootstrap sequence:

```text
POST /login
   ↓
token
   ↓
GET /api/app/session
   ├─ user
   ├─ roles
   └─ permissions
   ↓
GET /api/app/navigation
   └─ navigation grants
   ↓
EForgeApplication
```

The existing RuoYi `getInfo` and `getRouters` endpoints may be kept temporarily for migration, but new frontend code targets the new contracts.

## Route ID requirements

A `routeId` must be:

- globally unique
- stable across frontend refactors
- independent of Java class names
- independent of React file paths
- independent of display labels
- lowercase kebab-case by convention

Examples:

```text
dashboard
system-users
system-roles
system-departments
monitor-operation-logs
tools-generator
```

## Security

Navigation responses may omit inaccessible items, but that omission is not a security control.

Every protected backend endpoint still requires Spring Security authorization and, where relevant, data-scope enforcement.

## Failure modes

If backend returns a `routeId` not registered in frontend:

- do not execute arbitrary dynamic imports
- ignore the unknown route for navigation rendering
- emit a development/observability warning
- expose a validation test that compares known route IDs with seeded navigation data

If frontend registers a route that backend never grants:

- route remains hidden
- direct access may render 403 based on permissions

## External links

External URLs are allowed only through explicit metadata:

```json
{
  "routeId": "external-docs",
  "externalUrl": "https://example.com/docs"
}
```

Do not overload route paths or component fields with URLs.
