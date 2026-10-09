import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';
import type {DictionaryResponse, DictionaryEntryResponse, DictionaryTypeOption, PageResponseDictionaryEntryResponse, EntryRequest, RoleMenuOption, RoleResponse, UserResponse, RoleWriteRequest} from '../../generated/api';

test('real dictionary type/data CRUD, duplicate values, rename, styled comma keys, XLSX and deletion guards', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
  const code = `browser_dict_${Date.now()}`, name = `浏览器字典${Date.now()}`;
  await page.getByRole('button', {name: '新增字典类型', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByLabel('字典名称', {exact: true}).fill(name); await dialog.getByLabel('字典类型标识').fill(code); await dialog.getByLabel('备注').fill('真实验证'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.locator('[data-page-path]:visible .list-filters').getByLabel('字典类型', {exact:true}).fill(code); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('button', {name, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '新增字典类型', exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('字典名称', {exact: true}).fill('重复'); await dialog.getByLabel('字典类型标识').fill(code); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await page.keyboard.press('Escape');
  const discard = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true}); await expect(discard).toBeVisible();
  await expect(dialog.getByLabel('字典名称', {exact: true})).toHaveValue('重复'); await expect(dialog.getByLabel('字典类型标识')).toHaveValue(code);
  await discard.getByRole('button', {name: '放弃修改', exact: true}).click(); await expect(discard).toHaveCount(0); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name, exact: true}).click(); await expect(page.getByRole('heading', {name: '字典数据', exact: true})).toBeVisible();
  const dictionaryId = new URL(page.url()).pathname.split('/').at(-1)!;
  for (const label of ['逗号标签', '重复键值标签']) {
    await page.getByRole('button', {name: '新增字典数据'}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('数据标签').fill(label); await dialog.getByLabel('数据键值').fill('a,b'); await dialog.getByLabel('回显样式').selectOption('WARNING'); await dialog.getByLabel('样式属性').fill('owned-style'); await dialog.getByLabel('默认项').check(); await dialog.getByLabel('备注').fill('可清空备注'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('cell', {name: label, exact: true})).toBeVisible();
  }
  await expect(page.getByRole('cell', {name: 'a,b', exact: true})).toHaveCount(2); await expect(page.locator('.tag-warning').filter({hasText: '逗号标签'})).toBeVisible();
  await page.getByRole('button', {name: '修改字典 逗号标签', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('默认项')).toBeChecked(); await dialog.getByLabel('显示顺序').fill('-1'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog.getByRole('alert')).toContainText('请检查'); await dialog.getByLabel('显示顺序').fill('2147483647'); await dialog.getByLabel('回显样式').selectOption('DEFAULT'); await dialog.getByLabel('样式属性').fill(''); await dialog.getByLabel('默认项').uncheck(); await dialog.getByLabel('字典状态').selectOption('1'); await dialog.getByLabel('备注').fill(''); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: '修改字典 逗号标签', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('显示顺序')).toHaveValue('2147483647'); await expect(dialog.getByLabel('回显样式')).toHaveValue('DEFAULT'); await expect(dialog.getByLabel('样式属性')).toHaveValue(''); await expect(dialog.getByLabel('备注')).toHaveValue(''); await expect(dialog.getByLabel('默认项')).not.toBeChecked(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(discard).toHaveCount(0);
  await page.locator('[data-page-path]:visible').getByLabel('状态').selectOption('1'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: '重复键值标签', exact: true})).toHaveCount(0);
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出字典'}).click(); const download = await pending; expect(download.suggestedFilename()).toBe('字典数据.xlsx'); const xml = workbookXml(await readFile((await download.path())!)); expect(xml).toContain('逗号标签'); expect(xml).toContain('a,b'); expect(xml).not.toContain('重复键值标签');
  await page.getByRole('button', {name: '关闭字典数据'}).click(); await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible(); await page.locator('[data-page-path]:visible .list-filters').getByLabel('字典类型', {exact:true}).fill(code); await page.getByRole('button', {name: '查询', exact: true}).click();
  await page.getByRole('button', {name: `删除字典 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible(); await page.getByRole('button', {name: '取消', exact: true}).click();
  await page.getByRole('button', {name: `修改字典 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('字典类型标识').fill(`${code}_renamed`); await dialog.getByLabel('备注').fill(''); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: `预览字典 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.locator('p[role=status]')).toHaveText('共计 2 条，正常 1 条，停用 1 条'); await expect(dialog.getByText('逗号标签', {exact: true})).toBeVisible(); await expect(dialog.getByText(`${code}_renamed`, {exact: true})).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('button', {name, exact: true}).click(); await expect(page).toHaveURL(new RegExp(`/dict/data/${dictionaryId}$`));
  for (const label of ['逗号标签', '重复键值标签']) await page.getByRole('checkbox', {name: `选择字典 ${label}`, exact: true}).check();
  await page.getByRole('button', {name: '删除所选字典'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无字典记录', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '关闭字典数据'}).click(); await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible(); await page.locator('[data-page-path]:visible .list-filters').getByLabel('字典类型', {exact:true}).fill(code); await page.getByRole('button', {name: '查询', exact: true}).click(); await page.getByRole('button', {name: `删除字典 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无字典记录', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '刷新字典缓存'}).click(); await expect(page.getByText('字典缓存已刷新。', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('real list-only dictionary account cannot mutate or inspect detail and loses internal-route access after revoke', async ({page}) => {
  await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, username = `dr${Date.now()}`;
  const menus: RoleMenuOption[] = await (await page.request.get('/api/v1/system/roles/menus', {headers})).json();
  const request: RoleWriteRequest = {name: username, key: username, sort: 0, status: '0', menuLinked: false, menuKeys: menus.filter(menu => menu.permission === 'system:dict:list').map(menu => menu.key)};
  expect(request.menuKeys.length).toBeGreaterThan(0);
  const createdRole = await page.request.post('/api/v1/system/roles', {headers, data: request}); expect(createdRole.status()).toBe(201); const role: RoleResponse = await createdRole.json();
  let account: UserResponse | undefined;
  try {
    const createdUser = await page.request.post('/api/v1/system/users', {headers, data: {password: 'Reader123', user: {username, displayName: username, departmentId: '103', sex: '2', status: '0', roleIds: [role.id], postIds: []}}}); expect(createdUser.status()).toBe(201); account = await createdUser.json();
    const types: DictionaryTypeOption[] = await (await page.request.get('/api/v1/system/dictionaries/options', {headers})).json(); const type = types.find(type => type.code === 'sys_normal_disable')!;
    await page.evaluate(() => sessionStorage.removeItem('eforge.enterprise.session.v1')); await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill(username); await page.getByLabel('密码', {exact: true}).fill('Reader123'); await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
    for (const name of ['新增字典类型', '修改所选字典', '删除所选字典', '导出字典', '刷新字典缓存']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
    await page.getByRole('button', {name: type.name, exact: true}).click(); await expect(page).toHaveURL(new RegExp(`/dict/data/${type.id}$`)); await expect(page.getByRole('cell', {name: '正常', exact: true}).first()).toBeVisible();
    const readerToken = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string), readerHeaders = {Authorization: `Bearer ${readerToken}`};
    expect((await page.request.get(`/api/v1/system/dictionaries/${type.id}`, {headers: readerHeaders})).status()).toBe(403);
    expect((await page.request.post('/api/v1/system/dictionaries/cache/refresh', {headers: readerHeaders})).status()).toBe(403);
    expect((await page.request.get('/api/v1/system/dictionaries/lookup/sys_normal_disable', {headers: readerHeaders})).status()).toBe(200);
    expect((await page.request.put(`/api/v1/system/roles/${role.id}`, {headers, data: {...request, menuKeys: []}})).status()).toBe(204);
    expect((await page.request.get(`/api/v1/system/dictionary-entries?dictionaryId=${type.id}`, {headers: readerHeaders})).status()).toBe(403);
    await page.goto(`/dict/data/${type.id}`); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
  } finally {
    if (account) expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [account.id]}})).status()).toBe(204);
    expect((await page.request.delete('/api/v1/system/roles', {headers, data: {ids: [role.id]}})).status()).toBe(204);
    await page.request.post('/logout', {headers});
  }
});

test('real dictionary label/style changes reach all existing management pages and sex controls', async ({page}) => {
  await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
  const originals = await page.evaluate(async () => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
    const options: DictionaryTypeOption[] = await (await fetch('/api/v1/system/dictionaries/options', {headers})).json();
    const originals: {id: string; request: EntryRequest}[] = [];
    for (const code of ['sys_normal_disable', 'sys_user_sex']) {
      const type = options.find(type => type.code === code)!; const rows: PageResponseDictionaryEntryResponse = await (await fetch(`/api/v1/system/dictionary-entries?dictionaryId=${type.id}&pageSize=100`, {headers})).json();
      const entry = rows.items.find(row => row.value === '0' && row.status === '0')!;
      const request: EntryRequest = {dictionaryId: entry.dictionaryId, label: entry.label, value: entry.value, sort: entry.sort, status: entry.status, style: entry.style, cssClass: entry.cssClass ?? '', defaultEntry: entry.defaultEntry, remark: entry.remark ?? ''};
      originals.push({id: entry.id, request});
      const response = await fetch(`/api/v1/system/dictionary-entries/${entry.id}`, {method: 'PUT', headers, body: JSON.stringify({...request, label: code === 'sys_normal_disable' ? '自定义正常标签' : '自定义性别标签', style: 'WARNING', cssClass: 'custom-live'})});
      if (response.status !== 204) throw new Error('Shared dictionary mutation failed');
    }
    return originals;
  });
  try {
    for (const [path, heading, filter, add, editor] of [
      ['/post', '岗位管理', '状态', '新增岗位', '岗位状态'],
      ['/dept', '部门管理', '部门状态', '新增部门', '部门状态'],
      ['/role', '角色管理', '状态', '新增角色', '角色状态'],
      ['/menu', '菜单管理', '菜单状态', '新增菜单', '菜单状态'],
      ['/user', '用户管理', '用户状态', '新增用户', '用户状态'],
    ]) {
      await page.goto(path!); await expect(page.getByRole('heading', {name: heading!, exact: true})).toBeVisible(); await expect(page.locator('.custom-live').filter({hasText: '自定义正常标签'}).first()).toBeVisible();
      await expect(page.locator('[data-page-path]:visible').getByLabel(filter!, {exact: true}).getByRole('option', {name: '自定义正常标签', exact: true})).toHaveAttribute('value', '0');
      await page.getByRole('button', {name: add!, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel(editor!, {exact: true}).getByRole('option', {name: '自定义正常标签', exact: true})).toHaveAttribute('value', '0');
      if (path === '/user') await expect(dialog.getByLabel('用户性别').getByRole('option', {name: '自定义性别标签', exact: true})).toHaveAttribute('value', '0');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    }
    await page.goto('/user/profile'); await expect(page.getByRole('radio', {name: '自定义性别标签', exact: true})).toBeVisible();
  } finally {
    const restored = await page.evaluate(async originals => {
      const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
      const statuses: number[] = []; for (const item of originals) statuses.push((await fetch(`/api/v1/system/dictionary-entries/${item.id}`, {method: 'PUT', headers, body: JSON.stringify(item.request)})).status); return statuses;
    }, originals); expect(restored).toEqual([204, 204]);
  }
});

test('real dictionary pagination, date filters, whole preview, type switching, columns and batch deletion', async ({page}) => {
  test.setTimeout(120000);
  await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
  const prefix = `paging_dict_${Date.now()}`;
  const seeded = await page.evaluate(async prefix => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken;
    const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
    const types: DictionaryResponse[] = [];
    for (let index = 0; index < 12; index++) {
      const response = await fetch('/api/v1/system/dictionaries', {method: 'POST', headers, body: JSON.stringify({code: `${prefix}_${index}`, name: `${prefix}_类型${index}`, status: '0'})});
      if (response.status !== 201) throw new Error('Dictionary seed failed'); types.push(await response.json());
    }
    const entries: DictionaryEntryResponse[] = [];
    for (let index = 0; index < 105; index++) {
      const response = await fetch('/api/v1/system/dictionary-entries', {method: 'POST', headers, body: JSON.stringify({dictionaryId: types[0]!.id, label: `分页标签${index}`, value: String(index), sort: index, status: index % 2 ? '1' : '0', style: 'INFO', defaultEntry: false})});
      if (response.status !== 201) throw new Error('Entry seed failed'); entries.push(await response.json());
    }
    return {types, entryIds: entries.map(row => row.id)};
  }, prefix);
  await page.locator('[data-page-path]:visible .list-filters').getByLabel('字典类型', {exact:true}).fill(prefix); await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: `${prefix}_类型10`, exact: true})).toBeVisible();
  for (const index of [10, 11]) await page.getByRole('checkbox', {name: `选择字典 ${prefix}_类型${index}`, exact: true}).check();
  await page.getByRole('button', {name: '删除所选字典'}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '删除所选字典'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  const date = seeded.types[0]!.createdAt!.slice(0, 10); await page.locator('[data-page-path]:visible').getByLabel('开始日期').fill(date); await page.locator('[data-page-path]:visible').getByLabel('结束日期').fill(date); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByText('显示列', {exact: true}).click(); await page.getByRole('checkbox', {name: '备注', exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '备注', exact: true})).toHaveCount(0); await page.getByRole('checkbox', {name: '备注', exact: true}).check(); await page.getByText('显示列', {exact: true}).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出字典'}).click(); const download = await pending; expect(download.suggestedFilename()).toBe('字典类型.xlsx'); const xml = workbookXml(await readFile((await download.path())!)); expect(xml).toContain(`${prefix}_类型0`); expect(xml).not.toContain(`${prefix}_类型10`); expect(xml).not.toContain('用户性别');
  await page.getByRole('button', {name: `预览字典 ${prefix}_类型0`, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.locator('p[role=status]')).toHaveText('共计 105 条，正常 53 条，停用 52 条'); await expect(dialog.getByText('分页标签104', {exact: true})).toBeAttached(); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: `${prefix}_类型0`, exact: true}).click(); await expect(page.getByRole('cell', {name: '分页标签0', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByRole('cell', {name: '分页标签10', exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: '分页标签0', exact: true})).toHaveCount(0);
  await page.locator('[data-page-path]:visible').getByLabel('每页条数', {exact: true}).selectOption('100'); await expect(page.getByText('共 105 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByRole('cell', {name: '分页标签104', exact: true})).toBeVisible();
  for (let index = 100; index < 105; index++) await page.getByRole('checkbox', {name: `选择字典 分页标签${index}`, exact: true}).check(); await page.getByRole('button', {name: '删除所选字典'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('共 100 条，第 1 页', {exact: true})).toBeVisible();
  await page.locator('[data-page-path]:visible').getByLabel('选择字典', {exact: true}).selectOption(seeded.types[1]!.id); await expect(page).toHaveURL(new RegExp(`/dict/data/${seeded.types[1]!.id}$`)); await expect(page.getByText('暂无字典记录', {exact: true})).toBeVisible(); await expect(page.locator('[data-page-path]:visible').getByLabel('每页条数', {exact: true})).toHaveValue('10');
  const cleanup = await page.evaluate(async seeded => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
    const entries = await fetch('/api/v1/system/dictionary-entries', {method: 'DELETE', headers, body: JSON.stringify({ids: seeded.entryIds.slice(0, 100)})}); if (entries.status !== 204) return entries.status;
    return (await fetch('/api/v1/system/dictionaries', {method: 'DELETE', headers, body: JSON.stringify({ids: seeded.types.slice(0, 10).map(row => row.id)})})).status;
  }, seeded); expect(cleanup).toBe(204);
});

test('actual cached dictionary read cancellation recovers without unlocking a pending cache write',async({page})=>{
  await page.goto('/dict');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('admin123');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'字典管理',exact:true})).toBeVisible();
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string),headers={Authorization:'Bearer '+token};
  const options=await (await page.request.get('/api/v1/system/dictionaries/options',{headers})).json() as DictionaryTypeOption[];
  const selected=options.find(item=>item.code==='sys_normal_disable')!;expect(selected).toBeDefined();
  const detailPath='/api/v1/system/dictionaries/'+selected.id;
  let releaseRead!:()=>void;const readGate=new Promise<void>(resolve=>{releaseRead=resolve;});
  await page.route('**'+detailPath,async route=>{await readGate;await route.continue().catch(()=>{});});
  const modify=page.getByRole('button',{name:'修改字典 '+selected.name,exact:true});await expect(modify).toBeEnabled();
  const pendingRead=page.waitForRequest(request=>new URL(request.url()).pathname===detailPath);
  await modify.click();const captured=await pendingRead;
  const cancelled=page.waitForEvent('requestfailed',{predicate:request=>request===captured});
  try{
    await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    expect((await cancelled).failure()?.errorText).toMatch(/abort|cancel/i);
  }finally{releaseRead();}
  await page.unroute('**'+detailPath);
  const tabs=page.getByRole('navigation',{name:'页面标签'});
  await tabs.getByRole('link',{name:'页面标签：字典管理',exact:true}).click();await expect(modify).toBeEnabled();
  const recovered=page.waitForResponse(response=>new URL(response.url()).pathname===detailPath&&response.status()===200);
  await modify.click();await recovered;await expect(page.getByRole('dialog').getByLabel('字典名称',{exact:true})).toHaveValue(selected.name);await page.keyboard.press('Escape');
  let releaseWrite!:()=>void;const writeGate=new Promise<void>(resolve=>{releaseWrite=resolve;});let writes=0;
  const cachePath='/api/v1/system/dictionaries/cache/refresh';
  await page.route('**'+cachePath,async route=>{writes++;await writeGate;await route.continue();});
  const refresh=page.getByRole('button',{name:'刷新字典缓存',exact:true});
  const sent=page.waitForRequest(request=>new URL(request.url()).pathname===cachePath&&request.method()==='POST');
  const committed=page.waitForResponse(response=>new URL(response.url()).pathname===cachePath&&response.status()===204);
  await refresh.click();await sent;
  try{
    await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await tabs.getByRole('link',{name:'页面标签：字典管理',exact:true}).click();
    await expect(refresh).toBeDisabled();expect(writes).toBe(1);
  }finally{releaseWrite();}
  await committed;await expect(page.getByText('字典缓存已刷新。',{exact:true})).toBeVisible();await expect(refresh).toBeEnabled();expect(writes).toBe(1);
});
