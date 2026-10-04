import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: normalize-openapi.mjs input.json output.json');
const spec = JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
if (!spec.paths['/api/v1/auth/login'] || !spec.paths['/api/v1/app/bootstrap'] ||
    Object.keys(spec.paths).some(path => !path.startsWith('/api/v1/'))) {
  throw new Error('Expected the authenticated canonical OpenAPI group only.');
}
// The server port belongs to the export environment, not the API contract.
spec.servers = [{url: '/'}];
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, JSON.stringify(stable(spec), null, 2) + '\n');
