import {expect, it} from 'vitest';
import {grantForest, grantState, linkedSeeds, submittedGrants, toggleGrant} from '../../features/roles/grants';
const nodes = [{key: 'root', label: '系统'}, {key: 'users', parentKey: 'root', label: '用户'}, {key: 'read', parentKey: 'users', label: '查询'}, {key: 'write', parentKey: 'users', label: '修改'}, {key: 'posts', parentKey: 'root', label: '岗位'}];
it('submits half-checked ancestors without granting unselected siblings', () => {
  const state = grantState(nodes, ['read'], true);
  expect([...state.full]).toEqual(['read']); expect([...state.half]).toEqual(['users', 'root']);
  expect(new Set(submittedGrants(nodes, ['read'], true))).toEqual(new Set(['read', 'users', 'root']));
  expect(state.full.has('write')).toBe(false);
});
it('opening a linked parent-only assignment never grants unselected descendants', () => {
  const state = grantState(nodes, ['root'], true);
  expect([...state.full]).toEqual(['root']); expect(state.half.size).toBe(0);
  expect(submittedGrants(nodes, ['root'], true)).toEqual(['root']);
  const clicked = toggleGrant(nodes, ['root'], 'root', true, true);
  expect(grantState(nodes, clicked, true).full.size).toBe(5);
});
it('linked parent selection cascades and removing a child preserves its siblings', () => {
  const all = toggleGrant(nodes, [], 'root', true, true);
  expect(grantState(nodes, all, true).full.size).toBe(5);
  const reduced = toggleGrant(nodes, all, 'write', false, true); const state = grantState(nodes, reduced, true);
  expect(state.full.has('write')).toBe(false); expect(state.full.has('read')).toBe(true); expect(state.full.has('posts')).toBe(true); expect(state.half.has('root')).toBe(true);
  const removed = toggleGrant(nodes, reduced, 'users', false, true);
  expect(new Set(submittedGrants(nodes, removed, true))).toEqual(new Set(['posts', 'root']));
});
it('independent selection does not cascade and an existing partial raw selection survives linking', () => {
  expect(submittedGrants(nodes, ['root'], false)).toEqual(['root']);
  expect(toggleGrant(nodes, ['root'], 'read', true, false)).toEqual(['root', 'read']);
  const seeds = linkedSeeds(nodes, ['root', 'users', 'read']); expect(seeds).toEqual(['read']);
  expect(new Set(submittedGrants(nodes, seeds, true))).toEqual(new Set(['read', 'users', 'root']));
});
it('keeps unavailable existing grants while treating scoped detached parents as roots', () => {
  expect(submittedGrants(nodes, ['read', 'unavailable'], true)).toContain('unavailable');
  expect(grantForest([{key: 'scoped', parentKey: 'outside', label: '范围内'}])[0]?.path).toBe('范围内');
});
it('rejects duplicate identities and cycles before rendering', () => {
  expect(() => grantForest([{key: 'a', label: 'A'}, {key: 'a', label: 'B'}])).toThrow();
  expect(() => grantForest([{key: 'a', parentKey: 'b', label: 'A'}, {key: 'b', parentKey: 'a', label: 'B'}])).toThrow();
});
