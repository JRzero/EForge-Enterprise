import Fuse from 'fuse.js';
import {getRouteAncestry, materializeRoutePath, type AppRouteRecord, type RouteMatch} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
export interface NavigationSearchEntry {key: string; title: string[]; href: string; external: boolean; icon?: string}
export interface Crumb {key: string; label: string; href?: string}
export function navigationSearchPool(items: readonly NavigationItem[], trail: string[] = []): NavigationSearchEntry[] {
  return items.flatMap(item => {
    const title = [...trail, item.label];
    return [...(item.href ? [{key:item.key, title, href:item.href, external:!!item.external, icon:item.icon}] : []),
      ...navigationSearchPool(item.children, title)];
  });
}
export function searchNavigation(pool: NavigationSearchEntry[], query: string): NavigationSearchEntry[] {
  if (!query) return pool;
  const lower = query.toLowerCase();
  const paths = pool.filter(item => item.href.toLowerCase().includes(lower));
  const fuzzy = new Fuse(pool, {shouldSort:true, threshold:0.2, minMatchCharLength:1,
    keys:[{name:'title',weight:0.7},{name:'href',weight:0.3}]}).search(query).map(result => result.item);
  const seen = new Set(paths.map(item => item.key));
  return [...paths, ...fuzzy.filter(item => {if (seen.has(item.key)) return false; seen.add(item.key); return true;})];
}
function findTrail(items: readonly NavigationItem[], href: string): Crumb[] | undefined {
  for (const item of items) {
    if (!item.external && item.href === href) return [{key:item.key,label:item.label,href:item.href}];
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
  if (home && !crumbs.some(item => item.href === '/dashboard')) crumbs.unshift(home);
  return crumbs.map((item,index) => index===crumbs.length-1 ? {...item,href:undefined} : item);
}