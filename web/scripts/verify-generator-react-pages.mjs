import {readFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve, dirname, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {ESLint} from 'eslint';
import {build} from 'vite';
import {verifyBrowser} from './verify-generator-react-browser.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [deployment, contract] = process.argv.slice(2, 4).map(value => resolve(value));
const allowed = resolve(root, '../server/eforge-boot/target/auth-integration');
assert(deployment.startsWith(allowed + sep) && deployment.slice(allowed.length + 1).startsWith('generated-business-'));
const owned = mkdtempSync(join(root, 'features/react-probe-'));
try {
  const sources = [];
  for (const category of ['crud', 'tree', 'sub']) {
    const destination = join(owned, category); mkdirSync(destination);
    for (const name of ['Page.tsx', 'route.ts', 'generate-client.mjs']) {
      copyFileSync(join(deployment, 'web/features/fixture', category, name), join(destination, name));
    }
    const generated = spawnSync(process.execPath, [join(destination, 'generate-client.mjs'), contract], {encoding:'utf8'});
    assert.equal(generated.status, 0, generated.stderr);
    sources.push(join(destination, 'Page.tsx'), join(destination, 'route.ts'));
    assert(!readFileSync(join(destination, 'Page.tsx'), 'utf8').includes('<template>'));
  }
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const host = ts.createCompilerHost(parsed.options); host.getCurrentDirectory = () => root;
  const program = ts.createProgram(sources, parsed.options, host);
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: value => value, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  const lint = new ESLint({cwd: root});
  const results = await lint.lintFiles(sources);
  const formatter = await lint.loadFormatter('stylish');
  assert.equal(results.reduce((total, result) => total + result.errorCount + result.warningCount, 0), 0, formatter.format(results));
  console.log('PASS: actual generated CRUD/tree/sub React pages and static routes compile against real pinned EForge and actual generated OpenAPI clients.');
  await build({root, configFile:join(root, 'vite.config.ts'), build:{outDir:join(deployment, 'installed-web-build'), emptyOutDir:true}});
  console.log('PASS: actual host production build includes installed generated pages and compiled static route declarations.');
  await verifyBrowser(root, owned, process.argv[4], process.argv[5]);
} finally {
  assert(owned.startsWith(resolve(root, 'features') + sep) && owned.slice(resolve(root, 'features').length + 1).startsWith('react-probe-'));
  rmSync(owned, {recursive:true, force:true});
}