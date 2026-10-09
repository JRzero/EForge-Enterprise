import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const id = '9007199254740993', row = {id, name: '测试参数', key: '测试/键 & data', value: '<plain>', builtin: true, remark: '备注'};
async function login(page: Page, permissions: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '测试账号'}, roles: [], permissions, navigation: [{key: 'system-configuration', type: 'ROUTE', routeId: 'system-configurations', label: '参数配置', order: 0, children: []}]}}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_yes_no', route => route.fulfill({json: [{value: 'Y', label: '内置标签', style: 'SUCCESS', defaultEntry: true}, {value: 'N', label: '普通标签', style: 'DEFAULT', defaultEntry: false}]}));
  await page.goto('/config'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('read-only configuration route preserves exact IDs, retries errors and fits mobile', async ({page}) => {
  let fail = true;
  await page.route('**/api/v1/system/configurations?*', route => route.fulfill(fail ? {status: 503, json: {}} : {json: {items: [row], total: 1, page: 1, pageSize: 10}}));
  await login(page, ['system:config:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false; await page.getByRole('button', {name: '重试列表'}).click();
  await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: '内置标签', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: '<plain>', exact: true})).toBeVisible();
  for (const name of ['新增参数', '修改所选参数', '删除所选参数', '导出参数', '刷新参数缓存']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible();
});
test('configuration editor preserves failed drafts, validates limits and retries cache refresh', async ({page}) => {
  await page.route('**/api/v1/system/configurations?*', route => route.fulfill({json: {items: [row], total: 1, page: 1, pageSize: 10}}));
  await page.route(`**/api/v1/system/configurations/${id}`, route => route.fulfill({json: row}));
  let writes = 0, failCache = true; const bodies: unknown[] = [];
  await page.route('**/api/v1/system/configurations', route => {bodies.push(route.request().postDataJSON()); writes++; return route.fulfill(writes === 1 ? {status: 409, json: {code: 'CONFIGURATION_KEY_EXISTS'}} : {status: 201, json: row});});
  await page.route('**/api/v1/system/configurations/cache/refresh', route => route.fulfill(failCache ? {status: 503, json: {code: 'CONFIGURATION_CACHE_UNAVAILABLE'}} : {status: 204}));
  await login(page, ['system:config:list', 'system:config:add', 'system:config:edit', 'system:config:remove']);
  await expect(page.getByRole('button', {name: '修改所选参数'})).toBeDisabled(); await page.getByRole('checkbox', {name: '选择参数 测试参数', exact: true}).check(); await page.getByRole('button', {name: '修改所选参数'}).click();
  let dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('参数键名', {exact: true})).toHaveValue(row.key); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '新增参数', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('系统内置', {exact: true})).toHaveValue('Y');
  await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog.getByRole('alert')).toContainText('请填写'); expect(writes).toBe(0);
  await dialog.getByLabel('参数名称', {exact: true}).fill('x'.repeat(101)); await dialog.getByLabel('参数键名', {exact: true}).fill(row.key); await dialog.getByLabel('参数键值', {exact: true}).fill('值'); await dialog.getByRole('button', {name: '保存参数'}).click(); expect(writes).toBe(0);
  await dialog.getByLabel('参数名称', {exact: true}).fill('新参数'); await dialog.getByLabel('系统内置', {exact: true}).selectOption('N'); await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog.getByRole('alert')).toContainText('键名已存在'); await expect(dialog.getByLabel('参数键名', {exact: true})).toHaveValue(row.key);
  await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog).toHaveCount(0); expect(bodies.at(-1)).toEqual({name: '新参数', key: row.key, value: '值', builtin: false, remark: ''});
  await page.getByRole('button', {name: '刷新参数缓存'}).click(); await expect(page.getByRole('alert')).toContainText('参数缓存暂时不可用'); failCache = false; await page.getByRole('button', {name: '刷新参数缓存'}).click(); await expect(page.getByText('参数缓存已刷新。')).toBeVisible();
});
test('configuration filters and exports retain applied dates, false builtin and encoded text', async ({page}) => {
  const queries: URLSearchParams[] = []; let exported: URLSearchParams | undefined;
  await page.route('**/api/v1/system/configurations?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill({json: {items: [row], total: 1, page: 1, pageSize: 10}});});
  await page.route('**/api/v1/system/configurations/export?*', route => {exported = new URL(route.request().url()).searchParams; return route.fulfill({body: Buffer.from([80, 75, 3, 4]), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});});
  await login(page, ['system:config:list', 'system:config:export']);
  await page.locator('.list-filters').getByLabel('参数名称').fill('中文 & 名称'); await page.locator('.list-filters').getByLabel('参数键名').fill(row.key); await page.locator('.list-filters').getByLabel('系统内置').selectOption('N');
  await page.getByLabel('开始日期').fill('2026-10-04'); await page.getByLabel('结束日期').fill('2026-10-05'); await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect.poll(() => queries.at(-1)?.get('builtin')).toBe('false'); expect(queries.at(-1)?.get('key')).toBe(row.key); expect(queries.at(-1)?.get('from')).toBe('2026-10-04');
  await page.locator('.list-filters').getByLabel('参数名称').fill('尚未应用');
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出参数'}).click(); expect((await pending).suggestedFilename()).toBe('参数数据.xlsx');
  expect(exported?.get('name')).toBe('中文 & 名称'); expect(exported?.get('builtin')).toBe('false'); expect(exported?.get('to')).toBe('2026-10-05');
  await page.getByRole('button', {name: '隐藏筛选'}).click(); await expect(page.locator('.list-filters').getByLabel('参数名称')).toBeHidden(); await page.getByRole('button', {name: '显示筛选'}).click();
  await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.locator('.list-filters').getByLabel('参数名称')).toHaveValue(''); await expect.poll(() => queries.at(-1)?.get('builtin')).toBe(null);
});
