import {readFileSync} from 'node:fs';
const contracts = JSON.parse(readFileSync(new URL('../app/route-contract.json', import.meta.url), 'utf8'));
const seeds = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const known = new Map(contracts.map(route => [route.id, route]));
const bound = new Set();
for (const seed of seeds) {
  const route = known.get(seed.routeId);
  if (!route || bound.has(seed.routeId) || route.permission !== seed.permission ||
      route.path !== '/' + seed.path) throw new Error(`Invalid seed binding: ${seed.routeId}`);
  bound.add(seed.routeId);
}
if (bound.size !== known.size) throw new Error('Implemented framework routes must have an explicit seed binding.');
console.log('PASS: seeded navigation route identities, URLs and permissions match the frontend registry.');
