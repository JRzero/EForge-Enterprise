import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defineAppRoutes, matchAppRoute, canAccessRoute} from '@eforge/app';
import {Button} from '@eforge/ui';

test('packed route runtime preserves matching and permission checks', () => {
  const routes = defineAppRoutes([{id: 'fixture', path: '/fixture/:id', title: 'Fixture',
    access: {permission: 'fixture:read'}, component: () => null}]);
  assert.equal(matchAppRoute(routes, '/fixture/42')?.params.id, '42');
  assert.equal(canAccessRoute(routes[0], []), false);
  assert.equal(canAccessRoute(routes[0], ['fixture:read']), true);
});

test('packed UI component renders through its public EForge export', () => {
  assert.match(renderToStaticMarkup(createElement(Button, {label: 'Package ready'})), /Package ready/);
});
