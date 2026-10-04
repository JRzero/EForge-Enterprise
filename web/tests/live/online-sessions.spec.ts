import {test, expect, type Page} from '@playwright/test';
import type {OnlineSessionResponse} from '../../generated/api';
const idOf = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {login_user_key: string}).login_user_key;
async function login(page: Page) {
  await page.goto('/online'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '在线用户', exact: true})).toBeVisible();
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  return {token, headers: {Authorization: `Bearer ${token}`}};
}
test('real online exact filters, paging, scoped force logout, last-page recovery and session isolation', async ({page}) => {
  test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const {headers} = await login(page), username = `on${Date.now()}`;
  const created = await page.request.post('/api/v1/system/users', {headers, data: {user: {username, displayName: '在线浏览器验证', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}});
  expect(created.status()).toBe(201); const account = await created.json(), tokens = new Map<string, string>();
  try {
    for (let index = 0; index < 12; index++) {const response = await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}}); expect(response.status()).toBe(200); const token: string = (await response.json()).accessToken; tokens.set(idOf(token), token);}
    const response = await page.request.get(`/api/v1/monitor/online-sessions?username=${username}&pageSize=100`, {headers}); expect(response.status()).toBe(200);
    const rows: OnlineSessionResponse[] = (await response.json()).items; expect(rows).toHaveLength(12);
    await page.getByLabel('用户名称', {exact: true}).fill(username.slice(0, 5)); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('暂无在线会话', {exact: true})).toBeVisible();
    await page.getByLabel('用户名称', {exact: true}).fill(username); await page.getByLabel('登录地址', {exact: true}).fill('127.'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('暂无在线会话', {exact: true})).toBeVisible();
    await page.getByLabel('登录地址', {exact: true}).fill('127.0.0.1'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
    const last = rows.slice(-2); await expect(page.getByRole('row').filter({has: page.getByRole('cell', {name: last[0]!.id, exact: true})}).getByRole('cell', {name: '11', exact: true})).toBeVisible();
    await page.getByRole('button', {name: `强退会话 ${last[0]!.id}`, exact: true}).click(); await expect(page.getByRole('alertdialog')).toContainText(username); await page.keyboard.press('Escape');
    expect((await page.request.get('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${tokens.get(last[0]!.id)}`}})).status()).toBe(200);
    for (const row of last) {await page.getByRole('button', {name: `强退会话 ${row.id}`, exact: true}).click(); await page.getByRole('button', {name: '确认强退', exact: true}).click(); await expect(page.getByRole('alertdialog')).toHaveCount(0); expect((await page.request.get('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${tokens.get(row.id)}`}})).status()).toBe(401);}
    await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
    for (const row of rows.slice(0, 10)) expect((await page.request.get('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${tokens.get(row.id)}`}})).status()).toBe(200);
    await page.getByLabel('每页条数', {exact: true}).selectOption('20'); await expect(page.getByRole('button', {name: /^强退会话 /})).toHaveCount(10);
    await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.getByLabel('用户名称', {exact: true})).toHaveValue(''); await expect(page.getByLabel('登录地址', {exact: true})).toHaveValue(''); expect(errors).toEqual([]);
  } finally {expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [account.id]}})).status()).toBe(204);}
});
test('real self force logout invalidates the browser session and returns to login', async ({page}) => {
  const {token} = await login(page), id = idOf(token);
  await page.getByLabel('用户名称', {exact: true}).fill('admin'); await page.getByLabel('每页条数', {exact: true}).selectOption('100'); await page.getByRole('button', {name: '搜索', exact: true}).click();
  await page.getByRole('button', {name: `强退会话 ${id}`, exact: true}).click(); await expect(page.getByRole('alertdialog')).toContainText(id); await page.getByRole('button', {name: '确认强退', exact: true}).click();
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
  expect((await page.request.get('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${token}`}})).status()).toBe(401);
});
