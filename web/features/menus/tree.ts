import type {MenuResponse} from '../../generated/api';

export function menuTree(rows: readonly MenuResponse[], collapsed: ReadonlySet<string> = new Set()) {
  const byId = new Map(rows.map(row => [row.id, row]));
  if (byId.size !== rows.length) throw new Error('菜单编号重复，请刷新后重试。');
  for (const row of rows) {
    const visited = new Set<string>(); let cursor: MenuResponse | undefined = row;
    while (cursor) { if (visited.has(cursor.id) || visited.size >= 64) throw new Error('菜单层级无效，请检查上级菜单。'); visited.add(cursor.id); cursor = byId.get(cursor.parentId); }
  }
  const children = new Map<string, MenuResponse[]>(), roots: MenuResponse[] = [];
  for (const row of rows) {
    if (!byId.has(row.parentId)) roots.push(row);
    else children.set(row.parentId, [...children.get(row.parentId) ?? [], row]);
  }
  const order = (items: MenuResponse[]) => items.sort((a, b) => a.sort - b.sort || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0));
  const result: {menu: MenuResponse; depth: number; path: string; hasChildren: boolean}[] = [];
  function visit(row: MenuResponse, depth: number, prefix = '') {
    const nested = children.get(row.id) ?? [], path = prefix ? `${prefix} / ${row.name}` : row.name;
    result.push({menu: row, depth, path, hasChildren: nested.length > 0});
    if (!collapsed.has(row.id)) for (const child of order(nested)) visit(child, depth + 1, path);
  }
  for (const root of order(roots)) visit(root, 0); return result;
}
export function menuParents(rows: readonly MenuResponse[], editingId?: string) {
  const excluded = new Set<string>(editingId ? [editingId] : []);
  let changed = true;
  while (changed) { changed = false; for (const row of rows) if (excluded.has(row.parentId) && !excluded.has(row.id)) { excluded.add(row.id); changed = true; } }
  return menuTree(rows).filter(row => !excluded.has(row.menu.id) && ['GROUP', 'ROUTE'].includes(row.menu.type));
}
