import {test, expect, type Page} from '@playwright/test';
const bootstrap = {user: {id: '1', username: 'admin', displayName: '管理员'}, roles: ['admin'], permissions: ['app:dashboard:view'],
  navigation: [{key: 'workspace', type: 'GROUP', label: '我的空间', order: 0, children: [
    {key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []},
    {key: 'unknown', type: 'ROUTE', routeId: 'unimplemented', label: '未知页面', order: 1, children: []}]}]};
async function setup(page: Page, state = {permissions: bootstrap.permissions, expires: false, captcha: false, reject: false, bootCalls: 0, logoutFails: false}) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: state.captcha, uuid: 'test-challenge', img: 'dGVzdA=='}}));
  await page.route('**/api/v1/auth/login', route => {
    const request = route.request().postDataJSON();
    if (state.captcha) { expect(request.code).toBe('42'); expect(request.uuid).toBe('test-challenge'); }
    else { expect(request.code).toBeUndefined(); expect(request.uuid).toBeUndefined(); }
    return route.fulfill(state.reject
      ? {status: 401, contentType: 'application/problem+json', json: {code: 'AUTHENTICATION_FAILED'}}
      : {json: {accessToken: 'fixture-token', tokenType: 'Bearer'}});
  });
  await page.route('**/api/v1/app/bootstrap', route => { state.bootCalls++;
    return route.fulfill(state.expires ? {status: 401, json: {code: 'AUTHENTICATION_REQUIRED'}}
      : {json: {...bootstrap, permissions: state.permissions}}); });
  await page.route('**/logout', route => route.fulfill(state.logoutFails ? {status: 503, json: {}} : {json: {code: 200}}));
  return state;
}
async function signIn(page: Page) {
  await page.goto('/dashboard'); await page.getByLabel('账号', {exact: true}).fill('admin');
  await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('login, grouped navigation, refresh, 404 and confirmed logout', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const state = await setup(page); await signIn(page);
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  await expect(page.getByText('我的空间', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: '未知页面'})).toHaveCount(0);
  await expect(page.getByRole('link', {name: '我的空间'})).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  expect(state.bootCalls).toBe(2);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!))).toEqual({accessToken: 'fixture-token'});
  await page.goto('/missing'); await expect(page.getByRole('heading', {name: '页面不存在'})).toBeVisible();
  await page.getByRole('button', {name: '返回工作台'}).click();
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  await page.getByRole('button', {name: '退出登录'}).click();
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
  expect(errors).toEqual([]);
});
test('revoked permissions show 403, while expiry removes the session', async ({page}) => {
  const state = await setup(page); await signIn(page);
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  state.permissions = []; await page.reload();
  await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
  await expect(page.getByRole('link', {name: '工作台', exact: true})).toHaveCount(0);
  state.expires = true; await page.reload();
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
});
test('rejected login refreshes captcha and supports recovery', async ({page}) => {
  const state = await setup(page); state.captcha = true; state.reject = true;
  await page.goto('/'); await page.getByLabel('账号', {exact: true}).fill('admin');
  await page.getByLabel('密码', {exact: true}).fill('wrong'); await page.getByLabel('验证码', {exact: true}).fill('42');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('账号或密码不正确');
  await expect(page.getByLabel('密码', {exact: true})).toHaveValue('');
  await expect(page.getByLabel('验证码', {exact: true})).toHaveValue('');
  state.reject = false;
  await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByLabel('验证码', {exact: true}).fill('42');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
});
test('failed logout keeps the workspace and supports retry', async ({page}) => {
  const state = await setup(page); state.logoutFails = true; await signIn(page);
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  await page.getByRole('button', {name: '退出登录'}).click();
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  state.logoutFails = false; await page.getByRole('button', {name: '退出登录'}).click();
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
});
test('mobile login stays within the viewport and supports keyboard submission', async ({page}) => {
  await setup(page); await page.setViewportSize({width: 390, height: 844}); await page.goto('/');
  await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('password');
  await expect(page.getByRole('button', {name: '登录', exact: true})).toBeEnabled();
  await page.getByLabel('密码', {exact: true}).press('Enter');
  await expect(page.getByRole('heading', {name: '你好，管理员'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
