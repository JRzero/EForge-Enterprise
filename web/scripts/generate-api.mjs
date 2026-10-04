import {readFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'generated/api.ts');
const checking = process.argv.includes('--check');
const before = checking ? readFileSync(output, 'utf8').replace(/\r\n/g, '\n') : null;
mkdirSync(dirname(output), {recursive: true});
const generator = JSON.parse(readFileSync(resolve(root, 'node_modules/oazapfts/package.json'), 'utf8'));
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/oazapfts', generator.bin.oazapfts),
  resolve(root, '../contracts/openapi/api-v1.json'), output, '--useUnknown'], {stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
if (checking && before !== readFileSync(output, 'utf8').replace(/\r\n/g, '\n')) {
  throw new Error('Generated API differs from the committed client. Regenerate and review the server contract.');
}
console.log(checking ? 'PASS: generated OpenAPI client is reproducible.' : 'Generated the canonical API client.');
