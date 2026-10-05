import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
import type {CacheStatistics} from '../../generated/api';
const unsafe = '<img src=x onerror="window.cacheInjected=true">';
const stats: CacheStatistics = {info: {version: '7.4', mode: 'standalone', port: '6379', connectedClients: '5', uptimeDays: '3', usedMemory: '2G', usedMemoryBytes: '2147483648', userChildrenCpuSeconds: '0.12', maxMemory: '0B', aofEnabled: '0', rdbLastSaveStatus: 'ok', inputKbps: '1.23', outputKbps: '4.56'}, keyCount: '9007199254740993', commands: [{name: unsafe, calls: '9007199254740993'}, {name: 'set', calls: '9007199254740993'}]};
const names = [{name: 'login_tokens:', description: '用户信息'}, {name: 'sys_config:', description: '配置信息'}, {name: 'sys_dict:', description: '数据字典'}];
async function login(page: Page, path: string, granted = true) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: ['app:dashboard:view', ...(granted ? ['monitor:cache:list'] : [])], navigation: [{key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []}, {key: 'monitor', type: 'GROUP', label: '系统监控', order: 2, children: [{key: 'monitor-cache', type: 'ROUTE', routeId: 'monitor-cache', label: '缓存监控', order: 5, children: []}, {key: 'monitor-cache-entries', type: 'ROUTE', routeId: 'monitor-cache-entries', label: '缓存列表', order: 6, children: []}]}]}}));
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('cache statistics retain all fields, exact counters, rose/gauge graphics, safe keyboard tooltip and resizing', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let value = stats; await page.route('**/api/v1/monitor/cache', route => route.fulfill({json: value})); await login(page, '/cache');
  for (const text of ['7.4', '单机', '6379', '5', '3', '2G', '0.12', '0B', '否', 'ok', '9007199254740993', '1.23 kps / 4.56 kps']) await expect(page.locator('dd').filter({hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)})).toBeVisible();
  for (const label of ['Redis 命令统计玫瑰图', 'Redis 内存消耗仪表图']) {await expect(page.getByRole('img', {name: label}).locator('svg')).toBeVisible(); expect(await page.getByRole('img', {name: label}).locator('svg path').count()).toBeGreaterThan(0);}
  await page.getByRole('button', {name: `${unsafe}：9007199254740993 次（50.00%）`, exact: true}).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.cache-chart-tooltip')).toContainText(`${unsafe}：9007199254740993 次（50.00%）`); expect(await page.locator('.cache-statistics-page img').count()).toBe(0);
  await page.setViewportSize({width: 390, height: 844}); await expect.poll(async () => page.getByRole('img', {name: 'Redis 命令统计玫瑰图'}).evaluate(element => element.querySelector('svg')!.getBoundingClientRect().width <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({tag: element.tagName, class: element.getAttribute('class'), right: element.getBoundingClientRect().right})).slice(0, 15))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  value = {...stats, keyCount: '0', commands: [], info: {...stats.info, usedMemory: '0B', usedMemoryBytes: '0'}}; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('暂无命令统计', {exact: true})).toBeVisible(); await expect(page.locator('dd').filter({hasText: /^0$/})).toBeVisible();
  await page.getByRole('link', {name: '工作台', exact: true}).click(); await page.getByRole('link', {name: '缓存监控', exact: true}).click(); await expect(page.locator('.cache-chart svg')).toHaveCount(2); expect(errors).toEqual([]);
});
test('stats loading ends on fault, keyboard retry succeeds, backend denial clears diagnostic fields', async ({page}) => {
  let failure = 503; await page.route('**/api/v1/monitor/cache', async route => {await new Promise(resolve => setTimeout(resolve, 300)); await route.fulfill(failure ? {status: failure, json: {code: failure === 503 ? 'CACHE_UNAVAILABLE' : 'ACCESS_DENIED'}} : {json: stats});});
  await login(page, '/cache'); await expect(page.getByText('正在加载缓存监控数据，请稍候！', {exact: true})).toBeVisible(); await expect(page.getByRole('button', {name: '刷新', exact: true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('缓存服务暂时不可用'); failure = 0; await page.getByRole('button', {name: '重试', exact: true}).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('heading', {name: '基本信息', exact: true})).toBeVisible();
  failure = 403; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.locator('dd')).toHaveCount(0);
});
test('leaving statistics aborts its pending request', async ({page}) => {
  let pending = false, aborted = false; page.on('requestfailed', request => {if (request.url().endsWith('/monitor/cache')) aborted = true;});
  await page.route('**/api/v1/monitor/cache', async route => {if (pending) await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({json: stats}).catch(() => {});});
  await login(page, '/cache'); await expect(page.getByRole('heading', {name: '基本信息', exact: true})).toBeVisible(); pending = true; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('正在加载缓存监控数据，请稍候！', {exact: true})).toBeVisible();
  await page.getByRole('link', {name: '工作台', exact: true}).click(); await expect.poll(() => aborted).toBe(true);
});
test('names, keys and values each retry independently, selection remains literal and text inert', async ({page}) => {
  let namesFail = true, keysFail = true, valueFail = true; const key = `sys_config:中文/a & ${unsafe}`, queries: URLSearchParams[] = [];
  await page.route('**/api/v1/monitor/cache/**', route => {const url = new URL(route.request().url()); queries.push(url.searchParams);
    if (url.pathname.endsWith('/names')) return route.fulfill(namesFail ? {status: 503, json: {code: 'CACHE_UNAVAILABLE'}} : {json: names});
    if (url.pathname.endsWith('/keys')) return route.fulfill(keysFail ? {status: 503, json: {code: 'CACHE_UNAVAILABLE'}} : {json: [key]});
    return route.fulfill(valueFail ? {status: 404, json: {code: 'CACHE_KEY_NOT_FOUND'}} : {json: {name: 'sys_config:', key, value: unsafe}});
  });
  await login(page, '/cacheList'); await expect(page.getByRole('alert')).toContainText('缓存服务暂时不可用'); namesFail = false; await page.getByRole('button', {name: '重试名称', exact: true}).click();
  await page.getByRole('button', {name: '查看缓存 sys_config:', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('缓存服务暂时不可用'); keysFail = false; await page.getByRole('button', {name: '重试键名', exact: true}).click();
  await page.getByRole('button', {name: `查看键 ${key}`, exact: true}).click(); await expect(page.getByRole('alert')).toContainText('缓存键已过期'); valueFail = false; await page.getByRole('button', {name: '重试内容', exact: true}).click();
  await expect(page.getByLabel('缓存值', {exact: true})).toHaveText(unsafe); expect(queries.at(-1)?.get('name')).toBe('sys_config:'); expect(queries.at(-1)?.get('key')).toBe(key);
  expect(await page.locator('.cache-entries-page img').count()).toBe(0); await expect(page.getByLabel('缓存键名', {exact: true})).toHaveValue(key.slice('sys_config:'.length));
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', {name: '刷新内容', exact: true}).click(); await expect(page.getByLabel('缓存值', {exact: true})).toHaveText(unsafe);
});
test('scoped confirmation cancels, survives failure, blocks busy escape and clears only the selected key/name', async ({page}) => {
  let failed = true, writes = 0; const keys = new Map([['sys_config:', ['sys_config:first', 'sys_config:last']], ['sys_dict:', ['sys_dict:keep']]]);
  await page.route('**/api/v1/monitor/cache/**', async route => {const url = new URL(route.request().url());
    if (route.request().method() === 'DELETE') {writes++; if (failed) return route.fulfill({status: 503, json: {code: 'CACHE_UNAVAILABLE'}}); await new Promise(resolve => setTimeout(resolve, 500));
      if (url.pathname.endsWith('/keys')) {const body = route.request().postDataJSON() as {name: string; key: string}; keys.set(body.name, keys.get(body.name)!.filter(key => key !== body.key));} else keys.set(decodeURIComponent(url.pathname.split('/').at(-1)!), []);
      return route.fulfill({status: 204});}
    if (url.pathname.endsWith('/names')) return route.fulfill({json: names}); if (url.pathname.endsWith('/keys')) return route.fulfill({json: keys.get(url.searchParams.get('name')!) ?? []});
    return route.fulfill({json: {name: 'sys_config:', key: 'sys_config:last', value: 'last-value'}});
  });
  await login(page, '/cacheList'); await page.getByRole('button', {name: '查看缓存 sys_config:', exact: true}).click();
  await page.getByRole('button', {name: '清理键 sys_config:last', exact: true}).click(); await page.keyboard.press('Escape'); expect(writes).toBe(0);
  await page.getByRole('button', {name: '查看键 sys_config:last', exact: true}).click(); await expect(page.getByLabel('缓存值', {exact: true})).toHaveText('last-value');
  await page.getByRole('button', {name: '清理键 sys_config:last', exact: true}).click(); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('缓存服务暂时不可用');
  failed = false; await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('button', {name: '取消', exact: true})).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(page.getByRole('button', {name: '查看键 sys_config:last', exact: true})).toHaveCount(0); await expect(page.getByRole('button', {name: '查看键 sys_config:first', exact: true})).toBeVisible(); await expect(page.getByLabel('缓存值', {exact: true})).toHaveCount(0); expect(keys.get('sys_dict:')).toEqual(['sys_dict:keep']);
  await page.getByRole('button', {name: '清理类别 sys_config:', exact: true}).click(); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByText('暂无缓存键', {exact: true})).toBeVisible(); expect(keys.get('sys_dict:')).toEqual(['sys_dict:keep']);
});
test('switching namespaces aborts stale value results, leaving aborts current key fetch', async ({page}) => {
  let pendingKeys = false, valueStarted = false, valueAborted = false, keysAborted = false;
  page.on('requestfailed', request => {if (request.url().includes('/cache/value?')) valueAborted = true; if (request.url().includes('/cache/keys?')) keysAborted = true;});
  await page.route('**/api/v1/monitor/cache/**', async route => {const url = new URL(route.request().url()); if (url.pathname.endsWith('/names')) return route.fulfill({json: names});
    const name = url.searchParams.get('name')!; if (url.pathname.endsWith('/keys')) {if (pendingKeys) await new Promise(resolve => setTimeout(resolve, 700)); return route.fulfill({json: [`${name}one`]}).catch(() => {});}
    if (name === 'sys_config:') {valueStarted = true; await new Promise(resolve => setTimeout(resolve, 700));} return route.fulfill({json: {name, key: `${name}one`, value: name}}).catch(() => {});
  });
  await login(page, '/cacheList'); await page.getByRole('button', {name: '查看缓存 sys_config:', exact: true}).click(); await page.getByRole('button', {name: '查看键 sys_config:one', exact: true}).click(); await expect.poll(() => valueStarted).toBe(true);
  await page.getByRole('button', {name: '查看缓存 sys_dict:', exact: true}).click(); await page.getByRole('button', {name: '查看键 sys_dict:one', exact: true}).click(); await expect(page.getByLabel('缓存值', {exact: true})).toHaveText('sys_dict:'); await expect.poll(() => valueAborted).toBe(true);
  pendingKeys = true; await page.getByRole('button', {name: '刷新键名', exact: true}).click(); await expect(page.getByRole('button', {name: '刷新键名', exact: true})).toBeDisabled(); await page.getByRole('link', {name: '工作台', exact: true}).click(); await expect.poll(() => keysAborted).toBe(true);
});
for (const mode of ['key', 'name', 'all'] as const) test(`${mode} session clearing revalidates actual 401 and returns to login`, async ({page}) => {
  let expired = false;
  await page.route('**/api/v1/monitor/cache**', route => {if (route.request().method() === 'DELETE') {expired = true; return route.fulfill({status: 204});}
    if (expired) return route.fulfill({status: 401, json: {code: 'AUTHENTICATION_REQUIRED'}});
    const path = new URL(route.request().url()).pathname; return route.fulfill({json: path.endsWith('/names') ? names : ['login_tokens:caller']});});
  await login(page, '/cacheList'); await page.getByRole('button', {name: '查看缓存 login_tokens:', exact: true}).click(); await expect(page.getByRole('button', {name: '查看键 login_tokens:caller', exact: true})).toBeVisible();
  await page.getByRole('button', {name: mode === 'key' ? '清理键 login_tokens:caller' : mode === 'name' ? '清理类别 login_tokens:' : '清理全部', exact: true}).click(); await expect(page.getByRole('alertdialog')).toContainText('会话');
  await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
});
test('both cache routes reject absent original grant before any data requests', async ({page}) => {
  let calls = 0; await page.route('**/api/v1/monitor/cache**', route => {calls++; return route.fulfill({json: []});}); await login(page, '/cache', false); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
  await page.goto('/cacheList'); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); expect(calls).toBe(0);
});
