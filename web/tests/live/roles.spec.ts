import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';

async function login(page: Page) {
  await page.goto('/role'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '角色管理', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: '超级管理员', exact: true})).toBeVisible();
}
async function headers(page: Page) {
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  return {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
}
async function query(page: Page, name: string) {
  await page.getByLabel('角色名称筛选', {exact: true}).fill(name); await page.getByRole('button', {name: '查询', exact: true}).click();
}
async function createRole(page: Page, name: string, key: string) {
  await page.getByRole('button', {name: '新增角色', exact: true}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('角色名称', {exact: true}).fill(name); await dialog.getByLabel('权限字符', {exact: true}).fill(key); return dialog;
}
async function saveRole(page: Page) {
  const response = page.waitForResponse(result => result.url().endsWith('/api/v1/system/roles') && result.request().method() === 'POST');
  await page.getByRole('button', {name: '保存角色', exact: true}).click(); const actual = await response; expect(actual.status()).toBe(201);
  const role: {id: string; name: string} = await actual.json(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('cell', {name: role.name, exact: true})).toBeVisible(); return role;
}
test('real roles CRUD, linked/independent grants, all scopes, status, dates, columns and XLSX', async ({page}, info) => {
  test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await login(page);
  await expect(page.getByLabel('选择角色 超级管理员', {exact: true})).toBeDisabled(); await expect(page.getByRole('button', {name: '修改角色 超级管理员', exact: true})).toHaveCount(0);
  const name = `角色${Date.now()}`, key = `role${Date.now()}`; const auth = await headers(page);
  let dialog = await createRole(page, name, key);
  await dialog.getByRole('button', {name: '展开全部菜单', exact: true}).click(); await dialog.locator('[data-grant-key="system-post-query"]').check();
  expect(await dialog.locator('[data-grant-key="system-posts"]').evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);
  await expect(dialog.locator('[data-grant-key="system-post-add"]')).not.toBeChecked();
  const role = await saveRole(page);
  try {
    let stored = await (await page.request.get(`/api/v1/system/roles/${role.id}`, {headers: auth})).json();
    expect(new Set(stored.menuKeys)).toEqual(new Set(['system', 'system-posts', 'system-post-query']));
    await page.getByRole('button', {name: `修改角色 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: '展开全部菜单', exact: true}).click(); expect(await dialog.locator('[data-grant-key="system-posts"]').evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);
    await dialog.getByLabel('菜单父子联动', {exact: true}).uncheck(); await dialog.locator('[data-grant-key="system-post-export"]').check();
    await dialog.getByLabel('角色顺序', {exact: true}).fill('12'); await dialog.getByLabel('备注', {exact: true}).fill('浏览器验证');
    await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog).toHaveCount(0);
    stored = await (await page.request.get(`/api/v1/system/roles/${role.id}`, {headers: auth})).json(); expect(stored.role.menuLinked).toBe(false); expect(stored.role.sort).toBe(12); expect(stored.menuKeys).toContain('system-post-export'); expect(stored.menuKeys).not.toContain('system-post-add');
    await page.getByLabel(`选择角色 ${name}`, {exact: true}).check(); await page.getByRole('button', {name: '修改所选角色', exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('备注', {exact: true}).fill('');
    await dialog.getByRole('button', {name: '全选菜单', exact: true}).click(); await dialog.getByRole('button', {name: '清空菜单', exact: true}).click(); await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog).toHaveCount(0);
    stored = await (await page.request.get(`/api/v1/system/roles/${role.id}`, {headers: auth})).json(); expect(stored.menuKeys).toEqual([]); expect(stored.role.remark).toBe('');
    const parentOnly = await page.request.put(`/api/v1/system/roles/${role.id}`, {headers: auth, data: {name, key, sort: 12, status: '0', remark: '', menuLinked: true, menuKeys: ['system']}}); expect(parentOnly.status()).toBe(204);
    await page.getByRole('button', {name: `修改角色 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('button', {name: '展开全部菜单', exact: true}).click();
    await expect(dialog.locator('[data-grant-key="system"]')).toBeChecked(); await expect(dialog.locator('[data-grant-key="system-posts"]')).not.toBeChecked(); await expect(dialog.locator('[data-grant-key="system-post-query"]')).not.toBeChecked();
    await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog).toHaveCount(0);
    stored = await (await page.request.get(`/api/v1/system/roles/${role.id}`, {headers: auth})).json(); expect(stored.menuKeys).toEqual(['system']);
    const leafOnly = await page.request.put(`/api/v1/system/roles/${role.id}`, {headers: auth, data: {name, key, sort: 12, status: '0', remark: '', menuLinked: true, menuKeys: ['system-post-query']}}); expect(leafOnly.status()).toBe(204);
    await page.getByRole('button', {name: `修改角色 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('button', {name: '展开全部菜单', exact: true}).click();
    await expect(dialog.locator('[data-grant-key="system-post-query"]')).toBeChecked(); await dialog.getByLabel('菜单父子联动', {exact: true}).uncheck(); await expect(dialog.locator('[data-grant-key="system-posts"]')).not.toBeChecked();
    await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog).toHaveCount(0);
    stored = await (await page.request.get(`/api/v1/system/roles/${role.id}`, {headers: auth})).json(); expect(stored.menuKeys).toEqual(['system-post-query']); expect(stored.role.menuLinked).toBe(false);
    const parentDepartment = await page.request.put(`/api/v1/system/roles/${role.id}/data-scope`, {headers: auth, data: {mode: '2', departmentLinked: true, departmentIds: ['101']}}); expect(parentDepartment.status()).toBe(204);
    await page.getByRole('button', {name: `数据权限 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.locator('[data-grant-key="101"]')).toBeChecked(); await expect(dialog.locator('[data-grant-key="103"]')).not.toBeChecked();
    await dialog.getByLabel('部门父子联动', {exact: true}).uncheck(); await dialog.getByRole('button', {name: '保存数据权限', exact: true}).click(); await expect(dialog).toHaveCount(0);
    const unchangedScope = await (await page.request.get(`/api/v1/system/roles/${role.id}/data-scope`, {headers: auth})).json(); expect(unchangedScope.departmentIds).toEqual(['101']); expect(unchangedScope.departmentLinked).toBe(false);
    for (const mode of ['2', '5', '3', '4', '1']) {
      await page.getByRole('button', {name: `数据权限 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('权限范围', {exact: true}).selectOption(mode);
      if (mode === '2') { await dialog.locator('[data-grant-key="103"]').check(); await dialog.getByLabel('部门父子联动', {exact: true}).uncheck(); await dialog.getByRole('button', {name: '折叠全部部门', exact: true}).click(); await dialog.getByRole('button', {name: '展开全部部门', exact: true}).click(); }
      else await expect(dialog.getByRole('tree', {name: '数据权限选择'})).toHaveCount(0);
      await dialog.getByRole('button', {name: '保存数据权限', exact: true}).click(); await expect(dialog).toHaveCount(0);
      const scope = await (await page.request.get(`/api/v1/system/roles/${role.id}/data-scope`, {headers: auth})).json(); expect(scope.mode).toBe(mode);
      if (mode === '2') expect(scope.departmentIds).toContain('103'); else expect(scope.departmentIds).toEqual([]);
    }
    await page.getByRole('button', {name: `停用角色 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(page.getByRole('button', {name: `停用角色 ${name}`, exact: true})).toBeVisible();
    await page.getByRole('button', {name: `停用角色 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认状态变更', exact: true}).click(); await expect(page.getByRole('button', {name: `启用角色 ${name}`, exact: true})).toBeVisible();
    await query(page, name); await page.getByLabel('权限字符筛选', {exact: true}).fill(key); await page.getByLabel('状态筛选', {exact: true}).selectOption('1'); await page.getByLabel('开始日期', {exact: true}).fill('2000-01-01'); await page.getByLabel('结束日期', {exact: true}).fill('2099-01-01'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByText('共 1 条，第 1 页', {exact: true})).toBeVisible();
    const download = page.waitForEvent('download'); await page.getByRole('button', {name: '导出角色', exact: true}).click(); const file = await download; expect(file.suggestedFilename()).toBe('角色数据.xlsx'); const xml = workbookXml(await readFile((await file.path())!)); expect(xml).toContain(key); expect(xml).toContain('停用');
    await page.getByText('显示列', {exact: true}).click(); await page.locator('.post-columns').getByLabel('权限字符', {exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '权限字符', exact: true})).toHaveCount(0); await page.locator('.post-columns').getByLabel('权限字符', {exact: true}).check();
    await page.getByRole('button', {name: '隐藏筛选', exact: true}).click(); await expect(page.getByLabel('角色名称筛选', {exact: true})).toBeHidden(); await page.getByRole('button', {name: '显示筛选', exact: true}).click();
    await page.getByRole('button', {name: '重置', exact: true}).click(); dialog = await createRole(page, name, `${key}-other`); await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('角色名称已存在'); await page.keyboard.press('Escape');
    dialog = await createRole(page, `${name}-other`, key); await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('角色权限字符已存在'); await page.keyboard.press('Escape');
    await page.getByLabel('开始日期', {exact: true}).fill('2099-01-01'); await page.getByLabel('结束日期', {exact: true}).fill('2000-01-01'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('开始日期不能晚于结束日期'); await page.getByRole('button', {name: '重置', exact: true}).click();
    await page.reload(); await expect(page.getByRole('button', {name: `启用角色 ${name}`, exact: true})).toBeVisible();
    await page.screenshot({path: info.outputPath('roles.png'), fullPage: true});
    await page.getByRole('button', {name: `删除角色 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(page.getByRole('cell', {name, exact: true})).toBeVisible();
    await page.getByRole('button', {name: `删除角色 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('cell', {name, exact: true})).toHaveCount(0); expect(errors).toEqual([]);
  } finally { await page.request.delete('/api/v1/system/roles', {headers: auth, data: {ids: [role.id]}}); }
});

test('real user allocation subpage, filtering, bulk assignment/cancellation and active-session revocation', async ({page, browser}) => {
  test.setTimeout(90000); await login(page); const auth = await headers(page), stamp = `${Date.now()}`;
  const roleReply = await page.request.post('/api/v1/system/roles', {headers: auth, data: {name: `授权角色${stamp}`, key: `allocation${stamp}`, sort: 5, status: '0', menuLinked: true, menuKeys: ['system', 'system-posts', 'system-post-query']}}); expect(roleReply.status()).toBe(201); const role = await roleReply.json();
  const userIds: string[] = []; const context = await browser.newContext();
  try {
    for (let index = 0; index < 12; index++) {
      const response = await page.request.post('/api/v1/system/users', {headers: auth, data: {user: {username: `r${stamp}${index}`, displayName: `授权用户${index}`, departmentId: '103', email: '', phone: index === 0 ? '13900000012' : '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'Browser123'}}); expect(response.status()).toBe(201); userIds.push((await response.json()).id);
    }
    await page.getByRole('button', {name: '刷新列表', exact: true}).click(); await page.getByRole('button', {name: `分配用户 ${role.name}`, exact: true}).click(); await expect(page).toHaveURL(new RegExp(`/role/users/${role.id}$`)); await expect(page.getByText('暂无已授权用户', {exact: true})).toBeVisible();
    await page.reload(); await expect(page.getByRole('heading', {name: '用户授权', exact: true})).toBeVisible(); await page.getByRole('button', {name: '添加用户', exact: true}).click(); const dialog = page.getByRole('dialog');
    await dialog.getByLabel('用户账号筛选', {exact: true}).fill(`r${stamp}`); await dialog.getByRole('button', {name: '查询用户', exact: true}).click(); await expect(dialog.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await dialog.getByRole('button', {name: '用户下一页', exact: true}).click(); await expect(dialog.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); await expect(dialog.getByRole('button', {name: '用户下一页', exact: true})).toBeDisabled();
    await dialog.getByLabel('用户每页条数', {exact: true}).selectOption('20'); await expect(dialog.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await dialog.getByLabel('选择当前页全部授权用户', {exact: true}).check(); await dialog.getByRole('button', {name: '确认添加用户', exact: true}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: '用户下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); await page.getByLabel('用户每页条数', {exact: true}).selectOption('20');
    await page.getByLabel('手机号码筛选', {exact: true}).fill('13900000012'); await page.getByRole('button', {name: '查询用户', exact: true}).click(); await expect(page.getByText('共 1 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '重置用户筛选', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    const member = await context.newPage(); await member.goto('/post'); await member.getByLabel('账号', {exact: true}).fill(`r${stamp}0`); await member.getByLabel('密码', {exact: true}).fill('Browser123'); await member.getByRole('button', {name: '登录', exact: true}).click(); await expect(member.getByRole('heading', {name: '岗位管理', exact: true})).toBeVisible();
    const memberAuth = await headers(member); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(200);
    await page.getByRole('button', {name: '关闭授权页', exact: true}).click(); await page.getByRole('button', {name: `删除角色 ${role.name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('已分配给用户'); await page.keyboard.press('Escape');
    await page.getByRole('button', {name: `停用角色 ${role.name}`, exact: true}).click(); await page.getByRole('button', {name: '确认状态变更', exact: true}).click(); await expect(page.getByRole('button', {name: `启用角色 ${role.name}`, exact: true})).toBeVisible(); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(403);
    await page.getByRole('button', {name: `启用角色 ${role.name}`, exact: true}).click(); await page.getByRole('button', {name: '确认状态变更', exact: true}).click(); await expect(page.getByRole('button', {name: `停用角色 ${role.name}`, exact: true})).toBeVisible(); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(200);
    await page.getByRole('button', {name: `分配用户 ${role.name}`, exact: true}).click(); await page.getByRole('button', {name: `取消授权 r${stamp}0`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(page.getByRole('cell', {name: `r${stamp}0`, exact: true})).toBeVisible();
    await page.getByRole('button', {name: `取消授权 r${stamp}0`, exact: true}).click(); await page.getByRole('button', {name: '确认取消授权', exact: true}).click(); await expect(page.getByRole('cell', {name: `r${stamp}0`, exact: true})).toHaveCount(0); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(403);
    await page.getByRole('button', {name: '添加用户', exact: true}).click(); await page.getByRole('dialog').getByLabel('手机号码筛选', {exact: true}).fill('13900000012'); await page.getByRole('dialog').getByRole('button', {name: '查询用户', exact: true}).click(); await page.getByRole('dialog').getByLabel(`选择授权用户 r${stamp}0`, {exact: true}).check(); await page.getByRole('dialog').getByRole('button', {name: '确认添加用户', exact: true}).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(200);
    await page.getByLabel('用户每页条数', {exact: true}).selectOption('20'); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByLabel('选择当前页全部授权用户', {exact: true}).check(); await page.getByRole('button', {name: '批量取消授权', exact: true}).click(); await page.getByRole('button', {name: '确认取消授权', exact: true}).click(); await expect(page.getByText('暂无已授权用户', {exact: true})).toBeVisible(); expect((await member.request.get('/api/v1/system/posts', {headers: memberAuth})).status()).toBe(403);
    await page.getByRole('button', {name: '添加用户', exact: true}).click(); await page.getByRole('dialog').getByLabel('用户账号筛选', {exact: true}).fill(`r${stamp}0`); await page.getByRole('dialog').getByLabel('手机号码筛选', {exact: true}).fill('13900000012'); await page.getByRole('dialog').getByRole('button', {name: '查询用户', exact: true}).click(); await expect(page.getByRole('dialog').getByText('共 1 条，第 1 页', {exact: true})).toBeVisible(); await page.keyboard.press('Escape');
    await member.getByRole('button', {name: '退出登录', exact: true}).click(); await page.getByRole('button', {name: '关闭授权页', exact: true}).click();
  } finally {
    await context.close(); if (userIds.length) await page.request.delete('/api/v1/system/users', {headers: auth, data: {ids: userIds}}); await page.request.delete('/api/v1/system/roles', {headers: auth, data: {ids: [role.id]}});
  }
});

test('real role pagination, page size and multi-row deletion', async ({page}) => {
  await login(page); const auth = await headers(page), prefix = `分页${Date.now()}`, ids: string[] = [];
  try {
    for (let index = 0; index < 12; index++) { const response = await page.request.post('/api/v1/system/roles', {headers: auth, data: {name: `${prefix}-${index}`, key: `${prefix}-${index}`, sort: index, status: '0', menuLinked: true, menuKeys: []}}); expect(response.status()).toBe(201); ids.push((await response.json()).id); }
    await query(page, prefix); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await expect(page.getByRole('button', {name: '上一页', exact: true})).toBeDisabled();
    await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); await expect(page.getByRole('button', {name: '下一页', exact: true})).toBeDisabled();
    await page.getByLabel('每页条数', {exact: true}).selectOption('20'); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await page.getByLabel('选择当前页全部角色', {exact: true}).check(); await page.getByRole('button', {name: '删除所选角色', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无角色', {exact: true})).toBeVisible();
  } finally { if (ids.length) await page.request.delete('/api/v1/system/roles', {headers: auth, data: {ids}}); }
});
