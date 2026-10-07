import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
import type {ServerMonitorResponse} from '../../generated/api';
const unsafe = '<img src=x onerror="window.monitorInjected=true">';
const sample: ServerMonitorResponse = {sampledAt: '2026-10-05T00:00:00Z', cpu: {coreCount: 8, userPercent: 30, systemPercent: 20, idlePercent: 40, waitPercent: 10}, memory: {totalGiB: 8, usedGiB: 6.48, freeGiB: 1.52, usagePercent: 81}, jvm: {name: 'OpenJDK', version: '17', totalMiB: 512, usedMiB: 414.72, freeMiB: 97.28, maxMiB: 1024, usagePercent: 81, home: '/java', startedAt: '2026-10-04 22:00:00', uptime: '2小时', arguments: unsafe}, host: {name: unsafe, ip: '::1', operatingSystem: 'Linux', architecture: 'amd64', workingDirectory: '/workspace/' + 'long-path/'.repeat(40)}, disks: [{mount: '/', fileSystem: unsafe, type: 'local', totalSize: '100 GB', usedSize: '25 GB', freeSize: '75 GB', usagePercent: 25}]};
async function login(page: Page, permission = true) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '2', username: 'reader', displayName: '读者'}, roles: [], permissions: ['app:dashboard:view', ...(permission ? ['monitor:server:list'] : [])], navigation: [{key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []}, {key: 'monitor', type: 'GROUP', label: '系统监控', order: 2, children: permission ? [{key: 'monitor-server', type: 'ROUTE', routeId: 'monitor-server', label: '服务器监控', order: 4, children: []}] : []}]}}));
  await page.goto('/server'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
test('all server groups, binary units, unsafe text, strict warning threshold and mobile layout', async ({page}) => {
  let value = sample;
  await page.route('**/api/v1/monitor/server', route => route.fulfill({json: value})); await login(page);
  for (const name of ['CPU', '内存', '服务器信息', 'Java 虚拟机信息', '磁盘状态']) await expect(page.getByRole('heading', {name, exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: '物理内存 (GiB)', exact: true})).toBeVisible(); await expect(page.getByRole('columnheader', {name: 'JVM (MiB)', exact: true})).toBeVisible();
  await expect(page.getByRole('row', {name: '总内存 8 512', exact: true})).toBeVisible(); await expect(page.getByText('1024 MiB', {exact: true})).toBeVisible();
  await expect(page.getByRole('row', {name: '已用内存 6.48 414.72', exact: true})).toBeVisible(); await expect(page.getByRole('row', {name: '剩余内存 1.52 97.28', exact: true})).toBeVisible();
  for (const text of ['8', '30%', '20%', '40%', '10%', '17', '/java', '2026-10-04 22:00:00', '2小时', '::1', 'Linux', 'amd64']) await expect(page.locator('dd').filter({hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)})).toBeVisible();
  await expect(page.getByText('物理内存使用率超过 80%', {exact: false})).toBeVisible(); await expect(page.getByText('JVM 内存使用率超过 80%', {exact: false})).toBeVisible();
  expect(await page.locator('.server-monitor-page img').count()).toBe(0); await expect(page.getByRole('cell', {name: unsafe, exact: true})).toBeVisible();
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  value = {...sample, sampledAt: '2026-10-05T00:01:00Z', memory: {...sample.memory, usagePercent: 80}, jvm: {...sample.jvm, usagePercent: 80}, disks: []};
  await page.getByRole('button', {name: '刷新', exact: true}).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('time')).toHaveAttribute('datetime', value.sampledAt); await expect(page.locator('.server-high-usage')).toHaveCount(0); await expect(page.getByText('暂无磁盘信息', {exact: true})).toBeVisible();
  value = {...value, disks: [{...sample.disks[0]!, usagePercent: 81}]}; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByRole('cell', {name: '81%', exact: true}).locator('span')).toHaveClass('server-high-usage');
  value = {...value, disks: [{...sample.disks[0]!, usagePercent: 80}]}; await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByRole('cell', {name: '80%', exact: true}).locator('span')).not.toHaveClass('server-high-usage');
});
test('loading, generic failure, keyboard retry and denied backend request', async ({page}) => {
  let fail = true;
  let release!: () => void; const initialResponse = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/v1/monitor/server', async route => {await initialResponse; await route.fulfill(fail ? {status: 503, json: {code: 'SERVER_MONITOR_UNAVAILABLE'}} : {json: sample}).catch(() => {});});
  await login(page); await expect(page.getByText('正在加载服务监控数据，请稍候！', {exact: true})).toBeVisible(); await expect(page.getByRole('button', {name: '刷新', exact: true})).toBeDisabled();
  release(); await expect(page.getByRole('alert')).toContainText('服务器监控暂时无法'); await expect(page.getByRole('button', {name: '刷新', exact: true})).toBeEnabled();
  fail = false; await page.getByRole('button', {name: '重试', exact: true}).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('heading', {name: 'CPU', exact: true})).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.route('**/api/v1/monitor/server', route => route.fulfill({status: 403, json: {code: 'ACCESS_DENIED'}})); await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('heading', {name: 'CPU', exact: true})).toHaveCount(0);
});
test('missing route grant makes no sampling request', async ({page}) => {
  let calls = 0; await page.route('**/api/v1/monitor/server', route => {calls++; return route.fulfill({json: sample});}); await login(page, false); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); expect(calls).toBe(0);
});
test('leaving monitor aborts pending sampling', async ({page}) => {
  let pending = false, aborted = false;
  page.on('requestfailed', request => {if (request.url().endsWith('/monitor/server')) aborted = true;});
  await page.route('**/api/v1/monitor/server', async route => {if (pending) await new Promise(resolve => setTimeout(resolve, 800)); await route.fulfill({json: sample}).catch(() => {});});
  await login(page); await expect(page.getByRole('heading', {name: 'CPU', exact: true})).toBeVisible(); pending = true;
  await page.getByRole('button', {name: '刷新', exact: true}).click(); await expect(page.getByText('正在加载服务监控数据，请稍候！', {exact: true})).toBeVisible(); await page.getByRole('link', {name: '工作台', exact: true}).click(); await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible(); await expect.poll(() => aborted).toBe(true);
});

test('completed monitor server sample survives actual tabs without an implicit resample',async({page})=>{
  let calls=0,blocked=false;
  await page.route('**/api/v1/monitor/server',async route=>{calls++;if(!blocked)await route.fulfill({json:sample}).catch(()=>{});});
  await login(page);await expect(page.locator('time')).toHaveAttribute('datetime',sample.sampledAt);const completed=calls;blocked=true;
  await page.getByRole('link',{name:'工作台',exact:true}).click();await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：服务器监控',exact:true}).click();
  await expect(page.locator('time')).toHaveAttribute('datetime',sample.sampledAt);await expect(page.getByRole('heading',{name:'CPU',exact:true})).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(calls).toBe(completed);
});