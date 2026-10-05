import {test, expect, type Page} from '@playwright/test';
const enabled = process.env.EFORGE_DRUID_CONSOLE_ENABLED === 'true';
async function login(page: Page, path: string) {
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
}
async function token(page: Page) {return page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);}
for (const [path, title, entry, cookie] of [['/druid', '数据监控', '/druid/login.html', 'eforge_console_druid'], ['/swagger', '接口文档', '/swagger-ui/index.html', 'eforge_console_docs']] as const) {
  test(`${title}: actual disabled/enabled iframe, original interactions, refresh and logout`, async ({page, context}) => {
    test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', cause => errors.push(cause.message));
    const diagnosticResources: {path: string; status: number}[] = [];
    page.on('response', response => {const path = new URL(response.url()).pathname; if (path.startsWith('/druid/') && diagnosticResources.length < 100) diagnosticResources.push({path, status: response.status()});});
    try {
    await login(page, path); await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
    const accessToken = await token(page);
    if (!enabled) {
      await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
      await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible();
      expect((await context.cookies()).some(value => value.name === cookie)).toBe(false);
    } else {
      await expect(page.locator('iframe')).toHaveAttribute('src', entry); const frame = page.frameLocator('iframe');
      if (path === '/druid') {
        await expect(frame.getByRole('heading', {name: 'Login', exact: true})).toBeVisible();
        await expect.poll(() => frame.locator('html').evaluate(element => element.ownerDocument.readyState)).toBe('complete');
        await frame.getByPlaceholder('用户名').fill(process.env.EFORGE_DRUID_USERNAME!); await frame.getByPlaceholder('密码', {exact: true}).fill(process.env.EFORGE_DRUID_PASSWORD!);
        const [basicResponse] = await Promise.all([
          page.waitForResponse(response => response.url().endsWith('/druid/basic.json') && response.request().method() === 'POST' && response.status() === 200),
          frame.getByRole('button', {name: 'Sign in', exact: true}).click(),
        ]);
        const actual = await basicResponse.json(); expect(actual.ResultCode).toBe(1); expect(actual.Content.JavaVersion).toBeTruthy();
        await expect(frame.locator('#DruidVersion')).toContainText('1.2.28');
        expect((await context.cookies()).filter(value => value.name === 'JSESSIONID').map(value => ({name: value.name, path: value.path}))).toEqual([{name: 'JSESSIONID', path: '/'}]);
        const sessionCookie = (await context.cookies()).find(value => value.name === 'JSESSIONID')!;
        const jsonRequest = context.waitForEvent('request', request => request.url().endsWith('/druid/basic.json') && request.method() === 'GET');
        const openedJson = page.waitForEvent('popup'); await frame.locator('a[href="basic.json"]').click(); const jsonPage = await openedJson;
        const sentCookie = (await (await jsonRequest).allHeaders()).cookie ?? '';
        expect({sessionPresent: sentCookie.includes('JSESSIONID='), sameSession: sentCookie.split(';').some(value => value.trim() === `JSESSIONID=${sessionCookie.value}`), cookieSameSite: sessionCookie.sameSite}).toEqual({sessionPresent: true, sameSession: true, cookieSameSite: 'Lax'});
        await jsonPage.waitForLoadState('domcontentloaded'); await expect(jsonPage).toHaveURL(/\/druid\/basic\.json$/);
        const viewed = await jsonPage.evaluate(async () => {const response = await fetch(location.href, {cache: 'no-store'}); return {status: response.status, body: await response.json()};});
        expect(viewed.status).toBe(200); expect(viewed.body.ResultCode).toBe(1); await jsonPage.close();
        const sqlResponse = page.waitForResponse(response => response.url().includes('/druid/sql.json') && response.status() === 200);
        await frame.locator('a[href="sql.html"]').first().click(); await expect(frame.locator('#dataTable')).toBeVisible();
        const sql = await (await sqlResponse).json(); expect(sql.ResultCode).toBe(1); expect(Array.isArray(sql.Content)).toBe(true);
        expect((await context.cookies()).find(value => value.name === 'JSESSIONID')?.value === sessionCookie.value).toBe(true);
      } else {
        await expect(frame.locator('.swagger-ui').first()).toBeVisible(); await expect(frame.locator('.opblock').first()).toBeVisible();
        const schema = await page.evaluate(async () => (await fetch('/v3/api-docs/api-v1')).json()); expect(schema.paths['/api/v1/monitor/consoles/druid']).toBeDefined();
        await frame.locator('.auth-wrapper .authorize').click(); const dialog = frame.locator('.dialog-ux'); await dialog.locator('input').fill(`Bearer ${accessToken}`);
        await dialog.getByRole('button', {name: 'Apply credentials', exact: true}).click(); await dialog.getByRole('button', {name: 'Close', exact: true}).click();
        const operation = frame.locator('.opblock').filter({has: frame.locator('.opblock-summary-path[data-path="/api/v1/monitor/consoles/druid"]')}).first();
        await operation.locator('.opblock-summary').click(); await operation.getByRole('button', {name: 'Try it out', exact: true}).click();
        const executed = page.waitForResponse(response => response.url().endsWith('/api/v1/monitor/consoles/druid') && response.request().headers().authorization === `Bearer ${accessToken}` && response.status() === 200);
        await operation.getByRole('button', {name: 'Execute', exact: true}).click(); await executed; await expect(operation.locator('.live-responses-table')).toContainText('200');
      }
      const scoped = (await context.cookies()).find(value => value.name === cookie)!; expect(scoped.httpOnly).toBe(true); expect(scoped.sameSite).toBe('Strict'); expect(scoped.value === accessToken).toBe(false);
      expect(page.url().includes(accessToken)).toBe(false); expect((await page.locator('iframe').getAttribute('src'))?.includes(accessToken)).toBe(false);
      await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.locator('iframe')).toHaveAttribute('src', entry); await expect(page.getByText('正在加载控制台，请稍候！')).toHaveCount(0);
      await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('button', {name: '退出登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
    if (enabled) expect(await page.evaluate(async entry => (await fetch(entry)).status, entry)).toBe(401);
    expect(errors).toEqual([]);
    } catch (cause) {
      console.log('Console failure resource statuses:', JSON.stringify(diagnosticResources), 'script error count:', errors.length);
      throw cause;
    } finally {
      // Error context captures the DOM even with traces off. Never snapshot Swagger's bearer input/curl.
      await page.locator('iframe').evaluateAll(frames => frames.forEach(frame => frame.remove())).catch(() => {});
    }
  });
}
test('no-role UI denial, actual grant allocation, live revocation and scoped-cookie API isolation', async ({page}) => {
  test.setTimeout(60000); await login(page, '/druid'); await expect(page.getByRole('heading', {name: '数据监控', exact: true})).toBeVisible();
  const admin = {Authorization: `Bearer ${await token(page)}`}, suffix = Date.now().toString(), username = `cl${suffix}`;
  const createdRole = await page.request.post('/api/v1/system/roles', {headers: admin, data: {name: `Console ${suffix}`, key: `console-${suffix}`, sort: 9, status: '0', remark: '', menuLinked: false, menuKeys: ['monitor-druid', 'tool-openapi']}}); expect(createdRole.status()).toBe(201); const role = await createdRole.json();
  let account: {id: string} | undefined;
  try {
    const created = await page.request.post('/api/v1/system/users', {headers: admin, data: {user: {username, displayName: '控制台验证', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}}); expect(created.status()).toBe(201); account = await created.json();
    const signed = await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}}); expect(signed.status()).toBe(200); const ownToken = (await signed.json()).accessToken;
    await page.evaluate(accessToken => sessionStorage.setItem('eforge.enterprise.session.v1', JSON.stringify({accessToken, tokenType: 'Bearer'})), ownToken); await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
    for (const kind of ['druid', 'api-docs']) expect((await page.request.get(`/api/v1/monitor/consoles/${kind}`, {headers: {Authorization: `Bearer ${ownToken}`}})).status()).toBe(403);
    expect((await page.request.put(`/api/v1/system/users/${account!.id}/roles`, {headers: admin, data: {roleIds: [role.id]}})).status()).toBe(204);
    await page.reload(); await expect(page.getByRole('heading', {name: '数据监控', exact: true})).toBeVisible();
    if (enabled) {
      await expect(page.locator('iframe')).toBeVisible(); await expect(page.getByText('正在加载控制台，请稍候！')).toHaveCount(0);
      expect(await page.evaluate(async () => (await fetch('/api/v1/app/bootstrap')).status)).toBe(401);
      expect((await page.request.put(`/api/v1/system/users/${account!.id}/roles`, {headers: admin, data: {roleIds: []}})).status()).toBe(204);
      expect(await page.evaluate(async () => (await fetch('/druid/login.html')).status)).toBe(403);
      await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
      expect((await page.request.put(`/api/v1/system/users/${account!.id}/roles`, {headers: admin, data: {roleIds: [role.id]}})).status()).toBe(204);
      await page.getByRole('button', {name: '重试', exact: true}).click(); await expect(page.frameLocator('iframe').getByRole('heading', {name: 'Login', exact: true})).toBeVisible();
    } else await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible();
  } finally {
    if (account) expect((await page.request.delete('/api/v1/system/users', {headers: admin, data: {ids: [account.id]}})).status()).toBe(204);
    expect((await page.request.delete('/api/v1/system/roles', {headers: admin, data: {ids: [role.id]}})).status()).toBe(204);
  }
});
