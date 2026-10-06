// Tests real generated contracts; owns only its uniquely created temporary directory.
import {readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {resolve, dirname, join, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {Blob} from 'node:buffer';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [contract, baseUrl, category, functionPrefix = 'testEntry'] = process.argv.slice(2);
assert(['testEntry', 'fixtureCrud', 'fixtureTree', 'fixtureSub'].includes(functionPrefix));
assert(['crud', 'tree', 'sub'].includes(category));
const url = new URL(baseUrl);
assert.equal(url.hostname, '127.0.0.1');
const owned = mkdtempSync(join(root, '.business-client-'));
try {
  const packageRoot = resolve(root, 'node_modules/oazapfts');
  const generator = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const cli = resolve(packageRoot, generator.bin.oazapfts);
  for (const name of ['client.ts', 'repeat.ts']) {
    const generated = spawnSync(process.execPath, [cli, resolve(contract), join(owned, name), '--useUnknown'], {encoding: 'utf8'});
    assert.equal(generated.status, 0, generated.stderr);
  }
  assert.equal(readFileSync(join(owned, 'client.ts'), 'utf8'), readFileSync(join(owned, 'repeat.ts'), 'utf8'));
  writeFileSync(join(owned, 'types.ts'), `import * as client from './client.js';
client.${functionPrefix}Detail('9007199254740995');
client.${functionPrefix}Delete({ids:['9007199254740995']});
client.${functionPrefix}List({qBeginAmount:'9007199254740993.00001'});
// @ts-expect-error IDs must stay strings
client.${functionPrefix}Detail(9007199254740995);
// @ts-expect-error bulk IDs must stay strings
client.${functionPrefix}Delete({ids:[9007199254740995]});
// @ts-expect-error decimal filters must stay strings
client.${functionPrefix}List({qBeginAmount:9007199254740993.00001});
`);
  const options = {strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: false, outDir: owned};
  const program = ts.createProgram([join(owned, 'client.ts'), join(owned, 'types.ts')], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: value => value, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  assert.equal(program.emit().emitSkipped, false);
  const client = await import(pathToFileURL(join(owned, 'client.js')).href);
  client.defaults.baseUrl = baseUrl;
  const methods = Object.fromEntries(['Detail', 'Create', 'Update', 'List', 'Export', 'Delete'].map(name => [name, client[functionPrefix + name]]));
  for (const method of Object.values(methods)) assert.equal(typeof method, 'function');
  if (process.env.EFORGE_GENERATED_CLIENT_TOKEN) client.defaults.headers = {Authorization: `Bearer ${process.env.EFORGE_GENERATED_CLIENT_TOKEN}`};
  const detail = await methods.Detail('9007199254740995');
  assert.equal(detail.status, 200); assert.equal(detail.data.oRderKey, '9007199254740995');
  const input = {oRderKey:'9007199254740997', label:'客户端中文', parentId:'0', amount:'9007199254740993.00001'};
  if (category === 'sub') input[functionPrefix === 'fixtureSub' ? 'fixtureLineList' : 'apiLineList'] = [{label:'客户端子表', ownerReference:'1'}];
  const created = await methods.Create(input);
  assert.equal(created.status, 201); assert.equal(created.data.oRderKey, input.oRderKey);
  assert.equal(created.data.amount, input.amount);
  const updated = await methods.Update(input.oRderKey, {...input, label:'客户端更新'});
  assert.equal(updated.status, 200); assert.equal(updated.data.label, '客户端更新');
  const listed = await methods.List({qLabel:'客户端更新', qBeginAmount:input.amount, qEndAmount:input.amount});
  assert.equal(listed.status, 200);
  assert.equal(category === 'tree' ? listed.data.length : listed.data.total, 1);
  const exported = await methods.Export({qLabel:'客户端更新'});
  assert.equal(exported.status, 200); assert(exported.data instanceof Blob);
  const archive = new Uint8Array(await exported.data.arrayBuffer());
  assert.equal(archive[0], 0x50); assert.equal(archive[1], 0x4b);
  const deleted = await methods.Delete({ids:[input.oRderKey]});
  assert.equal(deleted.status, 204);
  console.log(`PASS: generated ${category} OpenAPI client reproducibility, strict string types and actual HTTP CRUD/filter/XLSX.`);
} finally {
  assert(owned.startsWith(root + sep) && owned.slice(root.length + 1).startsWith('.business-client-'));
  if (existsSync(owned)) rmSync(owned, {recursive:true, force:true});
}
