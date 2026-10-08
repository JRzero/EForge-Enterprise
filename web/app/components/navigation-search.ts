import Fuse from 'fuse.js';
import type {NavigationItem} from '../../integration/navigation';
export interface NavigationSearchEntry {key: string; title: string[]; href: string; external: boolean; icon?: string}
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
