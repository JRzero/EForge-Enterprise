import {describe, expect, it, vi} from 'vitest';
import {canAccessRoute} from '@eforge/app';
import type {NavigationNode} from '../../generated/api';
import {countNavigationEntries, projectNavigation} from '../../integration/navigation';
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
  it('keeps declared route paths for active state while queries and cache defaults remain data', () => {
    const result = projectNavigation([{...leaf,queryText:'{"id":"9007199254740999","__proto__":"value"}',cached:false}], [route], ['app:dashboard:view']);
    expect(result[0]?.path).toBe('/dashboard');expect(result[0]?.cached).toBe(false);
    expect(new URL(result[0]!.href!,'https://app.example').searchParams.get('id')).toBe('9007199254740999');
    const diagnostic=vi.fn();const invalid=projectNavigation([{...leaf,queryText:'{'}],[route],['app:dashboard:view'],diagnostic);
    expect(invalid[0]).toMatchObject({key:'dashboard',queryError:true});expect(invalid[0]?.href).toBeUndefined();
    expect(diagnostic).toHaveBeenCalledWith('Invalid navigation query for dashboard.');
  });
  it('counts every reachable route and external entry, including routes with children, but never groups', () => {
    const routes = [route,
      {id: 'users', path: '/user', title: '用户', access: {permission: 'system:user:list'}},
      {id: 'roles', path: '/role', title: '角色', access: {permission: 'system:role:list'}}];
    const nodes: NavigationNode[] = [{key: 'group', type: 'GROUP', label: '分组', order: 0, children: [
      {...leaf, children: [
        {key: 'users', type: 'ROUTE', routeId: 'users', label: '用户', order: 0, children: []},
        {key: 'roles', type: 'ROUTE', routeId: 'roles', label: '角色', order: 1, children: []}]},
      {key: 'docs', type: 'EXTERNAL', externalUrl: 'https://example.com/docs', label: '文档', order: 1, children: []},
      {key: 'unsafe', type: 'EXTERNAL', externalUrl: 'javascript:alert(1)', label: '无效', order: 2, children: []},
      {key: 'unknown', type: 'ROUTE', routeId: 'missing', label: '未知', order: 3, children: []}]}];
    const projected = projectNavigation(nodes, routes, ['app:dashboard:view', 'system:user:list'], vi.fn());
    expect(projected).toHaveLength(1);
    expect(countNavigationEntries(projected)).toBe(3);
    expect(countNavigationEntries(projectNavigation(nodes, routes, [], vi.fn()))).toBe(1);
    expect(countNavigationEntries([])).toBe(0);
  });
  it('excludes a route with invalid query data while retaining its reachable children in the count', () => {
    const projected = projectNavigation([{...leaf, queryText: '{', children: [
      {key: 'help', type: 'EXTERNAL', externalUrl: 'https://example.com/help', label: '帮助', order: 0, children: []}
    ]}], [route], ['app:dashboard:view'], vi.fn());
    expect(projected[0]?.queryError).toBe(true);
    expect(countNavigationEntries(projected)).toBe(1);
  });
});
