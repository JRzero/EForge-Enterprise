import type {DepartmentResponse} from '../../generated/api';

export function departmentTree(rows: readonly DepartmentResponse[], collapsed: ReadonlySet<string> = new Set()) {
  const known = new Set(rows.map(row => row.id));
  const children = new Map<string, DepartmentResponse[]>();
  const roots: DepartmentResponse[] = [];
  for (const row of rows) {
    if (!known.has(row.parentId)) roots.push(row);
    else children.set(row.parentId, [...(children.get(row.parentId) ?? []), row]);
  }
  function order(items: DepartmentResponse[]) {
    return items.sort((left, right) => left.sort - right.sort || (BigInt(left.id) < BigInt(right.id) ? -1 : BigInt(left.id) > BigInt(right.id) ? 1 : 0));
  }
  const result: {department: DepartmentResponse; depth: number; hasChildren: boolean; path: string}[] = [];
  const visited = new Set<string>();
  function visit(row: DepartmentResponse, depth: number, prefix = '') {
    if (visited.has(row.id)) return;
    visited.add(row.id);
    const nested = children.get(row.id) ?? [];
    const path = prefix ? `${prefix} / ${row.name}` : row.name;
    result.push({department: row, depth, hasChildren: nested.length > 0, path});
    if (collapsed.has(row.id)) {
      const pending = [...nested];
      while (pending.length) {
        const child = pending.pop()!;
        if (!visited.has(child.id)) { visited.add(child.id); pending.push(...(children.get(child.id) ?? [])); }
      }
    } else for (const child of order(nested)) visit(child, depth + 1, path);
  }
  for (const root of order(roots)) visit(root, 0);
  // Defensive against malformed cyclic data, while retaining scoped/filtered roots.
  for (const row of order([...rows])) if (!visited.has(row.id)) visit(row, 0);
  return result;
}
