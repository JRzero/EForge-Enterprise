import {test, expect} from './fixtures';

test('post page numbers and bounded jump drive typed paging and retain filters on mobile', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '分页账号'}, roles: [], permissions: ['system:post:list'], navigation: [{key: 'posts', type: 'ROUTE', routeId: 'system-posts', label: '岗位管理', order: 0, children: []}]}}));
  const queries: URLSearchParams[] = [];
  await page.route('**/api/v1/system/posts?*', route => {
    const query = new URL(route.request().url()).searchParams; queries.push(query);
    const current = Number(query.get('page')), pageSize = Number(query.get('pageSize'));
    return route.fulfill({json: {items: [{id: String(current), code: 'page'+current, name: '岗位页'+current, sort: 0, status: '0'}], total: 101, page: current, pageSize}});
  });
  await page.goto('/post'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('cell', {name: '岗位页1', exact: true})).toBeVisible();
  const navigation = page.getByRole('navigation', {name: '分页导航', exact: true});
  await expect(navigation.getByRole('button', {name: /^第 \d+ 页$/})).toHaveCount(7);
  await page.getByLabel('岗位编码筛选', {exact: true}).fill('read'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect.poll(() => queries.at(-1)?.get('code')).toBe('read');
  await page.getByRole('button', {name: '第 3 页', exact: true}).click(); await expect(page.getByRole('cell', {name: '岗位页3', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '第 3 页', exact: true})).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('跳至页码', {exact: true}).fill('10'); await page.getByRole('button', {name: '跳转', exact: true}).click(); await expect(page.getByRole('cell', {name: '岗位页10', exact: true})).toBeVisible();
  const count = queries.length; await page.getByLabel('跳至页码', {exact: true}).fill('0'); await page.getByRole('button', {name: '跳转', exact: true}).click(); expect(queries.length).toBe(count);
  await page.setViewportSize({width: 390, height: 600});
  await expect(navigation.getByRole('button', {name: /^第 \d+ 页$/})).toHaveCount(5);
  await page.locator('[data-page-path="/post"]').evaluate(element => {element.style.paddingTop = '900px';});
  await page.getByRole('button', {name: '第 11 页', exact: true}).click(); await expect(page.getByRole('cell', {name: '岗位页11', exact: true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.locator('[data-page-path="/post"]').evaluate(element => {element.style.paddingTop = '';});
  await page.getByLabel('每页条数', {exact: true}).selectOption('30'); await expect.poll(() => queries.at(-1)?.get('pageSize')).toBe('30'); await expect(page.getByRole('cell', {name: '岗位页1', exact: true})).toBeVisible();
  await page.setViewportSize({width: 390, height: 844}); await page.getByRole('button', {name: '第 4 页', exact: true}).click(); await expect(page.getByRole('cell', {name: '岗位页4', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(queries.at(-1)?.get('code')).toBe('read'); await expect(page.getByLabel('岗位编码筛选', {exact: true})).toHaveValue('read');
});

test('posts list supports failure recovery and respects read-only permissions', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '2', username: 'reader', displayName: '只读账号'}, roles: ['reader'], permissions: ['system:post:list'],
    navigation: [{key: 'system-posts', type: 'ROUTE', routeId: 'system-posts', label: '岗位管理', order: 0, children: []}]
  }}));
  let calls = 0, rejects = true;
  await page.route('**/api/v1/system/posts?*', route => {
    calls++;
    return route.fulfill(rejects ? {status: 503, json: {}} : {json: {
      items: [{id: '9007199254740993', code: 'read', name: '只读岗位', sort: 0, status: '0'}], total: 1, page: 1, pageSize: 10
    }});
  });
  await page.goto('/post'); await page.getByLabel('账号', {exact: true}).fill('reader');
  await page.getByLabel('密码', {exact: true}).fill('password');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  rejects = false;
  await page.getByRole('button', {name: '重试列表', exact: true}).click();
  await expect(page.getByRole('cell', {name: '9007199254740993', exact: true})).toBeVisible();
  for (const action of ['新增岗位', '删除所选岗位', '导出岗位', '修改 只读岗位', '删除 只读岗位']) {
    await expect(page.getByRole('button', {name: action, exact: true})).toHaveCount(0);
  }
  expect(calls).toBeGreaterThanOrEqual(2);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('shared dictionary labels recover independently and drive list, filter and editor options', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '编辑'}, roles: [], permissions: ['system:post:list', 'system:post:add'], navigation: [{key: 'system-posts', type: 'ROUTE', routeId: 'system-posts', label: '岗位管理', order: 0, children: []}]}}));
  await page.route('**/api/v1/system/posts?*', route => route.fulfill({json: {items: [{id: '7', name: '岗位', code: 'example', sort: 0, status: '0'}], total: 1, page: 1, pageSize: 10}}));
  let failed = true;
  await page.route('**/api/v1/system/dictionaries/lookup/sys_normal_disable', route => route.fulfill(failed ? {status: 503, json: {code: 'DICTIONARY_CACHE_UNAVAILABLE'}} : {json: [{value: '0', label: '自定义启用', style: 'WARNING', cssClass: 'custom-label', defaultEntry: true}, {value: '1', label: '自定义停用', style: 'INFO', defaultEntry: false}]}));
  await page.goto('/post'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('cell', {name: 'example', exact: true})).toBeVisible(); await expect(page.getByRole('alert')).toContainText('字典标签加载失败');
  failed = false; await page.getByRole('button', {name: '重试字典标签'}).click(); await expect(page.getByRole('cell', {name: '自定义启用', exact: true})).toBeVisible(); await expect(page.locator('.tag-warning.custom-label')).toHaveText('自定义启用');
  await expect(page.getByLabel('状态筛选').getByRole('option', {name: '自定义停用', exact: true})).toHaveAttribute('value', '1');
  await page.getByRole('button', {name: '新增岗位'}).click(); await expect(page.getByRole('dialog').getByLabel('岗位状态').getByRole('option', {name: '自定义启用', exact: true})).toHaveAttribute('value', '0'); await page.keyboard.press('Escape');
  await page.route('**/api/v1/system/dictionaries/lookup/sys_normal_disable', route => route.fulfill({json: [{value: '1', label: '仅剩停用', style: 'INFO', defaultEntry: false}]}));
  await page.reload(); await expect(page.locator('.dictionary-tags')).toHaveText('0'); await page.getByRole('button', {name: '新增岗位'}).click();
  const status = page.getByRole('dialog').getByLabel('岗位状态'); await expect(status).toHaveValue('0'); await expect(status.getByRole('option', {name: '0', exact: true})).toHaveAttribute('value', '0'); await page.keyboard.press('Escape');
});
