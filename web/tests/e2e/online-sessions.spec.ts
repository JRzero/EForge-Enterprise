import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const sessionId = (index: number) => `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
const row = {id: sessionId(1), username: '<script>读者</script>', departmentName: '中文部门', ip: '::1', location: '地点', browser: 'Chrome', operatingSystem: 'Linux', loggedInAt: '2026-10-05T00:00:00Z'};
async function login(page: Page, grants: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: ['app:dashboard:view', ...grants], navigation: [{key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []}, {key: 'monitor', type: 'GROUP', label: '系统监控', order: 2, children: [{key: 'monitor-online-sessions', type: 'ROUTE', routeId: 'monitor-online-sessions', label: '在线用户', order: 1, children: []}]}]}}));
  await page.goto('/online'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('read-only online metadata is inert, list failure retries, mobile bounds and route grants are enforced', async ({page}) => {
  let fail = true;
  await page.route('**/api/v1/monitor/online-sessions?*', route => route.fulfill(fail ? {status: 503, json: {code: 'ONLINE_SESSIONS_UNAVAILABLE'}} : {json: {items: [row], total: 1, page: 1, pageSize: 10}}));
  await login(page, ['monitor:online:list']); await expect(page.getByRole('alert')).toContainText('在线会话暂时无法'); fail = false; await page.getByRole('button', {name: '重试', exact: true}).click();
  await expect(page.getByRole('cell', {name: row.username, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: row.id, exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: /^强退会话 /})).toHaveCount(0); expect(await page.locator('.online-sessions-page script').count()).toBe(0);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: ['app:dashboard:view'], navigation: []}}));
  await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
});
test('exact filter transport, paging indices, retryable force confirmation and last-page recovery', async ({page}) => {
  let items = Array.from({length: 11}, (_, index) => ({...row, id: sessionId(index + 1)})), failed = true, writes = 0;
  const queries: URLSearchParams[] = [];
  await page.route('**/api/v1/monitor/online-sessions?*', route => {const query = new URL(route.request().url()).searchParams; queries.push(query); const page = Number(query.get('page')), size = Number(query.get('pageSize')); return route.fulfill({json: {items: items.slice((page - 1) * size, page * size), total: items.length, page, pageSize: size}});});
  await page.route('**/api/v1/monitor/online-sessions/*', route => {writes++; if (failed) return route.fulfill({status: 503, json: {code: 'ONLINE_SESSIONS_UNAVAILABLE'}}); items = items.filter(item => !route.request().url().endsWith(item.id)); return route.fulfill({status: 204});});
  await login(page, ['monitor:online:list', 'monitor:online:forceLogout']); await expect(page.getByText('共 11 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByLabel('用户名称', {exact: true}).fill('张 & 用户'); await page.getByLabel('登录地址', {exact: true}).fill('::1'); await page.getByLabel('用户名称', {exact: true}).press('Enter');
  await expect.poll(() => queries.at(-1)?.get('username')).toBe('张 & 用户'); expect(queries.at(-1)?.get('ip')).toBe('::1');
  await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 11 条，第 2 页', {exact: true})).toBeVisible();
  const last = sessionId(11); await expect(page.getByRole('row').filter({has: page.getByRole('cell', {name: last, exact: true})}).getByRole('cell', {name: '11', exact: true})).toBeVisible();
  await page.getByRole('button', {name: `强退会话 ${last}`, exact: true}).click(); await expect(page.getByRole('alertdialog')).toContainText(last); await page.keyboard.press('Escape'); expect(writes).toBe(0);
  await page.getByRole('button', {name: `强退会话 ${last}`, exact: true}).click(); await page.getByRole('button', {name: '确认强退', exact: true}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('在线会话暂时无法');
  failed = false; await page.getByRole('button', {name: '确认强退', exact: true}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible(); expect(writes).toBe(2);
  await page.getByLabel('每页条数', {exact: true}).selectOption('20'); await expect.poll(() => queries.at(-1)?.get('pageSize')).toBe('20');
  await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.getByLabel('用户名称', {exact: true})).toHaveValue(''); await expect(page.getByLabel('登录地址', {exact: true})).toHaveValue('');
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('leaving the page cancels its pending list request', async ({page}) => {
  let pending = false, aborted = false;
  page.on('requestfailed', request => {if (request.url().includes('/online-sessions?')) aborted = true;});
  await page.route('**/api/v1/monitor/online-sessions?*', async route => {if (!pending) return route.fulfill({json: {items: [row], total: 1, page: 1, pageSize: 10}}); await new Promise(resolve => setTimeout(resolve, 500)); await route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}).catch(() => {});});
  await login(page, ['monitor:online:list']); await expect(page.getByRole('cell', {name: row.id, exact: true})).toBeVisible(); pending = true; aborted = false;
  await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByRole('button', {name: '刷新', exact: true})).toBeDisabled();
  await page.getByRole('link', {name: '工作台', exact: true}).click(); await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible(); await expect.poll(() => aborted).toBe(true);
});
test('revoking the caller and receiving actual 401 returns to login', async ({page}) => {
  let revoked = false;
  await page.route('**/api/v1/monitor/online-sessions?*', route => route.fulfill(revoked ? {status: 401, json: {code: 'AUTHENTICATION_REQUIRED'}} : {json: {items: [row], total: 1, page: 1, pageSize: 10}}));
  await page.route(`**/api/v1/monitor/online-sessions/${row.id}`, route => {revoked = true; return route.fulfill({status: 204});});
  await login(page, ['monitor:online:list', 'monitor:online:forceLogout']); await page.getByRole('button', {name: `强退会话 ${row.id}`, exact: true}).click(); await page.getByRole('button', {name: '确认强退', exact: true}).click();
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
});
