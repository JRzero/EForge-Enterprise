/** Vue-compatible query values, encoded only as URL data on a registered route. */
function queryValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => item == null ? '' : queryValue(item)).join(',');
  if (value !== null && typeof value === 'object') return '[object Object]';
  return String(value);
}
export function menuQueryHref(path: string, queryText?: string): string {
  if (!queryText?.trim()) return path;
  const parsed: unknown = JSON.parse(queryText);
  if (parsed === null || typeof parsed !== 'object') throw new Error('Invalid menu query');
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      pairs.push(encodeURIComponent(key) + (item === null ? '' : '=' + encodeURIComponent(queryValue(item))));
    }
  }
  return path + (pairs.length ? '?' + pairs.join('&') : '');
}