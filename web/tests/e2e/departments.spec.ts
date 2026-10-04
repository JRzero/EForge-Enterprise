import {test, expect} from './fixtures';
test('scoped department root, read-only permissions and retry behavior', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '2', username: 'reader', displayName: '部门只读账号'}, roles: ['reader'], permissions: ['system:dept:list'],
    navigation: [{key: 'system-departments', type: 'ROUTE', routeId: 'system-departments', label: '部门管理', order: 0, children: []}]
  }}));
  let rejects = true;
  await page.route('**/api/v1/system/departments?*', route => route.fulfill(rejects ? {status: 503, json: {}} : {json: [
    {id: '105', parentId: '101', name: '范围内部门', sort: 0, status: '0'}
  ]}));
  await page.goto('/dept'); await page.getByLabel('账号', {exact: true}).fill('reader');
  await page.getByLabel('密码', {exact: true}).fill('password');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  rejects = false; await page.getByRole('button', {name: '重试列表', exact: true}).click();
  await expect(page.getByText('范围内部门', {exact: true})).toBeVisible();
  for (const action of ['新增部门', '保存部门排序', '修改部门 范围内部门', '新增子部门 范围内部门', '删除部门 范围内部门']) {
    await expect(page.getByRole('button', {name: action, exact: true})).toHaveCount(0);
  }
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
