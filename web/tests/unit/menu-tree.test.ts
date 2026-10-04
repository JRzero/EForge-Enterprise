import {expect, it} from 'vitest';
import type {MenuResponse} from '../../generated/api';
import {menuTree, menuParents} from '../../features/menus/tree';
const row = (id: string, parentId: string, type: MenuResponse['type'] = 'GROUP', sort = 0): MenuResponse => ({id, parentId, name: id, sort, type, status: '0', visible: true, cached: true});
it('orders menu IDs without losing large integer precision and collapses complete branches', () => {
  const rows = [row('9007199254740993', '0'), row('9007199254740992', '0'), row('3', '9007199254740992'), row('4', '3')];
  expect(menuTree(rows).map(item => item.menu.id)).toEqual(['9007199254740992', '3', '4', '9007199254740993']);
  expect(menuTree(rows, new Set(['9007199254740992'])).map(item => item.menu.id)).toEqual(['9007199254740992', '9007199254740993']);
});
it('retains filtered and scoped roots while excluding self, descendants and leaf parents', () => {
  const rows = [row('1', '0'), row('2', '1', 'ROUTE'), row('3', '2'), row('4', '0', 'FUNCTION'), row('5', '0', 'EXTERNAL'), row('6', '999')];
  expect(menuParents(rows, '2').map(item => item.menu.id)).toEqual(['1', '6']);
  expect(menuTree([row('3', '999')])[0]?.depth).toBe(0);
});
it('rejects duplicate identities and disconnected cycles instead of rendering invented routes', () => {
  expect(() => menuTree([row('1', '0'), row('1', '0')])).toThrow('重复');
  expect(() => menuTree([row('1', '2'), row('2', '1')])).toThrow('层级');
});
it('accepts the canonical maximum depth and rejects a deeper response', () => {
  const rows = Array.from({length: 64}, (_, index) => row(String(index + 1), String(index)));
  expect(menuTree(rows).length).toBe(64); expect(() => menuTree([...rows, row('65', '64')])).toThrow('层级');
});
