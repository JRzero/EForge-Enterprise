import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
async function login(page: Page, permission = true) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: permission ? ['monitor:druid:list', 'tool:swagger:list'] : [], navigation: []}}));
  await page.goto('/druid'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('disabled consoles, original permission guards and refresh without opening a resource', async ({page}) => {
  let opens = 0;
  await page.route('**/api/v1/monitor/consoles/**', route => {if (route.request().method() === 'POST') opens++; return route.fulfill({json: {enabled: false}});});
  await login(page); await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible();
  await page.goto('/swagger'); await expect(page.getByRole('heading', {name: '接口文档', exact: true})).toBeVisible(); await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible(); expect(opens).toBe(0);
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: [], navigation: []}}));
  await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); expect(opens).toBe(0);
});
test('real iframe loading, fixed entries, mobile layout, expiry and renewal without logging out', async ({page}) => {
  let expiry = 300;
  await page.route('**/api/v1/monitor/consoles/druid', route => route.fulfill({json: {enabled: true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session', route => route.fulfill({json: {entryPath: '/druid/login.html', expiresInSeconds: expiry}}));
  await page.route('**/druid/login.html', route => {expect(route.request().headers().authorization).toBeUndefined(); return route.fulfill({contentType: 'text/html', body: '<html><body><h1>连接池状态</h1><button>SQL 查询</button></body></html>'});});
  await login(page); await expect(page.frameLocator('iframe').getByRole('heading', {name: '连接池状态'})).toBeVisible(); await expect(page.getByText('正在加载控制台，请稍候！')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveAttribute('src', '/druid/login.html'); await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expiry = 1; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('控制台凭据已到期，请刷新后继续。')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
  expiry = 300; await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.frameLocator('iframe').getByRole('button', {name: 'SQL 查询'})).toBeVisible(); await expect(page.getByRole('heading', {name: '登录工作空间'})).toHaveCount(0);
});
test('status/open/resource faults, hostile entry rejection and fresh grant checks', async ({page}) => {
  let status = 503, opening = 200, entry = '/druid/login.html', resource = 200;
  await page.route('**/api/v1/monitor/consoles/druid', route => route.fulfill({status, json: status === 200 ? {enabled: true} : {code: status === 403 ? 'ACCESS_DENIED' : 'CONSOLE_UNAVAILABLE'}}));
  await page.route('**/api/v1/monitor/consoles/druid/session', route => route.fulfill({status: opening, json: opening === 200 ? {entryPath: entry, expiresInSeconds: 300} : {code: 'CONSOLE_UNAVAILABLE'}}));
  await page.route('**/druid/login.html', route => route.fulfill({status: resource, contentType: resource === 200 ? 'text/html' : 'application/problem+json', body: resource === 200 ? '<html><body>监控资源</body></html>' : '{"status":401}'}));
  await login(page); await expect(page.getByRole('alert')).toContainText('控制台暂时不可用');
  status = 200; opening = 503; await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('控制台暂时不可用');
  opening = 200; entry = 'https://example.org/?token=unsafe'; await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('控制台暂时无法加载'); await expect(page.locator('iframe')).toHaveCount(0);
  entry = '/druid/login.html'; resource = 401; const rejected = page.waitForResponse(response => response.url().endsWith('/druid/login.html') && response.status() === 401); await page.getByRole('button', {name: '重试', exact: true}).click(); await rejected; await expect(page.getByRole('alert')).toContainText('控制台暂时无法加载');
  resource = 200; await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.frameLocator('iframe').getByText('监控资源')).toBeVisible();
  status = 403; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
});
test('navigation aborts pending reads and expired application sessions return to login', async ({page}) => {
  let delay = false, status = 200;
  await page.route('**/api/v1/monitor/consoles/api-docs', route => route.fulfill({json: {enabled: false}}));
  await page.route('**/api/v1/monitor/consoles/druid', async route => {if (delay) await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({status, json: status === 200 ? {enabled: false} : {code: 'AUTHENTICATION_REQUIRED'}}).catch(() => {});});
  await login(page); await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible();
  delay = true; await page.getByRole('button', {name: '刷新', exact: true}).click(); await page.goto('/swagger'); await expect(page.getByRole('heading', {name: '接口文档', exact: true})).toBeVisible();
  delay = false; status = 401; await page.goto('/druid'); await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
});
test('an iframe authentication problem after a successful probe is hidden and can be retried', async ({page}) => {
  let denied = true;
  await page.route('**/api/v1/monitor/consoles/druid', route => route.fulfill({json: {enabled: true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session', route => route.fulfill({json: {entryPath: '/druid/login.html', expiresInSeconds: 300}}));
  await page.route('**/druid/login.html', route => {
    const problem = denied && route.request().resourceType() === 'document';
    return route.fulfill({status: problem ? 401 : 200, contentType: problem ? 'application/problem+json' : 'text/html', body: problem ? '{"status":401,"code":"AUTHENTICATION_REQUIRED"}' : '<html><body>已认证的控制台</body></html>'});
  });
  await login(page); await expect(page.getByRole('alert')).toContainText('控制台暂时无法加载'); await expect(page.locator('iframe')).toHaveCount(0);
  denied = false; await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.frameLocator('iframe').getByText('已认证的控制台')).toBeVisible();
});
