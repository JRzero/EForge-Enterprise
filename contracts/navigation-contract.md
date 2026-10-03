# Navigation Contract

## Purpose

Define the stable boundary between backend menu assignment and the EForge frontend route registry.

## Principle

Navigation structure and route implementation are related but are not the same model.

- Backend owns navigation grants, hierarchy, order, labels/icons, status, and external-link metadata.
- Frontend owns application routes, URLs, React components, and route-level UX access metadata.
- A backend navigation **ROUTE** node links to a frontend route through a stable `routeId`.

## Navigation node model

A navigation tree contains three node types:

```text
GROUP     visual/navigation grouping; no React route required
ROUTE     links to a registered EForge route
EXTERNAL  opens an explicit external URL
```

Recommended response model:

```ts
type NavigationNode =
  | {
      key: string;
      type: 'GROUP';
      label: string;
      order: number;
      icon?: string;
      children: NavigationNode[];
    }
  | {
      key: string;
      type: 'ROUTE';
      routeId: string;
      label: string;
      order: number;
      icon?: string;
      children: NavigationNode[];
    }
  | {
      key: string;
      type: 'EXTERNAL';
      label: string;
      order: number;
      icon?: string;
      externalUrl: string;
      children: [];
    };
```

## Runtime source

The canonical post-login API is:

```http
GET /api/v1/app/bootstrap
```

Navigation is returned as part of the same authorization snapshot as user, roles, and permissions.

Example:

```json
{
  "user": {
    "id": "1",
    "username": "admin",
    "displayName": "Administrator"
  },
  "roles": ["admin"],
  "permissions": ["system:user:list"],
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

## Frontend route registry

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

The application resolves only ROUTE nodes:

```text
backend NavigationNode(type=ROUTE)
        ↓ routeId
frontend route registry
        ↓
React page
```

GROUP nodes do not require fake routes or placeholder React components.

## Stable identifiers

### Navigation key

`key` identifies a navigation node across environments and database reseeding.

Requirements:

- globally unique in the navigation tree
- lowercase kebab-case
- independent of numeric database IDs
- independent of labels
- stable across visual reordering

Examples:

```text
system
system-users
monitor
monitor-operation-logs
```

### Route ID

`routeId` exists only on ROUTE nodes.

Requirements:

- globally unique in the frontend route registry
- stable across file moves/refactors
- independent of Java class names
- independent of React file paths
- lowercase kebab-case

A navigation key and route ID may intentionally be the same for route leaves, but they are conceptually different identifiers.

## Database migration

Do not reuse the legacy `component` field for React.

Recommended schema additions:

```text
sys_menu
+ menu_key varchar(100) unique
+ route_id varchar(100) null
```

Mapping:

- directory/menu-group rows use `menu_key`, `route_id = null`
- React route rows use both `menu_key` and `route_id`
- external rows use `menu_key` plus existing/new external URL metadata
- `component` remains temporarily only for upstream compatibility

## Permissions

The bootstrap response already contains the current permission set.

The frontend route registry declares its UX access requirement:

```ts
access: {permission: 'system:user:list'}
```

The runtime must not trust a database-provided component or executable access expression.

Backend endpoint authorization remains authoritative.

## Validation

CI/integration tests must detect:

- duplicate navigation keys
- duplicate route IDs in seeded route rows
- ROUTE nodes with unknown frontend route IDs
- ROUTE nodes missing route IDs
- EXTERNAL nodes missing URLs
- invalid parent/tree cycles
- seeded route permissions inconsistent with expected backend endpoints

## Unknown route IDs

If backend bootstrap returns an unregistered `routeId`:

- never dynamically import arbitrary code
- omit the node from rendered navigation
- emit a diagnostic warning
- fail the route-contract validation test for framework seed data

## External links

External URLs are explicit:

```json
{
  "key": "external-docs",
  "type": "EXTERNAL",
  "label": "Documentation",
  "order": 100,
  "externalUrl": "https://example.com/docs",
  "children": []
}
```

Do not overload application route paths or component fields with external URLs.
