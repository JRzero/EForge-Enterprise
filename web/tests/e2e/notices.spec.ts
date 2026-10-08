import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const id = '9007199254740993', row = {id, title: '测试 <公告>', type: '2', content: '<h2>安全内容</h2><p><strong>正文</strong><a href="javascript:alert(1)">危险链接</a><img src="/missing-image.png" onerror="document.body.dataset.attack=1"></p>', status: '0', createdBy: 'reader', remark: ''};
const list = {items: [row], total: 1, page: 1, pageSize: 10};
async function login(page: Page, permissions: string[], path = '/notice') {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions, navigation: [{key: 'system-notices', type: 'ROUTE', routeId: 'system-notices', label: '通知公告', order: 0, children: []}]}}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_notice_type', route => route.fulfill({json: [{value: '1', label: '通知标签', style: 'WARNING', defaultEntry: false}, {value: '2', label: '公告标签', style: 'SUCCESS', defaultEntry: true}]}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_notice_status', route => route.fulfill({json: [{value: '0', label: '正常发布', style: 'SUCCESS', defaultEntry: true}, {value: '1', label: '关闭发布', style: 'DEFAULT', defaultEntry: false}]}));
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('read-only notice page recovers list errors, preserves exact IDs and safely previews content on mobile', async ({page}) => {
  let fail = true; await page.route('**/api/v1/system/notices?*', route => route.fulfill(fail ? {status: 503, json: {}} : {json: list}));
  await page.route(`**/api/v1/system/notices/${id}`, route => route.fulfill({json: row}));
  await login(page, ['system:notice:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false; await page.getByRole('button', {name: '重试列表'}).click();
  await expect(page.getByRole('cell', {name: id, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: '公告标签', exact: true})).toBeVisible();
  for (const name of ['新增公告', '修改所选公告', '删除所选公告', `修改 ${row.title}`, `删除 ${row.title}`]) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: `预览 ${row.title}`, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('heading', {name: '安全内容'})).toBeVisible();
  await expect(dialog.getByRole('link', {name: '危险链接'})).toHaveCount(0); expect(await dialog.locator('a').getAttribute('href')).toBeNull(); expect(await dialog.locator('img').getAttribute('onerror')).toBeNull();
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('notice editor validates original defaults, preserves failed drafts, sanitizes HTML and clears content', async ({page}) => {
  await page.route('**/api/v1/system/notices?*', route => route.fulfill({json: list})); await page.route(`**/api/v1/system/notices/${id}`, route => route.fulfill({json: row}));
  let fail = true; const bodies: Record<string, string>[] = [];
  await page.route('**/api/v1/system/notices', route => {bodies.push(route.request().postDataJSON()); return route.fulfill(fail ? {status: 503, json: {}} : {status: 201, json: row});});
  const updates: Record<string, string>[] = [];
  await page.route(`**/api/v1/system/notices/${id}`, route => route.request().method() === 'PUT' ? (updates.push(route.request().postDataJSON()), route.fulfill({status: 204})) : route.fulfill({json: row}));
  await login(page, ['system:notice:list', 'system:notice:add', 'system:notice:edit', 'system:notice:remove']);
  await page.getByRole('button', {name: '新增公告', exact: true}).click(); let dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('公告类型', {exact: true})).toHaveValue(''); await expect(dialog.getByRole('radio', {name: '正常发布'})).toBeChecked();
  await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog.getByRole('alert')).toContainText('请填写'); expect(bodies).toHaveLength(0);
  await dialog.getByLabel('公告标题', {exact: true}).fill('x'.repeat(51)); await dialog.getByLabel('公告类型', {exact: true}).selectOption('2'); await dialog.getByRole('button', {name: '保存公告'}).click(); expect(bodies).toHaveLength(0);
  await dialog.getByLabel('公告标题', {exact: true}).fill('新增 <标题>'); const editor = dialog.getByRole('textbox', {name: '公告内容'}); await editor.fill('原始内容'); await editor.press('Control+a');
  await editor.evaluate(element => {const clipboardData = new DataTransfer(); clipboardData.setData('text/html', '<p><em>富文本</em><a href="javascript:evil">坏链接</a><script>evil</script></p>'); element.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true, cancelable: true}));});
  await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); await expect(dialog.getByLabel('公告标题', {exact: true})).toHaveValue('新增 <标题>');
  expect(bodies[0]?.content).toContain('<em>富文本</em>'); expect(bodies[0]?.content).not.toMatch(/script|javascript:/); fail = false; await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('checkbox', {name: `选择公告 ${row.title}`, exact: true}).check(); await page.getByRole('button', {name: '修改所选公告'}).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('textbox', {name: '公告内容'}).fill(''); await dialog.getByRole('radio', {name: '关闭发布'}).check(); await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog).toHaveCount(0); expect(updates[0]).toMatchObject({content: '', status: '1', remark: ''});
});

test('notice filters, reader search/paging, retry and cancelled detail preserve boundaries', async ({page}) => {
  const queries: URLSearchParams[] = []; await page.route('**/api/v1/system/notices?*', route => {queries.push(new URL(route.request().url()).searchParams); return route.fulfill({json: list});});
  const readerQueries: URLSearchParams[] = []; let readersFail = true;
  await page.route(`**/api/v1/system/notices/${id}/readers?*`, route => {readerQueries.push(new URL(route.request().url()).searchParams); return route.fulfill(readersFail ? {status: 503, json: {}} : {json: {items: [{userId: id, username: 'reader', displayName: '读者姓名', departmentName: '部门', phone: '123', readAt: '2026-10-05T00:00:00Z'}], total: 12, page: 1, pageSize: 10}});});
  await login(page, ['system:notice:list']); await expect(page.getByRole('cell', {name: row.title, exact: true})).toBeVisible();
  await page.getByLabel('公告标题筛选').fill('中文 & 公告'); await page.getByLabel('操作人员筛选').fill('作者 / &'); await page.getByLabel('公告类型筛选').selectOption('1'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('type')).toBe('1'); expect(queries.at(-1)?.get('author')).toBe('作者 / &');
  await page.getByRole('button', {name: `已读用户 ${row.title}`, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); readersFail = false; await dialog.getByRole('button', {name: '重试读者'}).click(); await expect(dialog.getByRole('cell', {name: '读者姓名', exact: true})).toBeVisible();
  await dialog.getByLabel('读者账号或姓名').fill('姓名 & 搜索'); await dialog.getByRole('button', {name: '搜索读者'}).click(); await expect.poll(() => readerQueries.at(-1)?.get('search')).toBe('姓名 & 搜索'); await dialog.getByRole('button', {name: '读者下一页'}).click(); await expect.poll(() => readerQueries.at(-1)?.get('page')).toBe('2');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  let aborted = false; page.on('requestfailed', request => {if (request.url().endsWith(`/notices/${id}`)) aborted = true;}); await page.route(`**/api/v1/system/notices/${id}`, () => {});
  await page.getByRole('button', {name: `预览 ${row.title}`, exact: true}).click(); await expect(page.getByRole('dialog').getByText('正在加载公告…', {exact: true})).toBeVisible(); await page.keyboard.press('Escape'); await expect.poll(() => aborted).toBe(true);
  await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.getByLabel('公告标题筛选')).toHaveValue(''); await expect.poll(() => queries.at(-1)?.get('type')).toBe(null);
});

test('top notices remain available without management grants and only confirm persisted read state', async ({page}) => {
  let read = false, failMark = true, feedFail = true; const marks: unknown[] = [];
  await page.route('**/api/v1/system/notices/feed', route => route.fulfill(feedFail ? {status: 503, json: {}} : {json: {items: [{id, title: row.title, type: '2', read}], unreadCount: read ? 0 : 1}}));
  await page.route(`**/api/v1/system/notices/${id}`, route => route.fulfill({json: row}));
  await page.route('**/api/v1/system/notices/read', route => {marks.push(route.request().postDataJSON()); if (!failMark) read = true; return route.fulfill(failMark ? {status: 503, json: {}} : {status: 204});});
  await login(page, ['app:dashboard:view'], '/dashboard'); await page.getByRole('button', {name: /^通知公告（/}).click(); let panel = page.getByRole('region', {name: '顶部公告列表'}); await expect(panel.getByRole('alert')).toContainText('服务暂时不可用'); feedFail = false; await panel.getByRole('button', {name: '重试公告'}).click(); await expect(page.getByRole('button', {name: '通知公告（1 条未读）'})).toBeVisible();
  await panel.getByRole('button', {name: '全部已读', exact: true}).click(); await expect(panel.getByRole('alert')).toContainText('已读状态未保存'); await expect(page.getByRole('button', {name: '通知公告（1 条未读）'})).toBeVisible(); expect(marks[0]).toEqual({ids: [id]});
  await panel.getByRole('button', {name: `阅读 ${row.title}（未读）`, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('heading', {name: '安全内容'})).toBeVisible(); await expect(dialog.getByRole('alert')).toContainText('已读状态未保存');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); failMark = false; await page.getByRole('button', {name: /^通知公告（/}).click(); panel = page.getByRole('region', {name: '顶部公告列表'}); await panel.getByRole('button', {name: '全部已读', exact: true}).click(); await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible(); await expect(panel.getByRole('button', {name: `阅读 ${row.title}（已读）`, exact: true})).toBeVisible();
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0); await page.goto('/notice'); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
});

test('closing a loaded top notice preserves its pending read before acknowledged reader history', async ({page}) => {
  let read = false, marks = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const readerSnapshots: boolean[] = [];
  await page.route('**/api/v1/system/notices?*', route => route.fulfill({json: list}));
  await page.route(`**/api/v1/system/notices/${id}`, route => route.fulfill({json: row}));
  await page.route('**/api/v1/system/notices/feed', route => route.fulfill({json: {items: [{id, title: row.title, type: '2', read}], unreadCount: read ? 0 : 1}}));
  await page.route('**/api/v1/system/notices/read', async route => {
    marks++;
    await gate;
    read = true;
    await route.fulfill({status: 204});
  });
  await page.route(`**/api/v1/system/notices/${id}/readers?*`, route => {
    readerSnapshots.push(read);
    return route.fulfill({json: {items: read ? [{userId: '2', username: 'reader', displayName: '读者'}] : [], total: read ? 1 : 0, page: 1, pageSize: 10}});
  });
  await login(page, ['system:notice:list']);
  await page.getByRole('button', {name: '通知公告（1 条未读）', exact: true}).click();
  const requested = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/system/notices/read' && request.method() === 'POST' && request.postDataJSON()?.ids?.includes(id));
  const acknowledged = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/system/notices/read' && response.request().method() === 'POST' && response.request().postDataJSON()?.ids?.includes(id)).catch(error => ({error}));
  await page.getByRole('region', {name: '顶部公告列表'}).getByRole('button', {name: `阅读 ${row.title}（未读）`, exact: true}).click();
  const request = await requested;
  try {
    await expect(page.getByRole('dialog').getByRole('heading', {name: '安全内容'})).toBeVisible();
    expect(request.postDataJSON()).toEqual({ids: [id]});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Loading the content and closing its dialog do not acknowledge the write.
    await expect(page.getByRole('button', {name: '通知公告（1 条未读）', exact: true})).toBeVisible();
    expect(read).toBe(false);
    expect(request.failure()).toBeNull();
    expect(marks).toBe(1);
    expect(readerSnapshots).toEqual([]);
  } finally {release();}
  const response = await acknowledged;
  if ('error' in response) throw response.error;
  expect(response.status()).toBe(204);
  expect(request.failure()).toBeNull();
  await expect(page.getByRole('button', {name: '通知公告（0 条未读）', exact: true})).toBeVisible();
  await page.getByRole('button', {name: `已读用户 ${row.title}`, exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('cell', {name: 'reader', exact: true})).toBeVisible();
  expect(readerSnapshots.length).toBeGreaterThan(0);
  expect(readerSnapshots.every(persisted => persisted)).toBe(true);
  expect(marks).toBe(1);
});
