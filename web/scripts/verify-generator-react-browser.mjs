import {Buffer} from 'node:buffer';
import {writeFileSync} from 'node:fs';
import {join, basename} from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium, expect} from '@playwright/test';
// Cross the browser automation boundary as JSON text so legal prototype-like keys stay own data properties.
async function readDetail(page,id) {
  return JSON.parse(await page.evaluate(async value => JSON.stringify(await window.probeDetail(value)),id));
}
export async function verifyBrowser(root, owned, backend, noRoleUser) {
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(backend), 'Owned backend URL required.');
  for (const category of ['crud', 'tree', 'sub']) {
    writeFileSync(join(owned, category, 'index.html'), '<div id="root"></div><script type="module" src="./probe.tsx"></script>');
    writeFileSync(join(owned, category, 'probe.tsx'), [
      "import {createRoot} from 'react-dom/client';",
      "import {createMemoryRouterAdapter} from '@eforge/app';",
      "import {createMemoryStorage} from '@eforge/core';",
      "import {EForgeProvider} from '@eforge/ui';",
      "import {PermissionProvider} from '@eforge/patterns';",
      "import '@eforge/tokens/styles.css'; import '@eforge/ui/styles.css'; import '@eforge/patterns/styles.css'; import '@eforge/data/styles.css'; import '../../../app/styles.css';",
      "import {ApiContext, BootstrapContext} from '../../../app/context';",
      "import {createSessionRuntime} from '../../../integration/session';",
      "import {toEForgePermissions} from '../../../integration/permissions';",
      "import {Application} from '../../../app/Application';",
      "import {generatedRoute} from './route';",
      "const runtime = createSessionRuntime(createMemoryStorage()); const router=createMemoryRouterAdapter('/dashboard');",
      "Object.assign(window, {probeLogin:runtime.login, probeLogout:runtime.logout, probeDetail:async (id:string) => {try {const response = await runtime.api.authenticatedFetch('/api/v1/business/fixture/" + category + "/' + id); return {status:response.status, data:await response.json()};} catch(error) {return {status:(error as {status:number}).status};}}});",
      "function Probe() {return <EForgeProvider><Application runtime={runtime} router={router} /></EForgeProvider>;}",
      "Object.assign(window,{probeNavigate:()=>router.navigate(generatedRoute.path),probeHref:router.getCurrentHref});",
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
        const installedLink = page.getByRole('link', {name:'Installed ' + category, exact:true});
        await expect(installedLink).toBeVisible();
        await installedLink.click();
        assert((await page.evaluate(() => window.probeHref())).startsWith('/business/fixture/'));
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
        if (category === 'crud') {
          await dialog.getByLabel('notes', {exact:true}).fill('多行中文\n<script>保持文本</script>');
          await dialog.locator('label').filter({hasText:/^selectedStatus/}).locator('select').selectOption('1');
          await dialog.locator('label').filter({hasText:/^radioStatus/}).getByRole('radio').first().check();
          const checks=dialog.locator('label').filter({hasText:/^checkedStatuses/}).getByRole('checkbox');
          await checks.first().check();await checks.last().check();
          await dialog.getByLabel('eventTime', {exact:true}).fill('2026-10-07T01:02:03.456');
          await dialog.getByLabel('enabled', {exact:true}).fill('true'); await dialog.getByLabel('quantity', {exact:true}).fill('17');await dialog.getByLabel('ratio', {exact:true}).fill('0.125');
          await dialog.getByLabel('__proto__', {exact:true}).fill('合法字段保持精确');
          await dialog.getByRole('textbox', {name:'公告内容', exact:true}).fill('生成富文本中文');
          await dialog.locator('label').filter({hasText:/^imagePaths/}).locator('input[type=file]').setInputFiles(join(root,'tests/fixtures/avatar.png'));
          await expect(dialog.locator('label').filter({hasText:/^imagePaths/})).toContainText('移除文件');
          await dialog.locator('label').filter({hasText:/^filePaths/}).locator('input[type=file]').setInputFiles({name:'生成文本.txt',mimeType:'text/plain',buffer:Buffer.from('实际文件内容')});
          await expect(dialog.locator('label').filter({hasText:/^filePaths/})).toContainText('移除文件');
          await expect(dialog.getByRole('button', {name:'保存',exact:true})).toBeEnabled();
        }
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText(label, {exact:true})).toBeVisible();
        const detail = await readDetail(page,id);
        assert.equal(detail.status, 200); assert.equal(detail.data.oRderKey, id);
        assert.equal(detail.data.amount, '9007199254740993.00001');
        if(category==='crud') {
          assert.equal(detail.data.notes,'多行中文\n<script>保持文本</script>');assert.equal(detail.data.selectedStatus,'1');assert.equal(detail.data.radioStatus,'0');
          assert.equal(detail.data.enabled,true);assert.equal(detail.data.checkedStatuses,'0,1');assert.equal(detail.data.quantity,17);assert.equal(detail.data.ratio,0.125);
          assert.equal(detail.data.__proto__,'合法字段保持精确');assert(detail.data.richContent.includes('生成富文本中文'));
          assert.equal(new Date(detail.data.eventTime).getTime(),await page.evaluate(() => new Date('2026-10-07T01:02:03.456').getTime()));
          for(const key of ['imagePaths','filePaths']) {assert(detail.data[key].startsWith('/profile/upload/'));const served=await page.request.get(new URL(detail.data[key],page.url()).href);assert.equal(served.status(),200);if(key==='filePaths')assert.equal(await served.text(),'实际文件内容');}
        }
        if (category === 'tree') assert.equal(detail.data.parentId, '0');
        if (category === 'sub') {
          assert.equal(detail.data.fixtureLineList[0].label, '浏览器子表');
          assert.equal(detail.data.fixtureLineList[0].ownerReference, id);
        }
        const row = page.getByRole('row').filter({has:page.getByText(label, {exact:true})});
        await row.getByRole('button', {name:'修改', exact:true}).click();
        await dialog.getByLabel('label', {exact:true}).first().fill(label + '-修改');
        if (category === 'sub') await dialog.getByLabel('label', {exact:true}).last().fill('浏览器子表-修改');
        if(category==='crud') {
          await dialog.locator('label').filter({hasText:/^notes/}).locator('textarea').fill('');
          await dialog.getByLabel('__proto__',{exact:true}).fill('');
          await dialog.locator('label').filter({hasText:/^selectedStatus/}).locator('select').selectOption('');
          await dialog.locator('label').filter({hasText:/^radioStatus/}).getByRole('radio').last().check();
          const checks=dialog.locator('label').filter({hasText:/^checkedStatuses/}).getByRole('checkbox');await checks.first().uncheck();await checks.last().uncheck();
          await dialog.getByLabel('enabled',{exact:true}).fill('false');await dialog.getByLabel('quantity',{exact:true}).fill('0');await dialog.getByLabel('ratio',{exact:true}).fill('0');
          await dialog.getByRole('textbox',{name:'公告内容',exact:true}).fill('');
          for(const field of ['imagePaths','filePaths'])await dialog.locator('label').filter({hasText:new RegExp('^'+field)}).getByRole('button',{name:'移除文件',exact:true}).click();
        }
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        const updated = page.getByRole('row').filter({has:page.getByText(label + '-修改', {exact:true})});
        await expect(updated).toBeVisible();
        if(category==='crud') {
          const changed=await readDetail(page,id);assert.equal(changed.status,200);
          for(const key of ['notes','__proto__','selectedStatus','checkedStatuses','imagePaths','filePaths','richContent'])assert.equal(changed.data[key],'','Cleared field '+key+' must persist');
          assert.equal(changed.data.enabled,false);assert.equal(changed.data.radioStatus,'1');assert.equal(changed.data.quantity,0);assert.equal(changed.data.ratio,0);
          for(const key of ['selectedStatus','radioStatus']) {
            const choice=key==='selectedStatus'?'1':'0';await page.getByRole('combobox',{name:key,exact:true}).selectOption(choice);
            const response=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/business/fixture/crud'&&url.searchParams.get('q_'+key)===choice&&response.request().method()==='GET';});
            await page.getByRole('button',{name:'搜索',exact:true}).click();const filtered=await response;assert.equal(filtered.status(),200);assert.equal((await filtered.json()).items.length,0);await expect(updated).toHaveCount(0);
            await page.getByRole('button',{name:'重置',exact:true}).click();await expect(updated).toBeVisible();
          }
        }
        await updated.getByRole('button', {name:'详情', exact:true}).click();
        await expect(dialog).toContainText(label + '-修改');
        await expect(dialog.getByRole('button', {name:'保存', exact:true})).toHaveCount(0);
        await dialog.getByRole('button', {name:'取消', exact:true}).click();
        if (category === 'sub') {
          const saved = await readDetail(page,id);
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
          assert.equal((await readDetail(page,childId)).data.parentId, id);
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
        await expect(page.getByRole('link', {name:'Installed ' + category, exact:true})).toHaveCount(0);
        await page.evaluate(() => window.probeNavigate());
        await expect(page.getByRole('heading', {name:'暂无访问权限'})).toBeVisible();
        await expect(page.getByRole('button', {name:'新增', exact:true})).toHaveCount(0);
        assert.equal((await readDetail(page,id)).status, 403);
        await page.evaluate(() => window.probeLogout());
      } finally {await context.close();}
    }
    console.log('PASS: actual generated React CRUD/tree/sub create/edit/detail/search/reset/tree/sub update/bulk selection/XLSX/delete, exact IDs/decimal/root-parent/sub FK, literal HTML and no-role backend denial.');
  } finally {await browser?.close(); await server.close();}
}