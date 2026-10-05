import {test, expect} from '@playwright/test';
const backend = process.env.EFORGE_E2E_BACKEND_URL!;
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';
import type {Page} from '@playwright/test';
import type {JobLogResponse} from '../../generated/api';
async function login(page: Page, path = '/job') {
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: path === '/job' ? '定时任务' : '调度日志', exact: true})).toBeVisible();
  return {Authorization: `Bearer ${await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string)}`};
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出', exact: true}).click(); const file = await pending; expect(file.suggestedFilename()).toBe(name); return workbookXml(await readFile((await file.path())!));
}

test('actual tasks and Quartz logs retain original context, details, sorting, XLSX, paging and destructive confirmations', async ({page}) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let savedRemark = '';
  const headers = await login(page), prefix = `jt${Date.now()}`, ids: string[] = [];
  try {
    for (let i = 0; i < 12; i++) {
      const name = `${prefix}-${String(i).padStart(2, '0')}`, target = i === 11 ? 'ryTask.missingMethod()' : `ryTask.ryParams('${prefix}<img>')`;
      const response = await page.request.post(`${backend}/monitor/job`, {headers, data: {jobName: name, jobGroup: 'SYSTEM', invokeTarget: target, cronExpression: '0 0 0 1 1 ? 2099', misfirePolicy: '3', concurrent: '1', status: '1', remark: '<img src=x onerror="document.body.dataset.jobAttack=1">'}});
      expect((await response.json()).code).toBe(200); const list = await page.request.get(`/api/v1/monitor/jobs?name=${name}`, {headers}); expect(list.status()).toBe(200); const task = (await list.json()).items[0]; ids.push(task.id); if (i === 0) {savedRemark = task.remark; expect(savedRemark).toContain('<img');}
      expect((await (await page.request.put(`${backend}/monitor/job/run`, {headers, data: {jobId: task.id, jobGroup: 'SYSTEM'}})).json()).code).toBe(200);
    }
    let logs: JobLogResponse[] = [];
    await expect.poll(async () => {const response = await page.request.get(`/api/v1/monitor/job-logs?name=${prefix}&pageSize=100`, {headers}); expect(response.status()).toBe(200); logs = (await response.json()).items; return logs.length;}, {timeout: 15000}).toBe(12);
    await page.getByRole('textbox', {name: '任务名称', exact: true}).fill(prefix); await page.getByRole('combobox', {name: '任务组名', exact: true}).selectOption('SYSTEM'); await page.getByRole('combobox', {name: '任务状态', exact: true}).selectOption('1'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: `详细任务 ${ids[0]}`, exact: true}).click(); let dialog = page.getByRole('dialog'); await expect(dialog).toContainText('2099'); await expect(dialog).toContainText('不触发立即执行'); await expect(dialog).toContainText(savedRemark); await expect(dialog.locator('img,script')).toHaveCount(0); await page.keyboard.press('Escape'); expect(await page.evaluate(() => document.body.dataset.jobAttack)).toBeUndefined();
    await page.getByRole('button', {name: '任务名称', exact: true}).click(); const taskXml = await download(page, '定时任务.xlsx'); expect(taskXml).toContain(`${prefix}-11`); expect(taskXml).toContain(`${prefix}-00`); expect(taskXml.indexOf(`${prefix}-00`)).toBeLessThan(taskXml.indexOf(`${prefix}-11`));
    await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '上一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: `任务日志 ${ids[0]}`, exact: true}).click(); await expect(page.getByRole('heading', {name: '调度日志', exact: true})).toBeVisible(); await expect(page.getByRole('textbox', {name: '任务名称', exact: true})).toHaveValue(`${prefix}-00`); await expect(page.getByText('共 1 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: '关闭调度日志'}).click(); await expect(page.getByRole('heading', {name: '定时任务', exact: true})).toBeVisible(); await page.getByRole('button', {name: '全部调度日志'}).click(); await expect(page.getByRole('heading', {name: '调度日志', exact: true})).toBeVisible();
    await page.getByRole('textbox', {name: '任务名称', exact: true}).fill(prefix); await page.getByRole('combobox', {name: '任务组名', exact: true}).selectOption('SYSTEM'); const today = await page.evaluate(() => {const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;}); await page.getByLabel('开始日期').fill(today); await page.getByLabel('结束日期').fill(today); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
    await page.getByRole('combobox', {name: '执行状态', exact: true}).selectOption('1'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 1 条，第 1 页', {exact: true})).toBeVisible(); const failure = logs.find(row => row.status === '1')!;
    await page.getByRole('button', {name: `详细日志 ${failure.id}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('异常信息')).toContainText('NoSuchMethodException'); await expect(dialog).toContainText('开始时间'); await page.keyboard.press('Escape');
    await page.getByRole('combobox', {name: '执行状态', exact: true}).selectOption(''); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '执行时间', exact: true}).click();
    const sorted = (await (await page.request.get(`/api/v1/monitor/job-logs?name=${prefix}&direction=asc&pageSize=100`, {headers})).json()).items as JobLogResponse[];
    const logXml = await download(page, '任务调度日志.xlsx'); for (const row of sorted) expect(logXml).toContain(row.name!); expect(logXml.indexOf(sorted[0]!.name!)).toBeLessThan(logXml.indexOf(sorted[11]!.name!));
    await page.getByText('列显示', {exact: true}).click(); await page.getByRole('checkbox', {name: '日志信息', exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '日志信息', exact: true})).toHaveCount(0); await page.getByText('列显示', {exact: true}).click();
    await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); for (const row of sorted.slice(-2)) await page.getByRole('checkbox', {name: `选择日志 ${row.id}`, exact: true}).check();
    await page.getByRole('button', {name: '删除', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible(); for (const row of sorted.slice(-2)) expect((await page.request.get(`/api/v1/monitor/job-logs/${row.id}`, {headers})).status()).toBe(404);
    await page.getByRole('button', {name: '清空', exact: true}).click(); await page.keyboard.press('Escape'); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '清空', exact: true}).click(); await page.getByRole('button', {name: '确认清空'}).click(); await expect(page.getByText('暂无记录', {exact: true})).toBeVisible(); expect((await (await page.request.get(`/api/v1/monitor/job-logs?name=${prefix}`, {headers})).json()).total).toBe(0); expect(errors).toEqual([]);
  } finally {if (ids.length) expect((await (await page.request.delete(`${backend}/monitor/job/${ids.join(',')}`, {headers})).json()).code).toBe(200);}
});

test('actual no-role account cannot enter task or log pages or read their APIs', async ({page}) => {
  const headers = await login(page), username = `jr${Date.now()}`;
  const response = await page.request.post('/api/v1/system/users', {headers, data: {user: {username, displayName: '任务无权限', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}}); expect(response.status()).toBe(201); const user = await response.json();
  try {
    await page.evaluate(() => sessionStorage.removeItem('eforge.enterprise.session.v1')); await page.goto('/job/log/0'); await page.getByLabel('账号', {exact: true}).fill(username); await page.getByLabel('密码', {exact: true}).fill('User12345'); await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
    const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string); for (const path of ['/api/v1/monitor/jobs', '/api/v1/monitor/job-logs']) expect((await page.request.get(path, {headers: {Authorization: `Bearer ${token}`}})).status()).toBe(403);
    await page.goto('/job'); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); await page.setViewportSize({width: 375, height: 812}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [user.id]}})).status()).toBe(204);}
});