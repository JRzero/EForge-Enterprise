import {describe, expect, it, vi} from 'vitest';
import {canAccessRoute} from '@eforge/app';
import type {NavigationNode} from '../../generated/api';
import {projectNavigation} from '../../integration/navigation';
import {toEForgePermissions} from '../../integration/permissions';
const route = {id: 'dashboard', path: '/dashboard', title: '工作台', access: {permission: 'app:dashboard:view'}};
const leaf: NavigationNode = {key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []};
describe('backend navigation to public EForge routes', () => {
  it('retains a group without inventing a URL and prunes inaccessible routes', () => {
    const group: NavigationNode = {key: 'workspace', type: 'GROUP', label: '空间', order: 0, children: [leaf]};
    const allowed = projectNavigation([group], [route], ['app:dashboard:view']);
    expect(allowed[0]?.href).toBeUndefined();
    expect(allowed[0]?.children[0]?.href).toBe('/dashboard');
    expect(projectNavigation([group], [route], [])).toEqual([]);
    expect(canAccessRoute(route, [])).toBe(false);
    expect(canAccessRoute(route, toEForgePermissions(['*:*:*']))).toBe(true);
    expect(projectNavigation([group], [route], ['*:*:*'])).toHaveLength(1);
  });
  it('omits unknown routes and their subtrees with diagnostics', () => {
    const diagnostic = vi.fn();
    expect(projectNavigation([{...leaf, routeId: 'unknown', children: [{...leaf, key: 'child'}]}],
      [route], ['*:*:*'], diagnostic)).toEqual([]);
    expect(diagnostic).toHaveBeenCalledWith('Unknown navigation route: unknown');
  });
  it('rejects unsafe external schemes, credentials and duplicate identities', () => {
    const external = (url: string, key: string): NavigationNode => ({key, type: 'EXTERNAL', externalUrl: url,
      label: '文档', order: 0, children: []});
    expect(projectNavigation([external('javascript:alert(1)', 'js'), external('https://a:b@example.com', 'secret')], [], [])).toEqual([]);
    const diagnostic = vi.fn();
    const result = projectNavigation([external('https://example.com', 'docs'), external('https://other.com', 'docs')], [], [], diagnostic);
    expect(result).toHaveLength(1);
    expect(result[0]?.external).toBe(true);
    expect(diagnostic).toHaveBeenCalledOnce();
  });
});
