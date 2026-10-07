import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const id = '9007199254740993', job = {id, name: '<script>任务</script>', group: 'SYSTEM', invokeTarget: "ryTask.ryParams('<img>')", cronExpression: '0 0 0 1 1 ? 2099', misfirePolicy: '3', concurrent: false, status: '1', remark: '<img src=x onerror=alert(1)>', createdAt: '2026-10-05T00:00:00Z', nextExecutionAt: '2099-01-01T00:00:00Z'};
const row = {id, name: job.name, group: 'SYSTEM', invokeTarget: job.invokeTarget, status: '1', message: '<img>日志', createdAt: '2026-10-05T00:00:00Z', startedAt: '2026-10-05T00:00:00Z', endedAt: '2026-10-05T00:00:01Z'};
async function login(page: Page, path: string, permissions: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '账号'}, roles: [], permissions, navigation: [{key: 'monitor', type: 'GROUP', label: '系统监控', order: 0, children: [{key: 'monitor-jobs', type: 'ROUTE', routeId: 'monitor-jobs', label: '定时任务', order: 1, children: []}]}]}}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_job_group', route => route.fulfill({json: [{value: 'SYSTEM', label: '系统分组标签', style: 'SUCCESS', defaultEntry: true}]}));
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('task read permissions, retry, server sorting and mobile route denial', async ({page}) => {
  let fail = true; const queries: URLSearchParams[] = [];
  await page.route('**/api/v1/monitor/jobs?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill(fail ? {status: 503, json: {}} : {json: {items: [job], total: 1, page: 1, pageSize: 10}});});
  await login(page, '/job', ['monitor:job:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false; await page.getByRole('button', {name: '重试', exact: true}).click();
  await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); await expect(page.getByRole('button', {name: `详细任务 ${id}`})).toHaveCount(0); await expect(page.getByRole('button', {name: '导出', exact: true})).toHaveCount(0);
  await page.getByRole('textbox', {name: '任务名称', exact: true}).fill('任务 & name'); await page.getByRole('combobox', {name: '任务组名', exact: true}).selectOption('SYSTEM'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('name')).toBe('任务 & name');
  await page.getByRole('button', {name: '任务名称', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('sort')).toBe('name');
  await page.setViewportSize({width: 375, height: 812}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '账号'}, roles: [], permissions: [], navigation: []}})); await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
});

test('task detail is inert, scoped log context and close return to actual task page', async ({page}) => {
  await page.route('**/api/v1/monitor/jobs?*', route => route.fulfill({json: {items: [job], total: 1, page: 1, pageSize: 10}}));
  await page.route(`**/api/v1/monitor/jobs/${id}`, route => route.fulfill({json: job}));
  const queries: URLSearchParams[] = []; await page.route('**/api/v1/monitor/job-logs?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill({json: {items: [row], total: 1, page: 1, pageSize: 10}});});
  await login(page, '/job', ['monitor:job:list', 'monitor:job:query']); await page.getByRole('button', {name: `详细任务 ${id}`}).click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText(job.remark); await expect(dialog.locator('img,script')).toHaveCount(0); await expect(dialog).toContainText('不触发立即执行'); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: `任务日志 ${id}`, exact: true}).click(); await expect(page.getByRole('heading', {name: '调度日志', exact: true})).toBeVisible(); await expect.poll(() => queries.at(-1)?.get('name')).toBe(job.name); expect(queries.at(-1)?.get('group')).toBe('SYSTEM');
  await expect(page.getByRole('button', {name: '删除', exact: true})).toHaveCount(0); await page.getByRole('button', {name: '关闭调度日志'}).click(); await expect(page.getByRole('heading', {name: '定时任务', exact: true})).toBeVisible();
});

test('task logs filter dates, retry details/mutations, inert exception, sorted export and last-page recovery', async ({page}) => {
  let total = 12, failDetail = true, failDelete = true; const queries: URLSearchParams[] = []; let deleted: unknown, exported: URLSearchParams | undefined;
  await page.route('**/api/v1/monitor/job-logs?*', route => {const q = new URL(route.request().url()).searchParams; queries.push(q); const p = Number(q.get('page') ?? 1), size = Number(q.get('pageSize') ?? 10); const items = Array.from({length: Math.max(0, Math.min(size, total - (p - 1) * size))}, (_, i) => ({...row, id: `${9007199254740993n + BigInt((p - 1) * size + i)}`})); return route.fulfill({json: {items, total, page: p, pageSize: size}});});
  await page.route('**/api/v1/monitor/job-logs/*', route => {if (new URL(route.request().url()).pathname.endsWith('/export')) {exported = new URL(route.request().url()).searchParams; return route.fulfill({body: 'PK', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});} if (new URL(route.request().url()).pathname.endsWith('/clear')) {total = 0; return route.fulfill({status: 204});} return route.fulfill(failDetail ? {status: 503, json: {}} : {json: {entry: row, exceptionInfo: '<script>window.attack=1</script>\nNoSuchMethodException'}});});
  await page.route('**/api/v1/monitor/job-logs', route => {deleted = route.request().postDataJSON(); if (!failDelete) total = 10; return route.fulfill(failDelete ? {status: 503, json: {}} : {status: 204});});
  await login(page, '/job/log/0', ['monitor:job:list', 'monitor:job:query', 'monitor:job:remove', 'monitor:job:export']); await page.getByRole('button', {name: `详细日志 ${id}`}).click(); const detail = page.getByRole('dialog'); await expect(detail.getByRole('alert')).toBeVisible(); failDetail = false; await detail.getByRole('button', {name: '重试详情'}).click(); await expect(detail.getByLabel('异常信息')).toContainText('<script>'); await expect(detail.locator('script,img')).toHaveCount(0); await page.keyboard.press('Escape');
  await page.getByLabel('开始日期').fill('2026-10-06'); await page.getByLabel('结束日期').fill('2026-10-05'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('开始日期'); await page.getByLabel('开始日期').fill('2026-10-01'); await page.getByRole('textbox', {name: '任务名称', exact: true}).fill('任务 & name'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('from')).toBe('2026-10-01');
  await page.getByRole('button', {name: '执行时间', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('direction')).toBe('asc'); const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出', exact: true}).click(); expect((await pending).suggestedFilename()).toBe('任务调度日志.xlsx'); expect(exported?.get('name')).toBe('任务 & name'); expect(exported?.get('direction')).toBe('asc'); expect(exported?.get('from')).toBe('2026-10-01');
  await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible(); for (const n of [10n, 11n]) await page.getByRole('checkbox', {name: `选择日志 ${9007199254740993n + n}`, exact: true}).check();
  await page.getByRole('button', {name: '删除', exact: true}).click(); const confirm = page.getByRole('alertdialog'); await confirm.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(confirm.getByRole('alert')).toBeVisible(); expect(deleted).toEqual({ids: ['9007199254741003', '9007199254741004']}); failDelete = false; await confirm.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(confirm).toHaveCount(0); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '清空', exact: true}).click(); await page.keyboard.press('Escape'); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '清空', exact: true}).click(); await page.getByRole('button', {name: '确认清空'}).click(); await expect(page.getByText('暂无记录', {exact: true})).toBeVisible();
});

test('task context failure never sends an unfiltered log request and retries safely', async ({page}) => {
  let fail = true, reads = 0; await page.route(`**/api/v1/monitor/jobs/${id}`, route => route.fulfill(fail ? {status: 503, json: {}} : {json: job}));
  await page.route('**/api/v1/monitor/job-logs?*', route => {reads++; return route.fulfill({json: {items: [row], total: 1, page: 1, pageSize: 10}});});
  await login(page, `/job/log/${id}`, ['monitor:job:list', 'monitor:job:query']); await expect(page.getByRole('alert')).toBeVisible(); expect(reads).toBe(0); fail = false; await page.getByRole('button', {name: '重试任务信息'}).click(); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); expect(reads).toBe(1);
  await page.setViewportSize({width: 375, height: 812}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
for(const logs of [false,true])test('cached '+(logs?'log':'task')+' export cancellation allows an explicit new download',async({page})=>{
  await page.route('**/api/v1/monitor/jobs?*',route=>route.fulfill({json:{items:[job],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/monitor/job-logs?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/me',route=>route.fulfill({json:{id:'2',username:'reader',displayName:'账号',sex:'2',roleNames:'',postNames:''}}));
  const exportPath='/api/v1/monitor/'+(logs?'job-logs':'jobs')+'/export';
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let reads=0;
  await page.route('**'+exportPath+'?*',async route=>{reads++;if(reads===1)await gate;await route.fulfill({body:'PK',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}).catch(()=>{});});
  await login(page,logs?'/job/log/0':'/job',['monitor:job:list','monitor:job:query','monitor:job:export']);
  const download=page.getByRole('button',{name:'导出',exact:true});await expect(download).toBeEnabled();
  const requested=page.waitForRequest(request=>new URL(request.url()).pathname===exportPath);await download.click();const pending=await requested;
  const cancelled=page.waitForEvent('requestfailed',{predicate:request=>request===pending});
  try{
    await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    expect((await cancelled).failure()?.errorText).toMatch(/abort|cancel/i);
  }finally{release();}
  await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：'+(logs?'调度日志':'定时任务'),exact:true}).click();
  await expect(download).toBeEnabled();expect(reads).toBe(1);
  const saved=page.waitForEvent('download');await download.click();expect((await saved).suggestedFilename()).toBe(logs?'任务调度日志.xlsx':'定时任务.xlsx');expect(reads).toBe(2);
});
for(const clear of [false,true])test('cached log '+(clear?'clear':'delete')+' keeps one pending write across browser history navigation',async({page})=>{
  let total=1;
  await page.route('**/api/v1/monitor/job-logs?*',route=>route.fulfill({json:{items:total?[row]:[],total,page:1,pageSize:10}}));
  await page.route('**/api/v1/me',route=>route.fulfill({json:{id:'2',username:'reader',displayName:'账号',sex:'2',roleNames:'',postNames:''}}));
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let writes=0;
  const writePath='/api/v1/monitor/job-logs'+(clear?'/clear':'');
  await page.route('**'+writePath,async route=>{writes++;await gate;total=0;await route.fulfill({status:204}).catch(()=>{});});
  await login(page,'/job/log/0',['monitor:job:list','monitor:job:query','monitor:job:remove']);
  await expect(page.getByRole('cell',{name:id,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
  const tabs=page.getByRole('navigation',{name:'页面标签'});await tabs.getByRole('link',{name:'页面标签：调度日志',exact:true}).click();
  if(!clear)await page.getByRole('checkbox',{name:'选择日志 '+id,exact:true}).check();
  await page.getByRole('button',{name:clear?'清空':'删除',exact:true}).click();
  const requested=page.waitForRequest(request=>new URL(request.url()).pathname===writePath&&request.method()===(clear?'POST':'DELETE'));
  await page.getByRole('alertdialog').getByRole('button',{name:clear?'确认清空':'确认删除',exact:true}).click();const pending=await requested;
  try{
    await page.goBack();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await tabs.getByRole('link',{name:'页面标签：调度日志',exact:true}).click();
    await expect(page.getByRole('alertdialog').getByRole('button',{name:clear?'确认清空':'确认删除',exact:true})).toBeDisabled();
    expect(pending.failure()).toBeNull();expect(writes).toBe(1);
  }finally{release();}
  await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(page.getByText(clear?'日志已清空。':'日志已删除。',{exact:true})).toBeVisible();
  await expect(page.getByText('暂无记录',{exact:true})).toBeVisible();expect(writes).toBe(1);
});