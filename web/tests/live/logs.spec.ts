import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';
import type {OperationLogResponse, LoginLogResponse} from '../../generated/api';

async function login(page: Page, path: string, title: string) {
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('admin');
  await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  return {Authorization: `Bearer ${token}`};
}
async function exportXml(page: Page, filename: string) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出', exact: true}).click();
  const download = await pending; expect(download.suggestedFilename()).toBe(filename);
  return workbookXml(await readFile((await download.path())!));
}

test('real operation audit details, inert JSON, clipboard, XLSX, paging recovery and clear', async ({page, context}) => {
  test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const headers = await login(page, '/operlog', '操作日志'), prefix = `log-${Date.now()}`, postIds: string[] = [];
  // This disposable database is owned by the integration harness. Start with an empty audit history;
  // clear itself may asynchronously create a new record, which the INSERT-only filter excludes.
  expect((await page.request.post('/api/v1/monitor/operation-logs/clear', {headers})).status()).toBe(204);
  try {
    for (let index = 0; index < 12; index++) {
      const response = await page.request.post('/api/v1/system/posts', {headers, data: {code: `${prefix}-${index}`, name: `${prefix}-${index}`, sort: index, status: '0', remark: '<img src=x onerror="document.body.dataset.logAttack=1">'}});
      expect(response.status()).toBe(201); postIds.push((await response.json()).id);
    }
    let rows: OperationLogResponse[] = [];
    await expect.poll(async () => {const response = await page.request.get('/api/v1/monitor/operation-logs?title=岗位管理&businessType=1&status=0&pageSize=100', {headers}); expect(response.status()).toBe(200); rows = (await response.json()).items; return rows.length;}, {timeout: 15000}).toBe(12);
    await page.getByRole('textbox', {name: '系统模块', exact: true}).fill('岗位管理');
    await page.getByRole('textbox', {name: '操作人员', exact: true}).fill('admin');
    await page.getByRole('combobox', {name: '操作类型', exact: true}).selectOption('1');
    await page.getByRole('combobox', {name: '操作状态', exact: true}).selectOption('0');
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('开始日期', {exact: true}).fill(today); await page.getByLabel('结束日期', {exact: true}).fill(today);
    await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    const id = rows[0]!.id;
    await page.getByRole('button', {name: `详细日志 ${id}`, exact: true}).click(); const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('请求参数', {exact: true})).toContainText(prefix);
    await expect(dialog.getByLabel('请求参数', {exact: true})).toContainText('<img'); await expect(dialog.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.dataset.logAttack)).toBeUndefined();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await dialog.getByRole('button', {name: '复制请求参数', exact: true}).click(); await expect(dialog.getByText('已复制。', {exact: true})).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(prefix);
    await expect(dialog.getByLabel('返回参数', {exact: true})).toContainText('201'); await page.keyboard.press('Escape');
    await page.getByRole('button', {name: '消耗时间', exact: true}).click();
    const xml = await exportXml(page, '操作日志.xlsx'); expect(xml).toContain(prefix); expect(xml).toContain('岗位管理');
    // Return to stable time ordering before deleting the two rows on the last page.
    await page.getByRole('button', {name: '操作日期', exact: true}).click();
    await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
    const lastIds = rows.slice(-2).map(row => row.id);
    expect(lastIds).toHaveLength(2); for (const logId of lastIds) await page.getByRole('checkbox', {name: `选择日志 ${logId}`, exact: true}).check();
    await page.getByRole('button', {name: '删除', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click();
    await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
    for (const logId of lastIds) expect((await page.request.get(`/api/v1/monitor/operation-logs/${logId}`, {headers})).status()).toBe(404);
    await page.getByText('列显示', {exact: true}).click(); await page.getByRole('checkbox', {name: '操作地点', exact: true}).uncheck();
    await expect(page.getByRole('columnheader', {name: '操作地点', exact: true})).toHaveCount(0); await page.getByText('列显示', {exact: true}).click();
    await page.getByRole('button', {name: '清空', exact: true}).click(); await page.keyboard.press('Escape'); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: '清空', exact: true}).click(); await page.getByRole('button', {name: '确认清空', exact: true}).click(); await expect(page.getByText('暂无日志', {exact: true})).toBeVisible();
    expect((await page.request.get(`/api/v1/monitor/operation-logs/${id}`, {headers})).status()).toBe(404); expect(errors).toEqual([]);
  } finally {
    if (postIds.length) expect((await page.request.delete('/api/v1/system/posts', {headers, data: {ids: postIds}})).status()).toBe(204);
  }
});

test('real login failure history, Redis password-lock unlock, session survival, export and deletion', async ({page}) => {
  test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const headers = await login(page, '/logininfor', '登录日志'), username = `lg${Date.now()}`;
  const created = await page.request.post('/api/v1/system/users', {headers, data: {user: {username, displayName: '日志解锁验证', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}});
  expect(created.status()).toBe(201); const account = await created.json();
  try {
    const firstLogin = await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}}); expect(firstLogin.status()).toBe(200);
    const readerHeaders = {Authorization: `Bearer ${(await firstLogin.json()).accessToken}`};
    expect((await page.request.get('/api/v1/monitor/login-logs', {headers: readerHeaders})).status()).toBe(403);
    for (let index = 0; index < 5; index++) expect((await page.request.post('/api/v1/auth/login', {data: {username, password: 'incorrect'}})).status()).toBe(401);
    expect((await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}})).status()).toBe(401);
    let rows: LoginLogResponse[] = [];
    await expect.poll(async () => {const response = await page.request.get(`/api/v1/monitor/login-logs?username=${username}&status=1&pageSize=100`, {headers}); rows = (await response.json()).items; return rows.length;}, {timeout: 15000}).toBe(6);
    await page.getByRole('textbox', {name: '用户名称', exact: true}).fill(username); await page.getByRole('combobox', {name: '登录状态', exact: true}).selectOption('1');
    await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByRole('checkbox', {name: `选择日志 ${rows[0]!.id}`, exact: true})).toBeVisible();
    const xml = await exportXml(page, '登录日志.xlsx'); expect(xml).toContain(username); expect(xml).toContain('失败');
    await page.getByRole('button', {name: '用户名称', exact: true}).click();
    await page.getByRole('checkbox', {name: `选择日志 ${rows[0]!.id}`, exact: true}).check(); await page.getByRole('button', {name: '解锁', exact: true}).click();
    await expect(page.getByRole('alertdialog')).toContainText(username); await page.getByRole('button', {name: '确认解锁', exact: true}).click();
    await expect(page.getByText(`账号 ${username} 已解锁。`, {exact: true})).toBeVisible();
    expect((await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}})).status()).toBe(200);
    expect((await page.request.get('/api/v1/app/bootstrap', {headers: readerHeaders})).status()).toBe(200);
    for (const row of rows) await page.getByRole('checkbox', {name: `选择日志 ${row.id}`, exact: true}).check();
    await page.getByRole('button', {name: '删除', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无日志', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: '重置', exact: true}).click(); await page.getByRole('button', {name: '清空', exact: true}).click(); await page.getByRole('button', {name: '确认清空', exact: true}).click();
    await expect(page.getByText('暂无日志', {exact: true})).toBeVisible(); expect(errors).toEqual([]);
  } finally {expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [account.id]}})).status()).toBe(204);}
});
