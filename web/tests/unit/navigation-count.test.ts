import {expect, it} from 'vitest';
import {countNavigationEntries, type NavigationItem} from '../../integration/navigation';
it('counts nested projected links, including route parents, but not groups or failed bindings', () => {
  const items: NavigationItem[] = [{key: 'group', label: '管理', children: [
    {key: 'route-parent', label: '主页', href: '/home', children: [{key: 'child', label: '明细', href: '/home/detail', children: []}]},
    {key: 'external', label: '帮助', href: 'https://example.com/', external: true, children: []},
    {key: 'invalid', label: '无效参数', queryError: true, children: []}
  ]}];
  expect(countNavigationEntries(items)).toBe(3);
  expect(countNavigationEntries([])).toBe(0);
});
