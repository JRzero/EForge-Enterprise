import {getRouteAncestry, materializeRoutePath, type AppRouteRecord, type RouteMatch} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
export interface Crumb {key: string; label: string; href?: string}
function findTrail(items: readonly NavigationItem[], href: string): Crumb[] | undefined {
  for (const item of items) {
    if (!item.external && (item.path ?? item.href) === href) return [{key:item.key,label:item.label,href:item.href}];
    const child = findTrail(item.children, href);
    if (child) return [{key:item.key,label:item.label,href:item.external?undefined:item.href}, ...child];
  }
}
export function navigationBreadcrumbs(items: readonly NavigationItem[], routes: readonly AppRouteRecord[], match: RouteMatch): Crumb[] {
  const ancestry = getRouteAncestry(routes, match.route.id);
  let crumbs: Crumb[] = [];
  for (const route of ancestry) {
    const found = findTrail(items, route.path);
    if (found) crumbs = found;
    else crumbs.push({key:'route:'+route.id,label:route.title,href:materializeRoutePath(route.path,match.params)});
  }
  const home = findTrail(items, '/dashboard')?.at(-1);
  if (home && !crumbs.some(item => item.key === home.key)) crumbs.unshift(home);
  return crumbs.map((item,index) => index===crumbs.length-1 ? {...item,href:undefined} : item);
}