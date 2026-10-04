import {test, expect, type Page} from '@playwright/test';
const id = '9007199254740993';
const role = {id, name: '范围内角色', key: 'reader', sort: 1, status: '0', dataScope: '2', menuLinked: true, departmentLinked: true};
async function session(page: Page, permissions: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '7', username: 'reader', displayName: '验证账号'}, roles: ['reader'], permissions, navigation: [{key: 'system-roles', type: 'ROUTE', routeId: 'system-roles', label: '角色管理', order: 0, children: []}]}}));
  await page.goto('/role'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('read-only roles and deep-linked allocation respect permissions, exact IDs, retries and mobile bounds', async ({page}) => {
  let fail = true;
  await page.route('**/api/v1/system/roles?*', route => route.fulfill(fail ? {status: 503, json: {}} : {json: {items: [role], total: 1, page: 1, pageSize: 10}}));
  await page.route(`**/api/v1/system/roles/${id}/users?*`, route => route.fulfill({json: {items: [{id: '8', username: 'scoped', displayName: '范围内用户', status: '0'}], total: 1, page: 1, pageSize: 10}}));
  await session(page, ['system:role:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false;
  await page.getByRole('button', {name: '重试列表', exact: true}).click(); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible();
  for (const name of ['新增角色', '修改所选角色', '删除所选角色', '导出角色', '修改角色 范围内角色', '数据权限 范围内角色', '分配用户 范围内角色']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await page.goto(`/role/users/${id}`); await expect(page.getByRole('heading', {name: '用户授权', exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: 'scoped', exact: true})).toBeVisible();
  for (const name of ['添加用户', '批量取消授权', '取消授权 scoped']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/role/users/0'); await expect(page.getByRole('alert')).toContainText('角色编号无效'); await page.goto('/role/users/2/extra'); await expect(page.getByRole('heading', {name: '页面不存在', exact: true})).toBeVisible();
});
test('grant tree keyboard, selection payload, failed save retry, unavailable grants and mobile dialog', async ({page}) => {
  const menus = [{key: 'system', label: '系统管理', type: 'M', sort: 1, status: '0'}, {key: 'system-posts', parentKey: 'system', label: '岗位管理', type: 'C', sort: 1, status: '0'}, {key: 'system-post-query', parentKey: 'system-posts', label: '岗位查询', type: 'F', sort: 1, status: '0'}, {key: 'system-post-add', parentKey: 'system-posts', label: '岗位新增', type: 'F', sort: 2, status: '0'}];
  const writes: unknown[] = []; let reject = true;
  await page.route('**/api/v1/system/roles/menus', route => route.fulfill({json: menus}));
  await page.route(`**/api/v1/system/roles/${id}`, route => route.fulfill({json: {role, menuKeys: ['system', 'system-posts', 'system-post-query', 'unavailable'], checkedMenuKeys: ['system-post-query', 'unavailable']}}));
  await page.route('**/api/v1/system/roles?*', route => route.fulfill({json: {items: [role], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/roles', route => { writes.push(route.request().postDataJSON()); return route.fulfill(reject ? {status: 503, json: {}} : {status: 201, json: role}); });
  await session(page, ['*:*:*']); await page.getByRole('button', {name: '新增角色', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('角色名称');
  await dialog.getByLabel('角色名称', {exact: true}).fill('键盘角色'); await dialog.getByLabel('权限字符', {exact: true}).fill('keyboard');
  await dialog.locator('[data-grant-key="system"]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await expect(dialog.locator('[data-grant-key="system-posts"]')).toBeFocused();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await expect(dialog.locator('[data-grant-key="system-post-query"]')).toBeFocused(); await page.keyboard.press('Space');
  expect(await dialog.locator('[data-grant-key="system-posts"]').evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);
  await page.keyboard.press('End'); await expect(dialog.locator('[data-grant-key="system-post-add"]')).toBeFocused(); await page.keyboard.press('Home'); await expect(dialog.locator('[data-grant-key="system"]')).toBeFocused();
  await page.setViewportSize({width: 390, height: 844}); const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); reject = false; await dialog.getByRole('button', {name: '保存角色', exact: true}).click(); await expect(dialog).toHaveCount(0);
  expect(new Set((writes[1] as {menuKeys: string[]}).menuKeys)).toEqual(new Set(['system', 'system-posts', 'system-post-add']));
  await page.getByRole('button', {name: '修改角色 范围内角色', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('当前已分配的菜单（unavailable）', {exact: true})).toBeChecked();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
test('committed role save reports bootstrap failure and retries without repeating the mutation', async ({page}) => {
  let failSnapshot = false, writes = 0;
  await page.route('**/api/v1/system/roles?*', route => route.fulfill({json: {items: [role], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/roles/menus', route => route.fulfill({json: []}));
  await page.route('**/api/v1/system/roles', route => { writes++; failSnapshot = true; return route.fulfill({status: 201, json: role}); });
  await session(page, ['*:*:*']);
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill(failSnapshot ? {status: 503, json: {}} : {json: {user: {id: '7', username: 'reader', displayName: '验证账号'}, roles: [], permissions: ['*:*:*'], navigation: []}}));
  await page.getByRole('button', {name: '新增角色', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('角色名称', {exact: true}).fill('已保存角色'); await dialog.getByLabel('权限字符', {exact: true}).fill('committed'); await dialog.getByRole('button', {name: '保存角色', exact: true}).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('alert')).toContainText('已保存，权限信息刷新失败'); expect(writes).toBe(1);
  failSnapshot = false; await page.getByRole('button', {name: '重试权限刷新', exact: true}).click(); await expect(page.getByRole('alert')).toHaveCount(0); expect(writes).toBe(1);
});
