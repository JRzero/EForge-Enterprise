import {writeFileSync} from 'node:fs';
import {join, basename} from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium, expect} from '@playwright/test';
export async function verifyBrowser(root, owned, backend, noRoleUser) {
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(backend), 'Owned backend URL required.');
  for (const category of ['crud', 'tree', 'sub']) {
    writeFileSync(join(owned, category, 'index.html'), '<div id="root"></div><script type="module" src="./probe.tsx"></script>');
    writeFileSync(join(owned, category, 'probe.tsx'), [
      "import {createRoot} from 'react-dom/client';",
      "import {useSyncExternalStore} from 'react';",
      "import {createMemoryStorage} from '@eforge/core';",
      "import {EForgeProvider} from '@eforge/ui';",
      "import {PermissionProvider} from '@eforge/patterns';",
      "import '@eforge/tokens/styles.css'; import '@eforge/ui/styles.css'; import '@eforge/patterns/styles.css'; import '@eforge/data/styles.css'; import '../../../app/styles.css';",
      "import {ApiContext, BootstrapContext} from '../../../app/context';",
      "import {createSessionRuntime} from '../../../integration/session';",
      "import {toEForgePermissions} from '../../../integration/permissions';",
      "import {GeneratedPage} from './Page';",
      "const runtime = createSessionRuntime(createMemoryStorage());",
      "Object.assign(window, {probeLogin:runtime.login, probeLogout:runtime.logout, probeDetail:async (id:string) => {try {const response = await runtime.api.authenticatedFetch('/api/v1/business/fixture/" + category + "/' + id); return {status:response.status, data:await response.json()};} catch(error) {return {status:(error as {status:number}).status};}}});",
      "function Probe() {const session = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot); if (session.phase !== 'authenticated') return <p>正在等待实际登录</p>; return <EForgeProvider><ApiContext.Provider value={runtime.api}><BootstrapContext.Provider value={session.bootstrap}><PermissionProvider permissions={toEForgePermissions(session.bootstrap.permissions)}><GeneratedPage /></PermissionProvider></BootstrapContext.Provider></ApiContext.Provider></EForgeProvider>;}",
      "createRoot(document.getElementById('root')!).render(<Probe />);",
    ].join('\n'));
  }
  const server = await createServer({configFile:false, root, server:{host:'127.0.0.1', port:0,
    proxy:Object.fromEntries(['/api', '/common', '/profile', '/logout'].map(path => [path, {target:backend, changeOrigin:false}]))}});
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address(); assert(address && typeof address === 'object');
    browser = await chromium.launch({headless:true});
    for (const [ordinal, category] of ['crud', 'tree', 'sub'].entries()) {
      const context = await browser.newContext({acceptDownloads:true});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto('http://127.0.0.1:' + address.port + '/features/' + basename(owned) + '/' + category + '/index.html');
        await page.waitForFunction(() => typeof window.probeLogin === 'function');
        await page.evaluate(() => window.probeLogin({username:'admin', password:'admin123'}));
        await expect(page.getByRole('button', {name:'新增', exact:true})).toBeVisible();
        const id = String(9007199254741001n + BigInt(ordinal));
        const label = '浏览器-' + category + '-<img src=x onerror=window.injected=true>';
        await page.getByRole('button', {name:'新增', exact:true}).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('oRderKey', {exact:true}).fill(id);
        await dialog.getByLabel('label', {exact:true}).first().fill(label);
        await dialog.getByLabel('amount', {exact:true}).fill('9007199254740993.00001');
        if (category !== 'tree') await dialog.getByLabel('parentId', {exact:true}).fill('0');
        if (category === 'sub') {
          await dialog.getByRole('button', {name:'新增子表行'}).click();
          await dialog.getByLabel('label', {exact:true}).last().fill('浏览器子表');
        }
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText(label, {exact:true})).toBeVisible();
        const detail = await page.evaluate(id => window.probeDetail(id), id);
        assert.equal(detail.status, 200); assert.equal(detail.data.oRderKey, id);
        assert.equal(detail.data.amount, '9007199254740993.00001');
        if (category === 'tree') assert.equal(detail.data.parentId, '0');
        if (category === 'sub') {
          assert.equal(detail.data.fixtureLineList[0].label, '浏览器子表');
          assert.equal(detail.data.fixtureLineList[0].ownerReference, id);
        }
        const row = page.getByRole('row').filter({has:page.getByText(label, {exact:true})});
        await row.getByRole('button', {name:'修改', exact:true}).click();
        await dialog.getByLabel('label', {exact:true}).first().fill(label + '-修改');
        if (category === 'sub') await dialog.getByLabel('label', {exact:true}).last().fill('浏览器子表-修改');
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        const updated = page.getByRole('row').filter({has:page.getByText(label + '-修改', {exact:true})});
        await expect(updated).toBeVisible();
        await updated.getByRole('button', {name:'详情', exact:true}).click();
        await expect(dialog).toContainText(label + '-修改');
        await expect(dialog.getByRole('button', {name:'保存', exact:true})).toHaveCount(0);
        await dialog.getByRole('button', {name:'取消', exact:true}).click();
        if (category === 'sub') {
          const saved = await page.evaluate(id => window.probeDetail(id), id);
          assert.equal(saved.data.fixtureLineList.length, 1);
          assert.equal(saved.data.fixtureLineList[0].label, '浏览器子表-修改');
          assert.equal(saved.data.fixtureLineList[0].ownerReference, id);
        }
        const absent = 'no-match-' + id;
        await page.getByRole('textbox', {name:'label', exact:true}).fill(absent);
        const filteredResponse = page.waitForResponse(response => {
          const url = new URL(response.url());
          return url.pathname === '/api/v1/business/fixture/' + category && url.searchParams.get('q_label') === absent && response.request().method() === 'GET';
        });
        await page.getByRole('button', {name:'搜索', exact:true}).click();
        const filtered = await filteredResponse; assert.equal(filtered.status(), 200);
        const filteredData = await filtered.json();
        assert.equal((category === 'tree' ? filteredData : filteredData.items).length, 0);
        await expect(updated).toHaveCount(0);
        await page.getByRole('textbox', {name:'label', exact:true}).fill(label + '-修改');
        await page.getByRole('button', {name:'搜索', exact:true}).click();
        await expect(updated).toBeVisible();
        await page.getByRole('button', {name:'重置', exact:true}).click();
        if (category === 'tree') {
          const childId = String(BigInt(id) + 100n), childLabel = label + '-下级';
          await updated.getByRole('button', {name:'新增下级', exact:true}).click();
          await dialog.getByLabel('oRderKey', {exact:true}).fill(childId);
          await dialog.getByLabel('label', {exact:true}).fill(childLabel);
          await expect(dialog.getByRole('combobox', {name:'parentId', exact:true})).toHaveValue(id);
          await dialog.getByRole('button', {name:'保存', exact:true}).click();
          await expect(dialog).toHaveCount(0);
          await page.getByRole('button', {name:'展开全部', exact:true}).click();
          const childRow = page.getByRole('row').filter({has:page.getByText(childLabel, {exact:true})});
          await expect(childRow).toBeVisible();
          assert.equal((await page.evaluate(id => window.probeDetail(id), childId)).data.parentId, id);
          await page.getByRole('button', {name:'收起全部', exact:true}).click();
          await expect(childRow).toHaveCount(0);
          await page.getByRole('button', {name:'展开全部', exact:true}).click();
          await childRow.getByRole('button', {name:'删除', exact:true}).click();
          await page.getByRole('button', {name:'确认删除', exact:true}).click();
          await expect(childRow).toHaveCount(0);
        }
        const downloadEvent = page.waitForEvent('download');
        await page.getByRole('button', {name:'导出', exact:true}).click();
        assert((await downloadEvent).suggestedFilename().endsWith('.xlsx'));
        const peerId = String(BigInt(id) + 200n), peerLabel = label + '-并选';
        await page.getByRole('button', {name:'新增', exact:true}).click();
        await dialog.getByLabel('oRderKey', {exact:true}).fill(peerId);
        await dialog.getByLabel('label', {exact:true}).first().fill(peerLabel);
        if (category !== 'tree') await dialog.getByLabel('parentId', {exact:true}).fill('0');
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        const peerRow = page.getByRole('row').filter({has:page.getByText(peerLabel, {exact:true})});
        await expect(peerRow).toBeVisible();
        await updated.getByRole('checkbox').check();
        await page.getByRole('button', {name:'修改选中', exact:true}).click();
        await expect(dialog.getByLabel('label', {exact:true}).first()).toHaveValue(label + '-修改');
        await dialog.getByRole('button', {name:'取消', exact:true}).click();
        await peerRow.getByRole('checkbox').check();
        await expect(page.getByRole('button', {name:'修改选中', exact:true})).toBeDisabled();
        await page.getByRole('button', {name:'删除选中', exact:true}).click();
        await page.getByRole('button', {name:'确认删除', exact:true}).click();
        await expect(updated).toHaveCount(0);
        assert.equal(await page.evaluate(() => window.injected === true), false);
        assert.deepEqual(errors, []);
        await page.evaluate(() => window.probeLogout());
        await page.evaluate(username => window.probeLogin({username, password:'admin123'}), noRoleUser);
        await expect(page.getByRole('button', {name:'新增', exact:true})).toHaveCount(0);
        assert.equal((await page.evaluate(id => window.probeDetail(id), id)).status, 403);
        await page.evaluate(() => window.probeLogout());
      } finally {await context.close();}
    }
    console.log('PASS: actual generated React CRUD/tree/sub create/edit/detail/search/reset/tree/sub update/bulk selection/XLSX/delete, exact IDs/decimal/root-parent/sub FK, literal HTML and no-role backend denial.');
  } finally {await browser?.close(); await server.close();}
}