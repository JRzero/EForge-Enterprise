import {describe, expect, it} from 'vitest';
import {matchAppRoute, type AppRoute} from '@eforge/app';
import {appendGeneratedRoutes} from '../../app/generated-business-routes';
import {projectNavigation} from '../../integration/navigation';

const route: AppRoute = {id: 'business-gen-' + 'a'.repeat(64), path: '/business/%E6%A8%A1%E5%9D%97/data',
  title: '数据', component: () => null, access: {permission: 'module:data:list'}};
describe('compiled generated route installation', () => {
  it('matches browser encoded Unicode paths and keeps backend permission navigation', () => {
    const routes = appendGeneratedRoutes([], [route]);
    expect(matchAppRoute(routes, new URL(route.path, 'https://example.com').pathname)?.route.id).toBe(route.id);
    const node = {key: route.id, type: 'ROUTE' as const, routeId: route.id, label: '数据', order: 0, children: []};
    expect(projectNavigation([node], routes, ['module:data:list'])[0]?.href).toBe(route.path);
    expect(projectNavigation([node], routes, [])).toEqual([]);
  });
  it('fails closed on duplicates, traversal and noncanonical paths', () => {
    expect(() => appendGeneratedRoutes([route], [route])).toThrow();
    for (const path of ['/business/%2e%2e/data', '/business/%5c/data', '/business/%00/data',
      '/business/:id', '/business/%2f/data', '/business/data?token=x', '/business/data#x', '/business/模块/data']) {
      expect(() => appendGeneratedRoutes([], [{...route, path}])).toThrow();
    }
    expect(() => appendGeneratedRoutes([], [{...route, id: 'database-component'}])).toThrow();
  });
});