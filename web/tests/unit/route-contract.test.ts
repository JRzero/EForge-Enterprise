import {expect, it} from 'vitest';
import {routes} from '../../app/routes';
import contracts from '../../app/route-contract.json';
import internalContracts from '../../app/internal-route-contract.json';
import {canAccessRoute, matchAppRoute} from '@eforge/app';
it('binds every seeded framework contract to an actual React route', () => {
  expect(routes.map(route => ({id: route.id, path: route.path, permission: route.access?.permission})))
    .toEqual([...contracts, ...internalContracts]);
});
it('allows authenticated self-service without inventing a backend menu permission', () => {
  const profile = routes.find(route => route.id === 'account-profile');
  expect(profile).toBeDefined(); expect(canAccessRoute(profile!, [])).toBe(true);
});
it('protects the workflow create page with edit permission even on a direct URL',()=>{
  const match=matchAppRoute(routes,'/workflow/packages/new');
  expect(match?.route.id).toBe('workflow-package-create');
  expect(canAccessRoute(match!.route,['workflow:definition:list'])).toBe(false);
  expect(canAccessRoute(match!.route,['workflow:definition:edit'])).toBe(true);
});
it('matches explicit role user parameters and enforces the original list permission', () => {
  const matched = matchAppRoute(routes, '/role/users/9007199254740993');
  expect(matched?.route.id).toBe('role-users'); expect(matched?.params.roleId).toBe('9007199254740993');
  expect(canAccessRoute(matched!.route, [])).toBe(false);
  expect(canAccessRoute(matched!.route, ['system:role:list'])).toBe(true);
  expect(matchAppRoute(routes, '/role/users/2/extra')).toBeNull();
});
