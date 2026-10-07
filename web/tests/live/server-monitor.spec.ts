import {test, expect} from '@playwright/test';
import type {ServerMonitorResponse} from '../../generated/api';
test('actual OSHI groups, memory units, refresh, navigation and no-role server denial', async ({page}) => {
  test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/server'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  const first = page.waitForResponse(response => response.url().endsWith('/api/v1/monitor/server') && response.status() === 200);
  await page.getByRole('button', {name: '登录', exact: true}).click(); const data: ServerMonitorResponse = await (await first).json();
  await expect(page.getByRole('heading', {name: 'CPU', exact: true})).toBeVisible(); expect(data.cpu.coreCount).toBeGreaterThan(0); expect(data.memory.totalGiB).toBeGreaterThan(0); expect(data.jvm.totalMiB).toBeGreaterThan(0); expect(data.disks.length).toBeGreaterThan(0);
  await expect(page.getByRole('row', {name: `总内存 ${data.memory.totalGiB} ${data.jvm.totalMiB}`, exact: true})).toBeVisible();
  for (const field of [data.host.name, data.host.operatingSystem, data.host.ip, data.host.architecture, data.jvm.home, data.host.workingDirectory, data.jvm.arguments, data.jvm.startedAt, data.jvm.uptime]) if (field) await expect(page.locator('dd').filter({hasText: field}).first()).toBeVisible();
  for (const disk of data.disks) {
    const row = page.getByRole('row').filter({has: page.getByRole('cell', {name: disk.mount, exact: true})}).first();
    for (const field of [disk.fileSystem, disk.type, disk.totalSize, disk.freeSize, disk.usedSize, `${disk.usagePercent}%`]) await expect(row).toContainText(field!);
    await expect(row.locator('.server-high-usage')).toHaveCount((disk.usagePercent ?? 0) > 80 ? 1 : 0);
  }
  const refreshed = page.waitForResponse(response => response.url().endsWith('/api/v1/monitor/server') && response.status() === 200); await page.getByRole('button', {name: '刷新', exact: true}).click();
  const next: ServerMonitorResponse = await (await refreshed).json(); expect(Date.parse(next.sampledAt)).toBeGreaterThan(Date.parse(data.sampledAt)); await expect(page.locator('time[datetime]')).toHaveAttribute('datetime', next.sampledAt);
  await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string), headers = {Authorization: `Bearer ${token}`};
  const bootstrap = await page.request.get('/api/v1/app/bootstrap', {headers}); const navigation = (await bootstrap.json()).navigation;
  expect(navigation.find((node: {key: string}) => node.key === 'monitor').children.map((node: {routeId: string}) => node.routeId)).toEqual(['monitor-online-sessions', 'monitor-jobs', 'monitor-druid', 'monitor-server', 'monitor-cache', 'monitor-cache-entries']);
  const username = `sv${Date.now()}`; const created = await page.request.post('/api/v1/system/users', {headers, data: {user: {username, displayName: '服务器权限验证', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}}); expect(created.status()).toBe(201); const account = await created.json();
  try {
    const login = await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}}); expect(login.status()).toBe(200); const ownToken: string = (await login.json()).accessToken;
    expect((await page.request.get('/api/v1/monitor/server', {headers: {Authorization: `Bearer ${ownToken}`}})).status()).toBe(403);
    await page.evaluate(accessToken => sessionStorage.setItem('eforge.enterprise.session.v1', JSON.stringify({accessToken, tokenType: 'Bearer'})), ownToken); await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible();
    expect(errors).toEqual([]);
  } finally {expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [account.id]}})).status()).toBe(204);}
});

test('real cached server sample survives tabs and interrupted sampling retries with explicit refresh',async({page})=>{
  await page.goto('/server');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('admin123');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'CPU',exact:true})).toBeVisible();const original=await page.locator('time[datetime]').getAttribute('datetime');
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string),headers={Authorization:'Bearer '+token};
  const menus=await(await page.request.get('/api/v1/system/menus',{headers})).json();expect(menus.find((menu:{routeId:string})=>menu.routeId==='monitor-server').cached).toBe(true);
  const observed:import('@playwright/test').Request[]=[];let blocked=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/monitor/server',async route=>{observed.push(route.request());if(blocked)await gate;await route.continue().catch(()=>{});});
  await page.getByRole('link',{name:'工作台',exact:true}).click();await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：服务监控',exact:true}).click();
  await expect(page.getByRole('heading',{name:'CPU',exact:true})).toBeVisible();await expect(page.locator('time[datetime]')).toHaveAttribute('datetime',original!);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(observed).toHaveLength(0);
  blocked=true;const requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/v1/monitor/server');await page.getByRole('button',{name:'刷新',exact:true}).click();const interrupted=await requested;
  try{await page.getByRole('link',{name:'工作台',exact:true}).click();await expect.poll(()=>interrupted.failure()?.errorText).toMatch(/aborted/i);}finally{blocked=false;release();}
  const resumed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/server'&&response.status()===200);await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：服务监控',exact:true}).click();const data:ServerMonitorResponse=await(await resumed).json();await expect(page.locator('time[datetime]')).toHaveAttribute('datetime',data.sampledAt);expect(Date.parse(data.sampledAt)).toBeGreaterThan(Date.parse(original!));
  const outcomes=await Promise.all(observed.map(async request=>({failure:request.failure(),status:(await request.response())?.status()})));expect(outcomes.filter(result=>result.status===200)).toHaveLength(1);expect(outcomes.filter(result=>result.status!==200).every(result=>/aborted/i.test(result.failure?.errorText??''))).toBe(true);const before=observed.length;
  const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/server'&&response.status()===200);await page.getByRole('button',{name:'刷新',exact:true}).click();const next:ServerMonitorResponse=await(await refreshed).json();await expect(page.locator('time[datetime]')).toHaveAttribute('datetime',next.sampledAt);expect(Date.parse(next.sampledAt)).toBeGreaterThan(Date.parse(data.sampledAt));expect(observed).toHaveLength(before+1);
});