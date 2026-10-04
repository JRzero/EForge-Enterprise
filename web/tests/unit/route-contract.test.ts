import {expect, it} from 'vitest';
import {routes} from '../../app/routes';
import contracts from '../../app/route-contract.json';
import internalContracts from '../../app/internal-route-contract.json';
import {canAccessRoute} from '@eforge/app';
it('binds every seeded framework contract to an actual React route', () => {
  expect(routes.map(route => ({id: route.id, path: route.path, permission: route.access?.permission})))
    .toEqual([...contracts, ...internalContracts]);
});
it('allows authenticated self-service without inventing a backend menu permission', () => {
  const profile = routes.find(route => route.id === 'account-profile');
  expect(profile).toBeDefined(); expect(canAccessRoute(profile!, [])).toBe(true);
});
