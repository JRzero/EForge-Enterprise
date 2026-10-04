import {test, expect} from '@playwright/test';

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
