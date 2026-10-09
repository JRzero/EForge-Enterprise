import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const id = '9007199254740993';
const operation = {id, title: '<script>模块</script>', businessType: 2, operator: '张三', ip: '127.0.0.1', location: '地点', status: '1', operatedAt: '2026-10-05T00:00:00Z', duration: 123};
const loginRow = {id, username: '张 & 用户', ip: '127.0.0.1', location: '地点', browser: 'Chrome', operatingSystem: 'Linux', status: '1', message: '<script>密码错误</script>', loggedInAt: '2026-10-05T00:00:00Z'};
async function login(page: Page, path: string, permissions: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '测试账号'}, roles: [], permissions, navigation: [{key: 'system', type: 'GROUP', label: '系统管理', order: 0, children: [{key: 'system-logs', type: 'GROUP', label: '日志管理', order: 9, children: [{key: 'monitor-operation-logs', type: 'ROUTE', routeId: 'monitor-operation-logs', label: '操作日志', order: 1, children: []}, {key: 'monitor-login-logs', type: 'ROUTE', routeId: 'monitor-login-logs', label: '登录日志', order: 2, children: []}]}]}]}}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_oper_type', route => route.fulfill({json: [{value: '2', label: '编辑标签', style: 'SUCCESS', defaultEntry: false}, {value: '3', label: '删除标签', style: 'DANGER', defaultEntry: false}]}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_common_status', route => route.fulfill({json: [{value: '0', label: '成功标签', style: 'SUCCESS', defaultEntry: false}, {value: '1', label: '失败标签', style: 'DANGER', defaultEntry: false}]}));
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('object-model list template aligns mixed filters without a visible heading block',async({page},info)=>{
  await page.route('**/api/v1/monitor/operation-logs?*',route=>route.fulfill({json:{items:[operation],total:1,page:1,pageSize:10}}));
  await page.setViewportSize({width:1600,height:1000});await login(page,'/operlog',['monitor:operlog:list']);
  await expect(page.getByRole('cell',{name:id,exact:true})).toBeVisible();
  await expect(page.locator('.list-page > header')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('list-desktop.png'),fullPage:true});
  for(const field of await page.locator('.list-filter-field').all()) {
    const metrics=await field.evaluate(el=>{const label=el.querySelector('label')!,control=el.querySelector('input,select')!;const a=label.getBoundingClientRect(),b=control.getBoundingClientRect();return {labelX:a.x,controlX:b.x,labelY:a.y,labelHeight:a.height,controlY:b.y,controlHeight:b.height};});
    expect(metrics.controlX).toBeGreaterThan(metrics.labelX+8);
    expect(Math.abs(metrics.labelY+metrics.labelHeight/2-metrics.controlY-metrics.controlHeight/2)).toBeLessThanOrEqual(3);
  }
  const fields=await page.locator('.list-filter-field').all();
  for(let i=1;i<fields.length;i++) {
    const previous=(await fields[i-1]!.boundingBox())!,current=(await fields[i]!.boundingBox())!;
    if(Math.abs(previous.y-current.y)<3)expect(current.x-previous.x-previous.width).toBeGreaterThanOrEqual(12);
  }
  await page.screenshot({path:info.outputPath('list-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('list-mobile.png'),fullPage:true});
});
test('read-only operation logs use exact IDs/custom labels, recover failure and respect route grants/mobile bounds', async ({page}) => {
  let failure = true;
  await page.route('**/api/v1/monitor/operation-logs?*', route => route.fulfill(failure ? {status: 503, json: {}} : {json: {items: [operation], total: 1, page: 1, pageSize: 10}}));
  await login(page, '/operlog', ['monitor:operlog:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); failure = false; await page.getByRole('button', {name: '重试', exact: true}).click();
  await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: operation.title, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: '编辑标签', exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: '失败标签', exact: true})).toBeVisible();
  for (const name of ['删除', '清空', '导出', `详细日志 ${id}`]) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  expect(await page.locator('.logs-page script').count()).toBe(0); await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/logininfor'); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
});
test('operation detail safely formats data, retries/cancels, reports clipboard failure and supports legacy copy fallback', async ({page}) => {
  await page.route('**/api/v1/monitor/operation-logs?*', route => route.fulfill({json: {items: [operation], total: 1, page: 1, pageSize: 10}}));
  let fail = true;
  await page.route(`**/api/v1/monitor/operation-logs/${id}`, route => route.fulfill(fail ? {status: 503, json: {}} : {json: {entry: operation, requestParameters: '{"中文":"请求"}', responseBody: '<img src=x onerror="document.body.dataset.logAttack=1">', errorMessage: '<script>异常</script>', requestMethod: 'POST', url: '/接口', method: 'Controller.method', departmentName: '部门'}}));
  await page.addInitScript(() => {Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async (value: string) => {if ((window as unknown as {copyFail?: boolean}).copyFail) throw new Error('denied'); (window as unknown as {copied?: string}).copied = value;}}});});
  await login(page, '/operlog', ['monitor:operlog:list', 'monitor:operlog:query']); await page.getByRole('button', {name: `详细日志 ${id}`}).click(); let dialog = page.getByRole('dialog'); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); fail = false; await dialog.getByRole('button', {name: '重试详情'}).click();
  await expect(dialog.getByLabel('请求参数', {exact: true})).toHaveText('{\n  "中文": "请求"\n}'); await expect(dialog.getByLabel('返回参数', {exact: true})).toHaveText('<img src=x onerror="document.body.dataset.logAttack=1">'); await expect(dialog.getByLabel('异常信息')).toHaveText('<script>异常</script>'); expect(await dialog.locator('img, script').count()).toBe(0);
  await dialog.getByRole('button', {name: '复制请求参数'}).click(); await expect(dialog.getByText('已复制。', {exact: true})).toBeVisible(); expect(await page.evaluate(() => (window as unknown as {copied?: string}).copied)).toContain('\n  "中文"');
  await page.evaluate(() => {(window as unknown as {copyFail?: boolean}).copyFail = true;}); await dialog.getByRole('button', {name: '复制返回参数'}).click(); await expect(dialog.getByRole('alert')).toContainText('复制未完成');
  await page.evaluate(() => {Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true}); Object.defineProperty(document, 'execCommand', {configurable: true, value: () => {(window as unknown as {legacyCopy?: string}).legacyCopy = document.querySelector('textarea')?.value; return true;}});});
  await dialog.getByRole('button', {name: '复制返回参数'}).click(); expect(await page.evaluate(() => (window as unknown as {legacyCopy?: string}).legacyCopy)).toContain('<img'); expect(await page.locator('textarea').count()).toBe(0);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  let aborted = false; page.on('requestfailed', request => {if (request.url().endsWith(`/operation-logs/${id}`)) aborted = true;}); await page.route(`**/api/v1/monitor/operation-logs/${id}`, async route => {await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill({json: {entry: operation}}).catch(() => {});});
  await page.getByRole('button', {name: `详细日志 ${id}`}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByText('正在加载日志…', {exact: true})).toBeVisible(); await page.keyboard.press('Escape'); await expect.poll(() => aborted).toBe(true);
});
test('operation filters, two-way server sort, applied export, columns and retryable destructive confirmation work together', async ({page}) => {
  const queries: URLSearchParams[] = []; let items = [operation], deleted: unknown, failDelete = true, clearCalls = 0, exported: URLSearchParams | undefined;
  await page.route('**/api/v1/monitor/operation-logs?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill({json: {items, total: items.length, page: 1, pageSize: 10}});});
  await page.route('**/api/v1/monitor/operation-logs', route => {deleted = route.request().postDataJSON(); if (failDelete) return route.fulfill({status: 503, json: {}}); items = []; return route.fulfill({status: 204});});
  await page.route('**/api/v1/monitor/operation-logs/clear', route => {clearCalls++; return route.fulfill({status: 204});});
  await page.route('**/api/v1/monitor/operation-logs/export?*', route => {exported = new URL(route.request().url()).searchParams; return route.fulfill({body: Buffer.from([80, 75, 3, 4]), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});});
  await login(page, '/operlog', ['monitor:operlog:list', 'monitor:operlog:remove', 'monitor:operlog:export']); await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible();
  const initialQueries = queries.length; await page.getByLabel('开始日期').fill('2026-10-05'); await page.getByLabel('结束日期').fill('2026-10-01'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('开始日期不能晚于'); expect(queries).toHaveLength(initialQueries);
  await page.getByLabel('开始日期').fill('2026-10-01'); await page.getByLabel('结束日期').fill('2026-10-05'); await page.getByRole('textbox', {name: '系统模块', exact: true}).fill('模块 & /'); await page.getByRole('textbox', {name: '操作人员', exact: true}).fill('张 & /'); await page.getByRole('textbox', {name: '操作地址', exact: true}).fill('127.'); await page.getByRole('combobox', {name: '操作类型', exact: true}).selectOption('2'); await page.getByRole('combobox', {name: '操作状态', exact: true}).selectOption('0'); await page.getByRole('button', {name: '搜索', exact: true}).click();
  await expect.poll(() => queries.at(-1)?.get('title')).toBe('模块 & /'); expect(queries.at(-1)?.get('status')).toBe('0'); expect(queries.at(-1)?.get('from')).toBe('2026-10-01');
  await page.getByRole('button', {name: '消耗时间', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('sort')).toBe('duration'); await expect.poll(() => queries.at(-1)?.get('direction')).toBe('desc'); await page.getByRole('button', {name: '消耗时间', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('direction')).toBe('asc'); await page.getByRole('button', {name: '消耗时间', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('direction')).toBe('desc');
  await page.getByRole('textbox', {name: '系统模块', exact: true}).fill('未提交'); const download = page.waitForEvent('download'); await page.getByRole('button', {name: '导出', exact: true}).click(); expect((await download).suggestedFilename()).toBe('操作日志.xlsx'); expect(exported?.get('title')).toBe('模块 & /'); expect(exported?.get('from')).toBe('2026-10-01'); expect(exported?.get('sort')).toBe('duration'); expect(exported?.has('page')).toBe(false);
  await page.getByText('列显示', {exact: true}).click(); await page.getByRole('checkbox', {name: '操作地点', exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '操作地点', exact: true})).toHaveCount(0);
  await page.getByRole('checkbox', {name: `选择日志 ${id}`, exact: true}).check(); await page.getByRole('button', {name: '删除', exact: true}).click(); const dialog = page.getByRole('alertdialog'); await dialog.getByRole('button', {name: '确认删除'}).click(); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); expect(deleted).toEqual({ids: [id]}); failDelete = false; await dialog.getByRole('button', {name: '确认删除'}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('暂无日志', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '清空', exact: true}).click(); await page.keyboard.press('Escape'); expect(clearCalls).toBe(0); await page.getByRole('button', {name: '清空', exact: true}).click(); await page.getByRole('alertdialog').getByRole('button', {name: '确认清空'}).click(); await expect.poll(() => clearCalls).toBe(1);
  await page.getByRole('button', {name: '隐藏搜索'}).click(); await expect(page.getByRole('textbox', {name: '系统模块', exact: true})).toBeHidden(); await page.getByRole('button', {name: '显示搜索'}).click(); await page.getByRole('button', {name: '重置', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('sort')).toBe('time'); expect(queries.at(-1)?.get('from')).toBe(null);
});
test('login log search, sorting, paging and unlock permission/failure/cancel preserve exact account', async ({page}) => {
  const queries: URLSearchParams[] = []; let failUnlock = true, unlock: unknown;
  await page.route('**/api/v1/monitor/login-logs?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill({json: {items: [loginRow, {...loginRow, id: '9007199254740995', username: '另一个'}], total: 12, page: 1, pageSize: 10}});});
  await page.route('**/api/v1/monitor/login-logs/unlock', route => {unlock = route.request().postDataJSON(); return route.fulfill(failUnlock ? {status: 503, json: {code: 'LOGIN_UNLOCK_UNAVAILABLE'}} : {status: 204});});
  await login(page, '/logininfor', ['monitor:logininfor:list', 'monitor:logininfor:unlock']); await expect(page.getByRole('row').filter({has: page.getByRole('cell', {name: id, exact: true})}).getByRole('cell', {name: loginRow.message, exact: true})).toBeVisible(); for (const name of ['删除', '清空', '导出']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '解锁', exact: true})).toBeDisabled(); await page.getByRole('checkbox', {name: `选择日志 ${id}`, exact: true}).check(); await page.getByRole('checkbox', {name: '选择日志 9007199254740995', exact: true}).check(); await expect(page.getByRole('button', {name: '解锁', exact: true})).toBeDisabled(); await page.getByRole('checkbox', {name: '选择日志 9007199254740995', exact: true}).uncheck();
  await page.getByRole('button', {name: '解锁', exact: true}).click(); const dialog = page.getByRole('alertdialog'); await expect(dialog).toContainText(loginRow.username); await page.keyboard.press('Escape'); expect(unlock).toBeUndefined(); await page.getByRole('button', {name: '解锁', exact: true}).click(); await dialog.getByRole('button', {name: '确认解锁'}).click(); await expect(dialog.getByRole('alert')).toContainText('账号解锁'); expect(unlock).toEqual({username: loginRow.username}); failUnlock = false; await dialog.getByRole('button', {name: '确认解锁'}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText(`账号 ${loginRow.username} 已解锁。`)).toBeVisible();
  await page.getByRole('textbox', {name: '用户名称', exact: true}).fill('账号 & /'); await page.getByRole('textbox', {name: '登录地址', exact: true}).fill('127.'); await page.getByRole('combobox', {name: '登录状态', exact: true}).selectOption('1'); await page.getByRole('button', {name: '搜索', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('username')).toBe('账号 & /'); expect(queries.at(-1)?.get('status')).toBe('1');
  await page.getByRole('button', {name: '用户名称', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('sort')).toBe('username'); await page.getByRole('button', {name: '下一页'}).click(); await expect.poll(() => queries.at(-1)?.get('page')).toBe('2'); await page.getByLabel('每页条数').selectOption('20'); await expect.poll(() => queries.at(-1)?.get('page')).toBe('1'); expect(queries.at(-1)?.get('pageSize')).toBe('20');
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
