import {canAccessRoute, type AppRouteRecord} from '@eforge/app';
import type {NavigationNode} from '../generated/api';
import {toEForgePermissions} from './permissions';
export interface NavigationItem {key: string; label: string; href?: string; external?: boolean; children: NavigationItem[]}
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
        return children.length ? [{key: node.key, label: node.label, children}] : [];
      }
      if (node.type === 'EXTERNAL') {
        try {
          const url = new URL(node.externalUrl ?? '');
          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return [];
          return [{key: node.key, label: node.label, href: url.href, external: true, children: []}];
        } catch { return []; }
      }
      const route = registry.get(node.routeId ?? '');
      if (!route) { diagnostic(`Unknown navigation route: ${node.routeId ?? '(missing)'}`); return []; }
      if (!canAccessRoute(route, access)) return [];
      return [{key: node.key, label: node.label, href: route.path, children: visit(node.children, depth + 1)}];
    });
  }
  return visit(nodes, 0);
}
