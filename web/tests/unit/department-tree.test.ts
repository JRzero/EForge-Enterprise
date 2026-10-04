import {expect, it} from 'vitest';
import {departmentTree} from '../../features/departments/tree';
import type {DepartmentResponse} from '../../generated/api';
const row = (id: string, parentId: string, sort = 0): DepartmentResponse => ({id, parentId, sort, name: id, status: '0'});
it('preserves scoped roots without inventing out-of-scope parents', () => {
  expect(departmentTree([row('105', '101')]).map(item => [item.department.id, item.depth])).toEqual([['105', 0]]);
  expect(departmentTree([row('105', '101')])[0]?.path).toBe('105');
});
it('parent choices distinguish same-name departments using only visible ancestry', () => {
  const departments = [row('100', '0'), row('101', '100'), row('102', '100'), {...row('103', '101'), name: '同名部门'}, {...row('104', '102'), name: '同名部门'}];
  expect(departmentTree(departments).filter(item => item.department.name === '同名部门').map(item => item.path))
    .toEqual(['100 / 101 / 同名部门', '100 / 102 / 同名部门']);
});
it('orders siblings with exact large identities and projects all descendants', () => {
  expect(departmentTree([row('9007199254740993', '100'), row('100', '0'), row('9007199254740992', '100'), row('200', '9007199254740992')])
    .map(item => [item.department.id, item.depth])).toEqual([['100', 0], ['9007199254740992', 1], ['200', 2], ['9007199254740993', 1]]);
});
it('collapsed descendants stay hidden instead of reappearing as orphan roots', () => {
  expect(departmentTree([row('100', '0'), row('101', '100'), row('102', '101')], new Set(['100']))
    .map(item => item.department.id)).toEqual(['100']);
});
it('malformed cycles terminate and retain each visible identity once', () => {
  expect(departmentTree([row('100', '101'), row('101', '100')]).map(item => item.department.id)).toEqual(['100', '101']);
});
