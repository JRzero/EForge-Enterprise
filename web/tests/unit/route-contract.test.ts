import {expect, it} from 'vitest';
import {routes} from '../../app/routes';
import contracts from '../../app/route-contract.json';
it('binds every seeded framework contract to an actual React route', () => {
  expect(routes.map(route => ({id: route.id, path: route.path, permission: route.access?.permission})))
    .toEqual(contracts);
});
