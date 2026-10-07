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
async function verifyPendingUpload(page,category,field,file){
  const uploadPath='/common/upload';
  const control=page.getByRole('dialog').locator('label').filter({hasText:new RegExp('^'+field)}).first();
  let release;const gate=new Promise(resolve=>{release=resolve;});let writes=0;
  await page.route('**'+uploadPath,async route=>{writes++;await gate;await route.continue().catch(()=>{});});
  const sent=page.waitForRequest(request=>new URL(request.url()).pathname===uploadPath&&request.method()==='POST');
  const committed=page.waitForResponse(response=>new URL(response.url()).pathname===uploadPath&&response.status()===200).catch(cause=>({error:cause}));
  await control.locator('input[type=file]').setInputFiles(file);const captured=await sent;
  try{
    await page.goBack();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await page.locator('.ef-app-shell__nav').getByRole('link',{name:'Installed '+category,exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('button',{name:'保存',exact:true})).toBeDisabled();
    assert.equal(captured.failure(),null,'Sent upload must settle once instead of aborting on Activity hide');assert.equal(writes,1);
  }finally{release();}
  const acknowledgement=await committed;if(acknowledgement.error)throw acknowledgement.error;await expect(control.getByRole('button',{name:'移除文件',exact:true})).toBeVisible();
  await expect(control.locator('input[type=file]')).toBeEnabled();assert.equal(writes,1);
  await page.unroute('**'+uploadPath);
  console.log('PASS: '+category+' '+field+' real browser history retains one pending upload and form lock until genuine200 acknowledgement.');
}
async function fillChildControls(scope,root,page,category) {
  await scope.getByLabel('childNotes',{exact:true}).fill('子表多行\n中文');
  await scope.locator('label').filter({hasText:/^childSelectedStatus/}).locator('select').selectOption('1');
  await scope.locator('label').filter({hasText:/^childRadioStatus/}).getByRole('radio').first().check();
  const checks=scope.locator('label').filter({hasText:/^childCheckedStatuses/}).getByRole('checkbox');await checks.first().check();await checks.last().check();
  await scope.getByLabel('childEventTime',{exact:true}).fill('2026-10-07T01:02:03.456');
  await scope.locator('label').filter({hasText:/^childBoolSelected/}).locator('select').selectOption('1');await scope.locator('label').filter({hasText:/^childBoolRadio/}).getByRole('radio').last().check();  await scope.getByLabel('childQuantity',{exact:true}).fill('17');await scope.getByLabel('childRatio',{exact:true}).fill('0.125');await scope.getByLabel('childEnabled',{exact:true}).fill('true');
  await scope.getByLabel('childPrototype',{exact:true}).fill('子行合法字段');await scope.getByLabel('childLong',{exact:true}).fill('9007199254741001');await scope.getByLabel('childAmount',{exact:true}).fill('9007199254740993.00001');
  await scope.getByRole('textbox',{name:'公告内容',exact:true}).fill('子表富文本');
  await verifyPendingUpload(page,category,'childImagePaths',join(root,'tests/fixtures/avatar.png'));
  await verifyPendingUpload(page,category,'childFilePaths',{name:'子表文本.txt',mimeType:'text/plain',buffer:Buffer.from('子表实际文件')});
}
async function clearChildControls(scope) {
  await scope.locator('label').filter({hasText:/^childNotes/}).locator('textarea').fill('');await scope.getByLabel('childPrototype',{exact:true}).fill('');
  await scope.locator('label').filter({hasText:/^childSelectedStatus/}).locator('select').selectOption('');await scope.locator('label').filter({hasText:/^childRadioStatus/}).getByRole('radio').last().check();
  const checks=scope.locator('label').filter({hasText:/^childCheckedStatuses/}).getByRole('checkbox');await checks.first().uncheck();await checks.last().uncheck();
  await expect(scope.locator('label').filter({hasText:/^childBoolSelected/}).locator('select')).toHaveValue('1');await expect(scope.locator('label').filter({hasText:/^childBoolRadio/}).getByRole('radio').last()).toBeChecked();
  await scope.locator('label').filter({hasText:/^childBoolSelected/}).locator('select').selectOption('0');await scope.locator('label').filter({hasText:/^childBoolRadio/}).getByRole('radio').first().check();  await scope.getByLabel('childQuantity',{exact:true}).fill('0');await scope.getByLabel('childRatio',{exact:true}).fill('0');await scope.getByLabel('childEnabled',{exact:true}).fill('false');await scope.getByLabel('childEventTime',{exact:true}).fill('');
  await scope.getByLabel('childLong',{exact:true}).fill('9007199254741007');await scope.getByLabel('childAmount',{exact:true}).fill('9007199254740993.12500');await scope.getByRole('textbox',{name:'公告内容',exact:true}).fill('');
  for(const name of ['childImagePaths','childFilePaths'])await scope.locator('label').filter({hasText:new RegExp('^'+name)}).getByRole('button',{name:'移除文件',exact:true}).click();
}
async function verifyChildControls(page,row) {
  assert.equal(row.childNotes,'子表多行\n中文');assert.equal(row.childSelectedStatus,'1');assert.equal(row.childRadioStatus,'0');assert.equal(row.childCheckedStatuses,'0,1');assert.equal(row.childBoolSelected,true);assert.equal(row.childBoolRadio,true);assert.equal(row.childEnabled,true);assert.equal(row.childQuantity,17);assert.equal(row.childRatio,0.125);assert.equal(row.__proto__,'子行合法字段');assert.equal(row.childLong,'9007199254741001');assert.equal(row.childAmount,'9007199254740993.00001');assert(row.childRichContent.includes('子表富文本'));
  assert.equal(new Date(row.childEventTime).getTime(),await page.evaluate(()=>new Date('2026-10-07T01:02:03.456').getTime()));
  for(const key of ['childImagePaths','childFilePaths']) {assert(row[key].startsWith('/profile/upload/'));const response=await page.request.get(new URL(row[key],page.url()).href);assert.equal(response.status(),200);if(key==='childFilePaths')assert.equal(await response.text(),'子表实际文件');}
}
async function verifyRetainedList(page,category,label){
  const path='/api/v1/business/fixture/'+category,pattern='**'+path+'*';
  const row=page.getByRole('row').filter({hasText:label});
  await expect(row).toBeVisible();
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route(pattern,async route=>{
    if(new URL(route.request().url()).pathname!==path)return route.continue();
    await gate;await route.continue().catch(()=>{});
  });
  const requested=page.waitForRequest(request=>new URL(request.url()).pathname===path&&request.method()==='GET');
  await page.getByRole('button',{name:'刷新',exact:true}).click();const captured=await requested;
  const aborted=page.waitForEvent('requestfailed',{predicate:request=>request===captured});
  try{
    await page.getByRole('link',{name:'个人中心',exact:true}).click();
    await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    assert.match((await aborted).failure().errorText,/abort|cancel/i);
  }finally{release();}
  await page.unroute(pattern);
  const restored=page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==='GET'&&response.status()===200);
  await page.locator('.ef-app-shell__nav').getByRole('link',{name:'Installed '+category,exact:true}).click();
  await restored;await expect(row).toBeVisible();
  const checkbox=row.getByRole('checkbox'),filter=page.getByRole('textbox',{name:'label',exact:true});
  const prior=await filter.inputValue();await filter.fill('缓存草稿-'+category);await checkbox.check();
  let reads=0;const count=request=>{if(new URL(request.url()).pathname===path&&request.method()==='GET')reads++;};
  page.on('request',count);
  try{
    await page.getByRole('link',{name:'个人中心',exact:true}).click();
    await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await page.locator('.ef-app-shell__nav').getByRole('link',{name:'Installed '+category,exact:true}).click();
    await expect(checkbox).toBeChecked();await expect(filter).toHaveValue('缓存草稿-'+category);assert.equal(reads,0,'Completed generated list must not reload on cached activation');
  }finally{page.off('request',count);}
  await checkbox.uncheck();await filter.fill(prior);
  console.log('PASS: '+category+' installed Activity cancels exact pending read, retries real200, preserves completed selection/draft and performs zero resumed list requests.');
}
async function verifyAutomaticKey(page, noRoleUser, category) {
  const ids = [];
  for (const index of [0, 1]) {
    await page.getByRole('button', {name:'新增', exact:true}).click();
    const editor = page.getByRole('dialog');
    await expect(editor.getByLabel('oRderKey', {exact:true})).toHaveCount(0);
    await editor.getByLabel('label', {exact:true}).first().fill('自动编号-' + index);
    await editor.getByLabel('insertOnly', {exact:true}).fill('自动新增值');
    if(category === 'autotree') await editor.getByRole('combobox', {name:'parentId',exact:true}).selectOption(index ? ids[0] : '0');
    else await editor.getByLabel('parentId', {exact:true}).fill('0');
    await editor.getByLabel('quantity', {exact:true}).fill('0');
    await editor.getByLabel('ratio', {exact:true}).fill('0');
    await editor.getByLabel('enabled', {exact:true}).fill('false');
    await editor.locator('label').filter({hasText:/^requiredStatuses/}).getByRole('checkbox').first().check();
    if(category === 'autosub') {
      await editor.getByRole('button', {name:'新增子表行'}).click();
      const children=editor.locator('section[aria-label="子表明细"]');
      await expect(children.getByLabel('childId', {exact:true})).toHaveCount(0);
      await expect(children.getByLabel('ownerReference', {exact:true})).toHaveCount(0);
      await children.getByLabel('label', {exact:true}).fill('自动子表-'+index);
    }
    const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/business/fixture/'+category && response.request().method() === 'POST');
    await editor.getByRole('button', {name:'保存', exact:true}).click();
    const response = await created; assert.equal(response.status(), 201);
    const model = await response.json(); assert.equal(model.oRderKey, String(9007199254741101n + BigInt(index)));
    ids.push(model.oRderKey); await expect(editor).toHaveCount(0);
    const detail = await readDetail(page, model.oRderKey); assert.equal(detail.status, 200); assert.equal(detail.data.oRderKey, model.oRderKey);
    assert.equal(detail.data.insertOnly, '自动新增值'); assert.equal(detail.data.quantity, 0); assert.equal(detail.data.enabled, false);
    if(category === 'autotree') {assert.equal(detail.data.parentId,index?ids[0]:'0');await page.getByRole('button', {name:'展开全部'}).click();}
    if(category === 'autosub') {
      assert.equal(detail.data.fixtureAutoLineList.length,1);
      assert.equal(detail.data.fixtureAutoLineList[0].childId,String(9007199254741201n+BigInt(index)));
      assert.equal(detail.data.fixtureAutoLineList[0].ownerReference,model.oRderKey);
      assert.equal(detail.data.fixtureAutoLineList[0].label,'自动子表-'+index);
    }
  }
  await verifyRetainedList(page,category,'自动编号-0');
  const row = page.getByRole('row').filter({hasText:'自动编号-0'});
  await row.getByRole('button', {name:'修改', exact:true}).click();
  const editor = page.getByRole('dialog'); await expect(editor.getByLabel('oRderKey', {exact:true})).toHaveCount(0);
  await editor.getByLabel('label', {exact:true}).first().fill('自动编号-修改');
  await editor.getByLabel('editOnly', {exact:true}).fill('自动修改值');
  if(category === 'autosub') {
    await editor.getByRole('button', {name:'新增子表行'}).click();
    const children=editor.locator('section[aria-label="子表明细"]');
    await expect(children.getByLabel('childId', {exact:true})).toHaveCount(0);
    await children.getByLabel('label', {exact:true}).last().fill('自动子表-追加');
  }
  await editor.getByRole('button', {name:'保存', exact:true}).click(); await expect(editor).toHaveCount(0);
  const changed = await readDetail(page, ids[0]); assert.equal(changed.status, 200); assert.equal(changed.data.oRderKey, ids[0]);
  assert.equal(changed.data.label, '自动编号-修改'); assert.equal(changed.data.insertOnly, '自动新增值'); assert.equal(changed.data.editOnly, '自动修改值');
  if(category === 'autotree') await page.getByRole('button', {name:'展开全部'}).click();
  if(category === 'autosub') {
    assert.equal(changed.data.fixtureAutoLineList.length,2);
    const original=changed.data.fixtureAutoLineList.find(line=>line.label === '自动子表-0');
    const added=changed.data.fixtureAutoLineList.find(line=>line.label === '自动子表-追加');
    assert.equal(original.childId,'9007199254741201');assert(BigInt(added.childId)>9007199254741202n);
    assert.equal(original.ownerReference,ids[0]);assert.equal(added.ownerReference,ids[0]);
  }
  await page.getByRole('row').filter({hasText:'自动编号-修改'}).getByRole('checkbox').check();
  await page.getByRole('row').filter({hasText:'自动编号-1'}).getByRole('checkbox').check();
  await page.getByRole('button', {name:'删除选中', exact:true}).click(); await page.getByRole('button', {name:'确认删除', exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'自动编号-修改'})).toHaveCount(0);
  for (const id of ids) assert.equal((await readDetail(page,id)).status, 404);
  await page.evaluate(() => window.probeLogout());
  await page.evaluate(username => window.probeLogin({username,password:'admin123'}), noRoleUser);
  await expect(page.getByRole('link', {name:'Installed '+category,exact:true})).toHaveCount(0);
  await page.evaluate(() => window.probeNavigate()); await expect(page.getByRole('heading', {name:'暂无访问权限'})).toBeVisible();
  assert.equal((await readDetail(page,ids[0])).status,403); await page.evaluate(() => window.probeLogout());
  console.log('PASS: '+category+' actual automatic PK remains hidden with original insert=1/required=1, SQL-generated exact long IDs, refill/update/preserved insert-only values, bulk deletion and no-role denial.');
}
async function verifyStringKey(page, noRoleUser) {
  const ids=['__proto__','constructor','toString'];
  for(const [index,id] of ids.entries()) {
    await page.getByRole('button',{name:'新增',exact:true}).click();
    const editor=page.getByRole('dialog');
    await editor.getByLabel('oRderKey',{exact:true}).fill(id);
    await editor.getByLabel('label',{exact:true}).fill('字符串编号-'+index);
    await editor.getByLabel('insertOnly',{exact:true}).fill('字符串新增保持');
    await editor.getByLabel('parentId',{exact:true}).fill('0');
    await editor.getByLabel('quantity',{exact:true}).fill('0');await editor.getByLabel('ratio',{exact:true}).fill('0');
    await editor.getByLabel('enabled',{exact:true}).fill('false');
    await editor.locator('label').filter({hasText:/^requiredStatuses/}).getByRole('checkbox').first().check();
    const created=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/business/fixture/stringkey'&&response.request().method()==='POST');
    await editor.getByRole('button',{name:'保存',exact:true}).click();
    const response=await created;assert.equal(response.status(),201);assert.equal((await response.json()).oRderKey,id);
    await expect(editor).toHaveCount(0);
    const row=page.getByRole('row').filter({hasText:'字符串编号-'+index});await expect(row).toBeVisible();
    await expect(page.getByRole('button',{name:'删除选中',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'修改选中',exact:true})).toBeDisabled();
    await expect(row.getByRole('checkbox')).not.toBeChecked();
    const detail=await readDetail(page,id);assert.equal(detail.status,200);assert.equal(detail.data.oRderKey,id);
  }
  await verifyRetainedList(page,'stringkey','字符串编号-0');
  await page.getByRole('row').filter({hasText:'字符串编号-0'}).getByRole('checkbox').check();
  await page.getByRole('button',{name:'修改选中',exact:true}).click();
  const editor=page.getByRole('dialog');await expect(editor.getByLabel('oRderKey',{exact:true})).toHaveCount(0);
  await editor.getByLabel('label',{exact:true}).fill('字符串编号-修改');
  await editor.getByLabel('editOnly',{exact:true}).fill('字符串修改值');
  await editor.getByRole('button',{name:'保存',exact:true}).click();await expect(editor).toHaveCount(0);
  const changed=await readDetail(page,ids[0]);assert.equal(changed.status,200);assert.equal(changed.data.oRderKey,ids[0]);
  assert.equal(changed.data.label,'字符串编号-修改');assert.equal(changed.data.insertOnly,'字符串新增保持');
  await expect(page.getByRole('button',{name:'删除选中',exact:true})).toBeDisabled();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();
  assert((await download).suggestedFilename().endsWith('.xlsx'));
  for(const label of ['字符串编号-修改','字符串编号-1','字符串编号-2']) {
    await page.getByRole('row').filter({hasText:label}).getByRole('checkbox').check();
  }
  await expect(page.getByRole('button',{name:'修改选中',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'删除选中',exact:true}).click();
  const deleted=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/business/fixture/stringkey'&&response.request().method()==='DELETE');
  await page.getByRole('button',{name:'确认删除',exact:true}).click();
  const response=await deleted;assert.equal(response.status(),204);assert.deepEqual([...response.request().postDataJSON().ids].sort(),[...ids].sort());
  for(const id of ids)assert.equal((await readDetail(page,id)).status,404);
  await page.evaluate(()=>window.probeLogout());await page.evaluate(username=>window.probeLogin({username,password:'admin123'}),noRoleUser);
  await expect(page.getByRole('link',{name:'Installed stringkey',exact:true})).toHaveCount(0);await page.evaluate(()=>window.probeNavigate());
  await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();assert.equal((await readDetail(page,ids[0])).status,403);
  await page.evaluate(()=>window.probeLogout());
  console.log('PASS: actual legal String PK prototype names are initially unselected, explicitly selectable, exact in CRUD/XLSX/delete requests, retained after edit and denied without role.');
}
export async function verifyBrowser(root, owned, backend, noRoleUser) {
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(backend), 'Owned backend URL required.');
  for (const category of ['crud', 'tree', 'sub', 'auto', 'autotree', 'autosub', 'stringkey']) {
    writeFileSync(join(owned, category, 'index.html'), '<div id="root"></div><script type="module" src="./probe.tsx"></script>');
    writeFileSync(join(owned, category, 'probe.tsx'), [
      "import {createRoot} from 'react-dom/client';",
      "import {StrictMode} from 'react';",
      "import {createBrowserRouterAdapter} from '@eforge/app';",
      "import {createMemoryStorage} from '@eforge/core';",
      "import {EForgeProvider} from '@eforge/ui';",
      "import {PermissionProvider} from '@eforge/patterns';",
      "import '@eforge/tokens/styles.css'; import '@eforge/ui/styles.css'; import '@eforge/patterns/styles.css'; import '@eforge/data/styles.css'; import '../../../app/styles.css';",
      "import {ApiContext, BootstrapContext} from '../../../app/context';",
      "import {createSessionRuntime} from '../../../integration/session';",
      "import {toEForgePermissions} from '../../../integration/permissions';",
      "import {Application} from '../../../app/Application';",
      "import {generatedRoute} from './route';",
      "const runtime = createSessionRuntime(createMemoryStorage()); const router=createBrowserRouterAdapter();",
      "Object.assign(window, {probeLogin:runtime.login, probeLogout:runtime.logout, probeDetail:async (id:string) => {try {const response = await runtime.api.authenticatedFetch('/api/v1/business/fixture/" + category + "/' + id); return {status:response.status, data:await response.json()};} catch(error) {return {status:(error as {status:number}).status};}}});",
      "function Probe() {return <EForgeProvider><Application runtime={runtime} router={router} /></EForgeProvider>;}",
      "Object.assign(window,{probeNavigate:()=>router.navigate(generatedRoute.path),probeHref:router.getCurrentHref});",
      "createRoot(document.getElementById('root')!).render(<StrictMode><Probe /></StrictMode>);",
    ].join('\n'));
  }
  const server = await createServer({configFile:false, root, server:{host:'127.0.0.1', port:0,
    proxy:Object.fromEntries(['/api', '/common', '/profile', '/logout'].map(path => [path, {target:backend, changeOrigin:false}]))}});
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address(); assert(address && typeof address === 'object');
    browser = await chromium.launch({headless:true});
    for (const [ordinal, category] of ['crud', 'tree', 'sub', 'auto', 'autotree', 'autosub', 'stringkey'].entries()) {
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
        if (category.startsWith('auto')) {await verifyAutomaticKey(page, noRoleUser, category);assert.deepEqual(errors, []);continue;}
        if (category === 'stringkey') {await verifyStringKey(page,noRoleUser);assert.deepEqual(errors, []);continue;}
        await page.getByRole('link',{name:'个人中心',exact:true}).click(); await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); await installedLink.click();
        const id = String(9007199254741001n + BigInt(ordinal));
        const label = '浏览器-' + category + '-<img src=x onerror=window.injected=true>';
        await page.getByRole('button', {name:'新增', exact:true}).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByLabel('__proto__',{exact:true})).toHaveValue('');
        await dialog.getByLabel('oRderKey', {exact:true}).fill(id);
        await dialog.getByLabel('label', {exact:true}).first().fill(label);
        await dialog.getByLabel('amount', {exact:true}).fill('9007199254740993.00001');
        await dialog.getByLabel('insertOnly',{exact:true}).fill('新增专用保持');await expect(dialog.getByLabel('editOnly',{exact:true})).toHaveCount(0);
        if (category !== 'tree') await dialog.getByLabel('parentId', {exact:true}).fill('0');
        if (category === 'sub') {
          await dialog.getByRole('button', {name:'新增子表行'}).click();
          await dialog.getByLabel('label', {exact:true}).last().fill('浏览器子表');
          await fillChildControls(dialog.locator('section[aria-label="子表明细"]'),root,page,category);
        }
        {
          await dialog.getByLabel('notes', {exact:true}).fill('多行中文\n<script>保持文本</script>');
          await dialog.locator('label').filter({hasText:/^selectedStatus/}).locator('select').selectOption('1');
          await dialog.locator('label').filter({hasText:/^radioStatus/}).getByRole('radio').first().check();
          const checks=dialog.locator('label').filter({hasText:/^checkedStatuses/}).getByRole('checkbox');
          await checks.first().check();await checks.last().check();
          await dialog.getByLabel('eventTime', {exact:true}).fill('2026-10-07T01:02:03.456');
          await dialog.locator('label').filter({hasText:/^boolSelected/}).locator('select').selectOption('1');await dialog.locator('label').filter({hasText:/^boolRadio/}).getByRole('radio').last().check();          await dialog.getByLabel('enabled', {exact:true}).fill('true'); await dialog.getByLabel('quantity', {exact:true}).fill('17');await dialog.getByLabel('ratio', {exact:true}).fill('0.125');
          await dialog.getByLabel('__proto__', {exact:true}).fill('合法字段保持精确');
          await dialog.getByRole('textbox', {name:'公告内容', exact:true}).first().fill('生成富文本中文');
          await verifyPendingUpload(page,category,'imagePaths',join(root,'tests/fixtures/avatar.png'));
          await expect(dialog.locator('label').filter({hasText:/^imagePaths/})).toContainText('移除文件');
          await verifyPendingUpload(page,category,'filePaths',{name:'生成文本.txt',mimeType:'text/plain',buffer:Buffer.from('实际文件内容')});
          await expect(dialog.locator('label').filter({hasText:/^filePaths/})).toContainText('移除文件');
          await expect(dialog.getByRole('button', {name:'保存',exact:true})).toBeEnabled();
        }
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog.getByRole('alert')).toContainText('requiredStatuses');
        const requiredChecks=dialog.locator('label').filter({hasText:/^requiredStatuses/}).getByRole('checkbox');
        await requiredChecks.first().check();
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByText(label, {exact:true})).toBeVisible();
        await verifyRetainedList(page,category,label);
        const detail = await readDetail(page,id);
        assert.equal(detail.status, 200); assert.equal(detail.data.oRderKey, id);
        assert.equal(detail.data.amount, '9007199254740993.00001');
        assert.equal(detail.data.insertOnly,'新增专用保持');assert.equal(detail.data.editOnly,null);
        {
          assert.equal(detail.data.notes,'多行中文\n<script>保持文本</script>');assert.equal(detail.data.selectedStatus,'1');assert.equal(detail.data.radioStatus,'0');
          assert.equal(detail.data.boolSelected,true);assert.equal(detail.data.boolRadio,true);assert.equal(detail.data.enabled,true);assert.equal(detail.data.checkedStatuses,'0,1');assert.equal(detail.data.quantity,17);assert.equal(detail.data.ratio,0.125);
          assert.equal(detail.data.__proto__,'合法字段保持精确');assert(detail.data.richContent.includes('生成富文本中文'));
          assert.equal(new Date(detail.data.eventTime).getTime(),await page.evaluate(() => new Date('2026-10-07T01:02:03.456').getTime()));
          for(const key of ['imagePaths','filePaths']) {assert(detail.data[key].startsWith('/profile/upload/'));const served=await page.request.get(new URL(detail.data[key],page.url()).href);assert.equal(served.status(),200);if(key==='filePaths')assert.equal(await served.text(),'实际文件内容');}
        }
        if (category === 'tree') assert.equal(detail.data.parentId, '0');
        if (category === 'sub') {
          assert.equal(detail.data.fixtureLineList[0].label, '浏览器子表');
          assert.equal(detail.data.fixtureLineList[0].ownerReference, id);
          await verifyChildControls(page,detail.data.fixtureLineList[0]);
        }
        const row = page.getByRole('row').filter({has:page.getByText(label, {exact:true})});
        const headerNames=await page.getByRole('columnheader').allTextContents();
        for(const key of ['boolSelected','boolRadio']) {const index=headerNames.findIndex(name=>name.trim()===key);assert(index>=0);await expect(row.getByRole('cell').nth(index)).toHaveText('失败');}
        await row.getByRole('button', {name:'修改', exact:true}).click();
        await dialog.getByLabel('label', {exact:true}).first().fill(label + '-修改');
        await expect(dialog.getByLabel('insertOnly',{exact:true})).toHaveCount(0);await dialog.getByLabel('editOnly',{exact:true}).fill('修改专用值');
        if(category==='sub') {await dialog.getByLabel('label',{exact:true}).last().fill('浏览器子表-修改');await clearChildControls(dialog.locator('section[aria-label="子表明细"]'));}
        {
          await dialog.locator('label').filter({hasText:/^notes/}).locator('textarea').fill('');
          await dialog.getByLabel('__proto__',{exact:true}).fill('');
          await dialog.locator('label').filter({hasText:/^selectedStatus/}).locator('select').selectOption('');
          await dialog.locator('label').filter({hasText:/^radioStatus/}).getByRole('radio').last().check();
          const checks=dialog.locator('label').filter({hasText:/^checkedStatuses/}).getByRole('checkbox');await checks.first().uncheck();await checks.last().uncheck();
          await expect(dialog.locator('label').filter({hasText:/^boolSelected/}).locator('select')).toHaveValue('1');await expect(dialog.locator('label').filter({hasText:/^boolRadio/}).getByRole('radio').last()).toBeChecked();
          await dialog.locator('label').filter({hasText:/^boolSelected/}).locator('select').selectOption('0');await dialog.locator('label').filter({hasText:/^boolRadio/}).getByRole('radio').first().check();          await dialog.getByLabel('enabled',{exact:true}).fill('false');await dialog.getByLabel('quantity',{exact:true}).fill('0');await dialog.getByLabel('ratio',{exact:true}).fill('0');
          await dialog.getByRole('textbox',{name:'公告内容',exact:true}).first().fill('');
          for(const field of ['imagePaths','filePaths'])await dialog.locator('label').filter({hasText:new RegExp('^'+field)}).getByRole('button',{name:'移除文件',exact:true}).click();
        }
        await dialog.getByRole('button', {name:'保存', exact:true}).click();
        await expect(dialog).toHaveCount(0);
        const updated = page.getByRole('row').filter({has:page.getByText(label + '-修改', {exact:true})});
        await expect(updated).toBeVisible();
        {
          const changed=await readDetail(page,id);assert.equal(changed.status,200);assert.equal(changed.data.insertOnly,'新增专用保持');assert.equal(changed.data.editOnly,'修改专用值');
          for(const key of ['notes','__proto__','selectedStatus','checkedStatuses','imagePaths','filePaths','richContent'])assert.equal(changed.data[key],'','Cleared field '+key+' must persist');
          assert.equal(changed.data.boolSelected,false);assert.equal(changed.data.boolRadio,false);assert.equal(changed.data.enabled,false);assert.equal(changed.data.radioStatus,'1');assert.equal(changed.data.quantity,0);assert.equal(changed.data.ratio,0);
          for(const key of ['selectedStatus','radioStatus','boolSelected','boolRadio']) {
            const choice=key==='radioStatus'?'0':'1';await page.getByRole('combobox',{name:key,exact:true}).selectOption(choice);
            const response=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/business/fixture/'+category&&url.searchParams.get('q_'+key)===choice&&response.request().method()==='GET';});
            await page.getByRole('button',{name:'搜索',exact:true}).click();const filtered=await response;assert.equal(filtered.status(),200);const result=await filtered.json();assert.equal(Array.isArray(result)?result.length:result.items.length,0);await expect(updated).toHaveCount(0);
            await page.getByRole('button',{name:'重置',exact:true}).click();await expect(updated).toBeVisible();
          }
        }
        await updated.getByRole('button', {name:'详情', exact:true}).click();
        await expect(dialog).toContainText(label + '-修改');
        await expect(dialog.getByRole('button', {name:'保存', exact:true})).toHaveCount(0);
        if(category==='sub') {const childTable=dialog.locator('section[aria-label="子表明细"] table');const names=await childTable.getByRole('columnheader').allTextContents();for(const key of ['childBoolSelected','childBoolRadio']) {const index=names.findIndex(name=>name.trim()===key);assert(index>=0);await expect(childTable.locator('tbody tr').first().getByRole('cell').nth(index)).toHaveText(key+'成功');}}
        await dialog.getByRole('button', {name:'取消', exact:true}).click();
        if (category === 'sub') {
          const saved = await readDetail(page,id);
          assert.equal(saved.data.fixtureLineList.length, 1);
          assert.equal(saved.data.fixtureLineList[0].label, '浏览器子表-修改');
          assert.equal(saved.data.fixtureLineList[0].ownerReference, id);
          const child=saved.data.fixtureLineList[0];
          for(const key of ['childNotes','__proto__','childSelectedStatus','childCheckedStatuses','childImagePaths','childFilePaths','childRichContent'])assert.equal(child[key],'','Cleared child field '+key+' must persist');
          assert.equal(child.childEventTime,null);assert.equal(child.childLong,'9007199254741007');assert.equal(child.childAmount,'9007199254740993.12500');assert.equal(child.childBoolSelected,false);assert.equal(child.childBoolRadio,false);assert.equal(child.childEnabled,false);assert.equal(child.childRadioStatus,'1');assert.equal(child.childQuantity,0);assert.equal(child.childRatio,0);
        }
        await updated.getByRole('button',{name:'修改',exact:true}).click();await dialog.getByLabel('enabled',{exact:true}).fill('not-a-boolean');
        const invalidResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/business/fixture/'+category+'/'+id&&response.request().method()==='PUT');
        await dialog.getByRole('button',{name:'保存',exact:true}).click();const invalid=await invalidResponse;assert.equal(invalid.status(),400);await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('enabled',{exact:true})).toHaveValue('not-a-boolean');
        assert.equal((await readDetail(page,id)).data.enabled,false);await dialog.getByRole('button',{name:'取消',exact:true}).click();await expect(dialog).toHaveCount(0);
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
          await dialog.getByLabel('insertOnly',{exact:true}).fill('新增专用保持');
          await dialog.getByLabel('quantity',{exact:true}).fill('0');await dialog.getByLabel('ratio',{exact:true}).fill('0');await dialog.getByLabel('enabled',{exact:true}).fill('false');
          await dialog.locator('label').filter({hasText:/^requiredStatuses/}).getByRole('checkbox').first().check();
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
          await dialog.getByLabel('insertOnly',{exact:true}).fill('新增专用保持');
          await dialog.getByLabel('quantity',{exact:true}).fill('0');await dialog.getByLabel('ratio',{exact:true}).fill('0');await dialog.getByLabel('enabled',{exact:true}).fill('false');
          await dialog.locator('label').filter({hasText:/^requiredStatuses/}).getByRole('checkbox').first().check();
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
      } catch(cause) {
        console.error('Generated browser failure cause:',cause);console.error('Generated browser failure state:', category, await page.locator('body').innerText().catch(()=>'Page unavailable.'));
        throw cause;
      } finally {await context.close();}
    }
    console.log('PASS: actual generated React CRUD/tree/sub create/edit/detail/search/reset/tree/sub update/bulk selection/XLSX/delete, exact IDs/decimal/root-parent/sub FK, literal HTML and no-role backend denial.');
  } finally {await browser?.close(); await server.close();}
}