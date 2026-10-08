import {canAccessRoute, type AppRouteRecord} from '@eforge/app';
import type {NavigationNode} from '../generated/api';
import {toEForgePermissions} from './permissions';
import {menuQueryHref} from './menu-query';
export interface NavigationItem {key: string; label: string; href?: string; external?: boolean; icon?: string; path?: string; cached?: boolean; queryError?: boolean; children: NavigationItem[]}
/** Count actionable entries after permission, route and URL projection. Groups have no href. */
export function countNavigationEntries(items: readonly NavigationItem[]): number {
  return items.reduce((total, item) => total + (item.href ? 1 : 0) + countNavigationEntries(item.children), 0);
}
export function projectNavigation(nodes: NavigationNode[], routes: readonly AppRouteRecord[], permissions: readonly string[],
  diagnostic: (message: string) => void = message => console.warn(message)): NavigationItem[] {
  const registry = new Map(routes.map(route => [route.id, route]));
  const access = toEForgePermissions(permissions);
  const visited = new Set<string>();
  function visit(items: NavigationNode[], depth: number): NavigationItem[] {
    if (depth > 64) { diagnostic('Navigation depth exceeds the supported limit.'); return []; }
    return [...items].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)).flatMap(node => {
      if (visited.has(node.key)) { diagnostic(`Duplicate navigation key: ${node.key}`); return []; }
      visited.add(node.key);
      if (node.type === 'GROUP') {
        const children = visit(node.children, depth + 1);
        return children.length ? [{key: node.key, label: node.label, icon: node.icon, children}] : [];
      }
      if (node.type === 'EXTERNAL') {
        try {
          const url = new URL(node.externalUrl ?? '');
          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return [];
          return [{key: node.key, label: node.label, href: url.href, external: true, icon: node.icon, children: []}];
        } catch { return []; }
      }
      const route = registry.get(node.routeId ?? '');
      if (!route) { diagnostic(`Unknown navigation route: ${node.routeId ?? '(missing)'}`); return []; }
      if (!canAccessRoute(route, access)) return [];
      const children = visit(node.children, depth + 1);
      try {
        return [{key: node.key, label: node.label, href: menuQueryHref(route.path,node.queryText), path:route.path,
          cached:node.cached ?? true, icon: node.icon, children}];
      } catch {
        diagnostic(`Invalid navigation query for ${node.key}.`);
        return [{key:node.key,label:node.label,queryError:true,icon:node.icon,children}];
      }
    });
  }
  return visit(nodes, 0);
}
