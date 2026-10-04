import {test, expect} from './fixtures';
import type {Page, Request} from '@playwright/test';
import type {DictionaryEntryResponse} from '../../generated/api';
const id = '9007199254740993';
const type = {id, name: '测试字典', code: 'test_dict', status: '0', remark: ''};
const values = [{value: '0', label: '正常', style: 'SUCCESS', defaultEntry: true}, {value: '1', label: '停用', style: 'DANGER', defaultEntry: false}];
async function authenticate(page: Page, permissions: string[], path = '/dict') {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '测试账号'}, roles: ['reader'], permissions,
    navigation: [{key: 'system-dictionaries', type: 'ROUTE', routeId: 'system-dictionaries', label: '字典管理', order: 0, children: []}]}}));
  await page.route('**/api/v1/system/dictionaries/options', route => route.fulfill({json: [type]}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_normal_disable', route => route.fulfill({json: values}));
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('read-only dictionaries recover errors and preview all 205 records with deep-linked data', async ({page}) => {
  let fail = true;
  await page.route('**/api/v1/system/dictionaries?*', route => route.fulfill(fail ? {status: 503, json: {}} : {json: {items: [type], total: 1, page: 1, pageSize: 10}}));
  const rows: DictionaryEntryResponse[] = Array.from({length: 205}, (_, index) => ({id: (BigInt(id) + BigInt(index)).toString(), dictionaryId: id, dictionaryCode: type.code, label: `数据标签${index}`, value: String(index), sort: index, status: index % 2 ? '1' : '0', style: 'WARNING', defaultEntry: false}));
  const requested: number[] = [];
  await page.route('**/api/v1/system/dictionary-entries?*', route => {const query = new URL(route.request().url()).searchParams, current = Number(query.get('page')), size = Number(query.get('pageSize')); expect(query.get('dictionaryId')).toBe(id); requested.push(current); return route.fulfill({json: {items: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, pageSize: size}});});
  await authenticate(page, ['system:dict:list']);
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false; await page.getByRole('button', {name: '重试列表', exact: true}).click();
  await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible();
  for (const name of ['新增字典类型', '修改所选字典', '删除所选字典', '导出字典', '刷新字典缓存']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: '预览字典 测试字典'}).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.locator('p[role=status]')).toHaveText('共计 205 条，正常 103 条，停用 102 条'); await expect(dialog.getByText('数据标签204', {exact: true})).toBeAttached(); expect(requested.slice(-3)).toEqual([1, 2, 3]); expect(requested.slice(0, -3).every(page => page === 1)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: '测试字典', exact: true}).click(); await expect(page).toHaveURL(new RegExp(`/dict/data/${id}$`));
  await expect(page.getByRole('cell', {name: '数据标签0', exact: true})).toBeVisible(); await expect(page.getByLabel('选择字典', {exact: true})).toHaveValue(id);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(page.getByRole('cell', {name: '数据标签0', exact: true})).toBeVisible();
});

test('closing a loading preview cancels its active network request and preserves the list', async ({page}) => {
  await page.route('**/api/v1/system/dictionaries?*', route => route.fulfill({json: {items: [type], total: 1, page: 1, pageSize: 10}}));
  let release: () => void = () => {}; const gate = new Promise<void>(resolve => {release = resolve;});
  let latest: Request | undefined;
  await page.route('**/api/v1/system/dictionary-entries?*', async route => {latest = route.request(); await gate; await route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 100}}).catch(() => {});});
  await authenticate(page, ['system:dict:list']); await page.getByRole('button', {name: '预览字典 测试字典'}).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByText('正在加载预览…')).toBeVisible();
  await expect.poll(() => !!latest && !latest.failure()).toBe(true);
  const failed = page.waitForEvent('requestfailed', request => request === latest);
  await dialog.getByRole('button', {name: '关闭预览'}).click(); const cancelled = await failed; expect(cancelled.failure()?.errorText).toContain('ERR_ABORTED'); release();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); await page.getByRole('button', {name: '刷新列表'}).click(); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible();
});

test('dictionary type editing validates input, preserves failed drafts and retries cache refresh', async ({page}) => {
  await page.route('**/api/v1/system/dictionaries?*', route => route.fulfill({json: {items: [type], total: 1, page: 1, pageSize: 10}}));
  let writes = 0, failCache = true; const bodies: unknown[] = [];
  await page.route('**/api/v1/system/dictionaries', route => {bodies.push(route.request().postDataJSON()); writes++; return route.fulfill(writes === 1 ? {status: 409, json: {code: 'DICTIONARY_CODE_EXISTS'}} : {status: 201, json: type});});
  await page.route('**/api/v1/system/dictionaries/cache/refresh', route => route.fulfill(failCache ? {status: 503, json: {code: 'DICTIONARY_CACHE_UNAVAILABLE'}} : {status: 204}));
  await authenticate(page, ['system:dict:list', 'system:dict:add', 'system:dict:remove']);
  await page.getByRole('button', {name: '新增字典类型', exact: true}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('字典名称', {exact: true}).fill('新增中文'); await dialog.getByLabel('字典类型标识').fill('UpperCase'); await dialog.getByRole('button', {name: '保存字典'}).click();
  await expect(dialog.getByRole('alert')).toContainText('请检查'); expect(writes).toBe(0);
  await dialog.getByLabel('字典类型标识').fill('new_dict'); await dialog.getByLabel('备注').fill('保留草稿'); await dialog.getByRole('button', {name: '保存字典'}).click();
  await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByLabel('备注')).toHaveValue('保留草稿'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  expect(bodies).toEqual([{name: '新增中文', code: 'new_dict', status: '0', remark: '保留草稿'}, {name: '新增中文', code: 'new_dict', status: '0', remark: '保留草稿'}]);
  await page.getByRole('button', {name: '刷新字典缓存'}).click(); await expect(page.getByRole('alert')).toContainText('字典缓存暂时不可用'); failCache = false; await page.getByRole('button', {name: '刷新字典缓存'}).click(); await expect(page.locator('p[role=status]')).toContainText('字典缓存已刷新');
});

test('entry editor saves zero values, styling and defaults on the exact dictionary ID', async ({page}) => {
  await page.route('**/api/v1/system/dictionary-entries?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
  let payload: unknown;
  await page.route('**/api/v1/system/dictionary-entries', route => {payload = route.request().postDataJSON(); return route.fulfill({status: 201, json: {}});});
  await authenticate(page, ['system:dict:list', 'system:dict:add'], `/dict/data/${id}`);
  await page.getByRole('button', {name: '新增字典数据'}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('数据标签').fill('零值'); await dialog.getByLabel('数据键值').fill('0'); await dialog.getByLabel('样式属性').fill('custom-tag'); await dialog.getByLabel('回显样式').selectOption('PRIMARY'); await dialog.getByLabel('默认项').check(); await dialog.getByLabel('字典状态').selectOption('1'); await dialog.getByRole('button', {name: '保存字典'}).click();
  await expect(dialog).toHaveCount(0); expect(payload).toEqual({dictionaryId: id, label: '零值', value: '0', sort: 0, style: 'PRIMARY', cssClass: 'custom-tag', defaultEntry: true, status: '1', remark: ''});
});

test('metadata failure disables editing until retry and inconsistent preview supports recovery', async ({page}) => {
  await page.route('**/api/v1/system/dictionaries?*', route => route.fulfill({json: {items: [type], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/dictionaries/cache/refresh', route => route.fulfill({status: 204}));
  await authenticate(page, ['system:dict:list', 'system:dict:add', 'system:dict:remove']);
  await expect(page.getByRole('button', {name: '新增字典类型'})).toBeEnabled();
  let failMetadata = true;
  await page.route('**/api/v1/system/dictionaries/options', route => route.fulfill(failMetadata ? {status: 503, json: {}} : {json: [type]}));
  await page.getByRole('button', {name: '刷新字典缓存'}).click(); await expect(page.getByRole('alert')).toContainText('字典选项加载失败'); await expect(page.getByRole('button', {name: '新增字典类型'})).toBeDisabled();
  failMetadata = false; await page.getByRole('button', {name: '重试字典选项'}).click(); await expect(page.getByRole('button', {name: '新增字典类型'})).toBeEnabled();
  let drift = true;
  await page.route('**/api/v1/system/dictionary-entries?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    const items = Array.from({length: current === 1 ? 100 : 1}, (_, index) => {const value = (current - 1) * 100 + index; return {id: String(value + 1), dictionaryId: id, dictionaryCode: type.code, label: `预览${value}`, value: String(value), sort: value, status: '0', style: 'DEFAULT', defaultEntry: false};});
    return route.fulfill({json: {items, page: current, pageSize: 100, total: current === 2 && drift ? 102 : 101}});
  });
  await page.getByRole('button', {name: '预览字典 测试字典'}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('alert')).toContainText('字典数据已变化'); drift = false; await dialog.getByRole('button', {name: '重试预览'}).click(); await expect(dialog.locator('p[role=status]')).toHaveText('共计 101 条，正常 101 条，停用 0 条'); await expect(dialog.getByText('预览100', {exact: true})).toBeAttached(); await page.keyboard.press('Escape');
  await page.getByLabel('开始日期').fill('2026-10-05'); await page.getByLabel('结束日期').fill('2026-10-04'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('开始日期不能晚于结束日期');
});
