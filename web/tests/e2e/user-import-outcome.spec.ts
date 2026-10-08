import {test, expect} from './fixtures';

test('an import session-refresh failure keeps its file and explains committed data without automatic resubmission', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '2', username: 'importer', displayName: '导入管理员'}, roles: [], permissions: ['system:user:list', 'system:user:import'],
    navigation: [{key: 'system-users', type: 'ROUTE', routeId: 'system-users', label: '用户管理', order: 0, children: []}],
  }}));
  await page.route('**/api/v1/system/users/departments', route => route.fulfill({json: []}));
  await page.route('**/api/v1/system/users?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
  let requests = 0;
  await page.route('**/api/v1/system/users/import?*', route => {
    requests++;
    return route.fulfill({status: 503, json: {code: 'USER_IMPORT_SESSION_REFRESH_FAILED'}});
  });
  await page.goto('/user');
  await page.getByLabel('账号', {exact: true}).fill('importer');
  await page.getByLabel('密码', {exact: true}).fill('password');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await page.getByRole('button', {name: '导入用户', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('导入文件', {exact: true}).setInputFiles({name: '用户.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('fixture')});
  await dialog.getByRole('checkbox', {name: '更新已存在的用户', exact: true}).check();
  await dialog.getByRole('button', {name: '开始导入', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('成功的记录已保存');
  await expect(dialog.getByRole('alert')).toContainText('在线会话更新失败');
  await expect(dialog.getByRole('alert')).toContainText('先核对用户数据和在线会话状态');
  await expect(dialog.getByRole('button', {name: '开始导入', exact: true})).toBeEnabled();
  await expect(dialog.getByText('用户.xlsx', {exact: true})).toBeVisible();
  await expect(dialog.getByRole('checkbox', {name: '更新已存在的用户', exact: true})).toBeChecked();
  await expect(dialog.getByRole('region', {name: '导入结果', exact: true})).toHaveCount(0);
  await dialog.getByRole('button', {name: '关闭', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', {name: '用户管理', exact: true})).toBeVisible();
  expect(requests).toBe(1);
});
