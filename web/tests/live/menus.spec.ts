import {test, expect, type Page} from '@playwright/test';
import type {MenuResponse, MenuWriteRequest} from '../../generated/api';

async function login(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('/menu'); await page.getByLabel('账号', {exact: true}).fill(username); await page.getByLabel('密码', {exact: true}).fill(password);
  await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '菜单管理', exact: true})).toBeVisible();
}
async function headers(page: Page) {const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string); return {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};}
function menuName(page: Page, name: string) {return page.locator('.department-name').filter({has: page.getByText(name, {exact: true})});}
async function query(page: Page, name: string) {await page.getByLabel('菜单名称筛选', {exact: true}).fill(name); await page.getByRole('button', {name: '查询', exact: true}).click();}
async function begin(page: Page, name: string, key: string, parent?: MenuResponse) {
  await page.getByRole('button', {name: parent ? `新增子菜单 ${parent.name}` : '新增菜单', exact: true}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('菜单名称', {exact: true}).fill(name); await dialog.getByLabel('稳定标识', {exact: true}).fill(key); return dialog;
}
async function save(page: Page, id?: string) {
  const response = page.waitForResponse(result => new URL(result.url()).pathname === `/api/v1/system/menus${id ? `/${id}` : ''}` && result.request().method() === (id ? 'PUT' : 'POST'));
  await page.getByRole('button', {name: '保存菜单', exact: true}).click(); const actual = await response; expect(actual.status()).toBe(id ? 204 : 201); await expect(page.getByRole('dialog')).toHaveCount(0);
  return id ? undefined : await actual.json() as MenuResponse;
}
const body = (key: string, name: string, parentId = '0'): MenuWriteRequest => ({key, name, parentId, type: 'GROUP', sort: 0, status: '0', visible: true, cached: true, groupPath: key});
async function apiCreate(page: Page, auth: Record<string, string>, request: MenuWriteRequest) {const response = await page.request.post('/api/v1/system/menus', {headers: auth, data: request}); expect(response.status()).toBe(201); return await response.json() as MenuResponse;}
async function userRole(page: Page, auth: Record<string, string>, stamp: string, keys: string[]) {
  const roleReply = await page.request.post('/api/v1/system/roles', {headers: auth, data: {name: `菜单角色${stamp}`, key: `menu-role-${stamp}`, sort: 1, status: '0', menuLinked: false, menuKeys: keys}}); expect(roleReply.status()).toBe(201); const role = await roleReply.json() as {id: string};
  const username = `m${stamp}`; const userReply = await page.request.post('/api/v1/system/users', {headers: auth, data: {user: {username, displayName: '菜单验证账号', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [role.id], postIds: []}, password: 'Browser123'}}); expect(userReply.status()).toBe(201);
  return {userId: (await userReply.json() as {id: string}).id, roleId: role.id, username};
}
test('real menu tree CRUD, icon, types, parent exclusion/reparenting, route metadata, filters and session revocation', async ({page, browser}, info) => {
  test.setTimeout(150000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await login(page); const auth = await headers(page), stamp = String(Date.now()), prefix = `菜单${stamp}`;
  const ids: string[] = []; let account: Awaited<ReturnType<typeof userRole>> | undefined; const context = await browser.newContext();
  try {
    await page.getByRole('button', {name: '折叠全部菜单', exact: true}).click(); await expect(page.getByRole('button', {name: '修改菜单 用户查询', exact: true})).toHaveCount(0); await page.getByRole('button', {name: '展开全部菜单', exact: true}).click(); await expect(page.getByRole('button', {name: '修改菜单 用户查询', exact: true})).toBeVisible();
    await page.getByRole('button', {name: '删除菜单 系统管理', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('包含子菜单'); await page.getByRole('button', {name: '取消', exact: true}).click();
    let dialog = await begin(page, prefix, `menu-browser-${stamp}`); await dialog.locator('summary').click(); await dialog.getByLabel('搜索图标', {exact: true}).fill('tree-table'); await dialog.getByRole('button', {name: '选择图标 tree-table', exact: true}).click();
    const group = (await save(page))!; ids.push(group.id); await expect(menuName(page, group.name)).toBeVisible();
    dialog = await begin(page, `${prefix}下级`, `menu-child-${stamp}`, group); await expect(dialog.getByLabel('上级菜单', {exact: true})).toHaveValue(group.id); const child = (await save(page))!; ids.push(child.id); await expect(menuName(page, child.name)).toBeVisible();
    dialog = await begin(page, `${prefix}按钮`, `menu-button-${stamp}`, child); await dialog.getByLabel('菜单类型', {exact: true}).selectOption('FUNCTION'); await dialog.getByLabel('权限标识', {exact: true}).fill('system:post:query'); const button = (await save(page))!; ids.push(button.id); await expect(menuName(page, button.name)).toBeVisible();
    dialog = await begin(page, `${prefix}外链`, `menu-external-${stamp}`); await dialog.getByLabel('菜单类型', {exact: true}).selectOption('EXTERNAL'); await dialog.getByLabel('外链地址', {exact: true}).fill('https://example.com/documentation'); const external = (await save(page))!; ids.push(external.id);
    dialog = await begin(page, child.name, `menu-duplicate-${stamp}`, group); await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('同名菜单'); await dialog.getByRole('button', {name: '取消', exact: true}).click();
    dialog = await begin(page, `${prefix}重复标识`, group.key!); await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('标识已存在'); await dialog.getByRole('button', {name: '取消', exact: true}).click();
    await query(page, prefix); await page.getByRole('button', {name: `折叠菜单 ${group.name}`, exact: true}).click(); await expect(menuName(page, child.name)).toHaveCount(0); await page.getByRole('button', {name: `展开菜单 ${group.name}`, exact: true}).click();
    await page.getByRole('button', {name: `修改菜单 ${group.name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('稳定标识', {exact: true})).toBeDisabled();
    await expect(dialog.getByRole('option', {name: new RegExp(child.name)})).toHaveCount(0); await dialog.getByLabel('菜单名称', {exact: true}).fill(`${prefix}改`); await dialog.getByLabel('备注', {exact: true}).fill(''); await dialog.getByLabel('显示状态', {exact: true}).selectOption('hide'); await dialog.getByRole('button', {name: '清除图标', exact: true}).click(); await save(page, group.id); group.name = `${prefix}改`;
    const stored = await (await page.request.get(`/api/v1/system/menus/${group.id}`, {headers: auth})).json() as MenuResponse; expect(stored).toMatchObject({name: group.name, icon: '', remark: '', visible: false});
    await page.getByLabel('显示状态筛选', {exact: true}).selectOption('hide'); await query(page, prefix); await expect(menuName(page, group.name)).toBeVisible(); await expect(menuName(page, child.name)).toHaveCount(0); await page.getByLabel('显示状态筛选', {exact: true}).selectOption(''); await query(page, prefix);
    await page.getByRole('button', {name: `修改菜单 ${child.name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByRole('option', {name: new RegExp(button.name)})).toHaveCount(0); await dialog.getByLabel('上级菜单', {exact: true}).selectOption('0'); await save(page, child.id); await expect(menuName(page, child.name)).toBeVisible();
    expect(await menuName(page, child.name).evaluate(element => (element as HTMLElement).style.paddingInlineStart)).toBe('0px');
    await page.getByLabel(`排序菜单 ${child.name}`, {exact: true}).fill('9'); await page.getByRole('button', {name: '保存菜单排序', exact: true}).click(); await expect(page.getByText('菜单排序已保存。', {exact: true})).toBeVisible(); await page.reload(); await query(page, prefix); await expect(page.getByLabel(`排序菜单 ${child.name}`, {exact: true})).toHaveValue('9');
    account = await userRole(page, auth, stamp, ['system', 'system-menus', 'system-menu-query', group.key!, child.key!, button.key!]); const member = await context.newPage(); await login(member, account.username, 'Browser123'); const memberAuth = await headers(member);
    await expect(member.getByRole('button', {name: '新增菜单', exact: true})).toHaveCount(0); await expect(member.getByRole('button', {name: `修改菜单 ${button.name}`, exact: true})).toHaveCount(0); expect((await member.request.get('/api/v1/system/posts/1', {headers: memberAuth})).status()).toBe(200);
    await page.getByRole('button', {name: `修改菜单 ${button.name}`, exact: true}).click(); await page.getByRole('dialog').getByLabel('菜单状态', {exact: true}).selectOption('1'); await save(page, button.id); expect((await member.request.get('/api/v1/system/posts/1', {headers: memberAuth})).status()).toBe(403);
    await page.getByRole('button', {name: `修改菜单 ${button.name}`, exact: true}).click(); await page.getByRole('dialog').getByLabel('菜单状态', {exact: true}).selectOption('0'); await save(page, button.id); expect((await member.request.get('/api/v1/system/posts/1', {headers: memberAuth})).status()).toBe(200);
    await page.getByRole('button', {name: `删除菜单 ${button.name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('已分配给角色'); await page.getByRole('button', {name: '取消', exact: true}).click();
    await page.getByRole('button', {name: '重置', exact: true}).click(); await page.getByRole('button', {name: '修改菜单 菜单管理', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('关联页面', {exact: true})).toHaveValue('system-menus'); await expect(dialog.getByLabel('权限标识', {exact: true})).toBeDisabled(); await dialog.getByLabel('路由参数', {exact: true}).fill('{"from":"menu-check"}'); await dialog.getByLabel('是否缓存', {exact: true}).selectOption('no'); await save(page, '102');
    const actual = await (await page.request.get('/api/v1/system/menus/102', {headers: auth})).json() as MenuResponse; expect(actual).toMatchObject({routeId: 'system-menus', queryText: '{"from":"menu-check"}', cached: false});
    await page.getByRole('button', {name: '修改菜单 菜单管理', exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('路由参数', {exact: true}).fill(''); await dialog.getByLabel('是否缓存', {exact: true}).selectOption('yes'); await save(page, '102');
    await query(page, prefix); await page.getByRole('button', {name: '隐藏筛选', exact: true}).click(); await expect(page.getByLabel('菜单名称筛选', {exact: true})).toBeHidden(); await page.getByRole('button', {name: '显示筛选', exact: true}).click(); await page.screenshot({path: info.outputPath('menus.png'), fullPage: true}); expect(errors).toEqual([]);
    await page.getByRole('button', {name: `删除菜单 ${external.name}`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(menuName(page, external.name)).toBeVisible(); await page.getByRole('button', {name: `删除菜单 ${external.name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(menuName(page, external.name)).toHaveCount(0);
  } finally {
    await context.close(); if (account) {await page.request.delete('/api/v1/system/users', {headers: auth, data: {ids: [account.userId]}}); await page.request.delete('/api/v1/system/roles', {headers: auth, data: {ids: [account.roleId]}});}
    for (const id of ids.reverse()) await page.request.delete(`/api/v1/system/menus/${id}`, {headers: auth});
  }
});
test('real whole-tree sort persists more than one hundred edited menus in one atomic request', async ({page}) => {
  test.setTimeout(150000); await login(page); const auth = await headers(page), stamp = String(Date.now()), prefix = `排序树${stamp}`, owned: MenuResponse[] = [];
  try {
    for (let index = 0; index < 105; index++) owned.push(await apiCreate(page, auth, body(`menu-sort-${stamp}-${index}`, `${prefix}-${index}`)));
    await query(page, prefix); await expect(page.getByRole('button', {name: `修改菜单 ${owned[104]!.name}`, exact: true})).toBeVisible();
    for (let index = 0; index < owned.length; index++) await page.getByLabel(`排序菜单 ${owned[index]!.name}`, {exact: true}).fill(String(index + 200));
    const response = page.waitForResponse(result => result.url().endsWith('/api/v1/system/menus/sort') && result.request().method() === 'PUT'); await page.getByRole('button', {name: '保存菜单排序', exact: true}).click(); const actual = await response; expect(actual.status()).toBe(204); expect(actual.request().postDataJSON().items).toHaveLength(105);
    await expect(page.getByText('菜单排序已保存。', {exact: true})).toBeVisible(); await page.reload(); await query(page, prefix); await expect(page.getByLabel(`排序菜单 ${owned[104]!.name}`, {exact: true})).toHaveValue('304');
    const rows = await (await page.request.get(`/api/v1/system/menus?name=${encodeURIComponent(prefix)}`, {headers: auth})).json() as MenuResponse[]; expect(rows).toHaveLength(105); for (let index = 0; index < owned.length; index++) expect(rows.find(row => row.id === owned[index]!.id)?.sort).toBe(index + 200);
  } finally {for (const row of owned) await page.request.delete(`/api/v1/system/menus/${row.id}`, {headers: auth});}
});
test('real scoped editor excludes hidden intermediate descendants and refuses a new unowned permission', async ({page, browser}) => {
  test.setTimeout(90000); await login(page); const auth = await headers(page), stamp = String(Date.now()), owned: MenuResponse[] = []; let account: Awaited<ReturnType<typeof userRole>> | undefined; const context = await browser.newContext();
  try {
    const root = await apiCreate(page, auth, body(`menu-scope-${stamp}`, `授权目录${stamp}`)); owned.push(root);
    const hidden = await apiCreate(page, auth, body(`menu-hidden-${stamp}`, `不可见上级${stamp}`, root.id)); owned.push(hidden);
    const grandchild = await apiCreate(page, auth, body(`menu-grand-${stamp}`, `授权下级${stamp}`, hidden.id)); owned.push(grandchild);
    const button = await apiCreate(page, auth, {...body(`menu-action-${stamp}`, `授权按钮${stamp}`, grandchild.id), type: 'FUNCTION', groupPath: undefined, permission: 'system:post:query'}); owned.push(button);
    account = await userRole(page, auth, stamp, ['system', 'system-menus', 'system-menu-query', 'system-menu-edit', root.key!, grandchild.key!, button.key!]); const member = await context.newPage(); await login(member, account.username, 'Browser123');
    await expect(menuName(member, hidden.name)).toHaveCount(0); await expect(menuName(member, grandchild.name)).toBeVisible(); await member.getByRole('button', {name: `修改菜单 ${root.name}`, exact: true}).click();
    let dialog = member.getByRole('dialog'); await expect(dialog.getByRole('option', {name: new RegExp(grandchild.name)})).toHaveCount(0); await dialog.getByRole('button', {name: '取消', exact: true}).click();
    await member.getByRole('button', {name: `修改菜单 ${button.name}`, exact: true}).click(); dialog = member.getByRole('dialog'); await dialog.getByLabel('权限标识', {exact: true}).fill('system:user:remove'); await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('权限');
    const stored = await (await page.request.get(`/api/v1/system/menus/${button.id}`, {headers: auth})).json() as MenuResponse; expect(stored.permission).toBe('system:post:query'); await dialog.getByRole('button', {name: '取消', exact: true}).click();
  } finally {await context.close(); if (account) {await page.request.delete('/api/v1/system/users', {headers: auth, data: {ids: [account.userId]}}); await page.request.delete('/api/v1/system/roles', {headers: auth, data: {ids: [account.roleId]}});} for (const row of owned.reverse()) await page.request.delete(`/api/v1/system/menus/${row.id}`, {headers: auth});}
});
