import {test, expect, type Page} from '@playwright/test';
import type {CacheStatistics} from '../../generated/api';
const sessionId = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {login_user_key: string}).login_user_key;
async function login(page: Page, path: string) {
  await page.goto(path); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: path === '/cache' ? '缓存监控' : '缓存列表', exact: true})).toBeVisible();
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  return {token, headers: {Authorization: `Bearer ${token}`}};
}
async function freshHeaders(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', {data: {username: 'admin', password: 'admin123'}}); expect(response.status()).toBe(200);
  return {Authorization: `Bearer ${(await response.json()).accessToken}`};
}
test('real Redis statistics, SVG charts, refresh and no-role cache denial', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const pending = page.waitForResponse(response => response.url().endsWith('/api/v1/monitor/cache') && response.status() === 200);
  const {headers} = await login(page, '/cache'), data: CacheStatistics = await (await pending).json();
  for (const [label, value] of [['Redis 版本', data.info.version], ['端口', data.info.port], ['Key 数量', data.keyCount], ['使用内存', data.info.usedMemory]]) await expect(page.locator('.cache-info > div').filter({has: page.getByText(label!, {exact: true})}).locator('dd')).toHaveText(value!);
  for (const label of ['Redis 命令统计玫瑰图', 'Redis 内存消耗仪表图']) {await expect(page.getByRole('img', {name: label}).locator('svg')).toBeVisible(); expect(await page.getByRole('img', {name: label}).locator('path').count()).toBeGreaterThan(0);}
  const command = data.commands[0]!; expect(command).toBeDefined(); await page.getByRole('button', {name: new RegExp(`^${command.name}：`)}).focus(); await page.keyboard.press('Enter'); await expect(page.locator('.cache-chart-tooltip')).toContainText(`${command.calls} 次`);
  await page.setViewportSize({width: 390, height: 844}); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const refreshed = page.waitForResponse(response => response.url().endsWith('/api/v1/monitor/cache') && response.status() === 200); await page.getByRole('button', {name: '刷新', exact: true}).click(); const next: CacheStatistics = await (await refreshed).json(); await expect(page.locator('.cache-info > div').filter({has: page.getByText('Key 数量', {exact: true})}).locator('dd')).toHaveText(next.keyCount);
  const username = `ca${Date.now()}`, created = await page.request.post('/api/v1/system/users', {headers, data: {user: {username, displayName: '缓存权限验证', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}}); expect(created.status()).toBe(201); const account = await created.json();
  try {
    const response = await page.request.post('/api/v1/auth/login', {data: {username, password: 'User12345'}}); expect(response.status()).toBe(200); const accessToken = (await response.json()).accessToken, own = {Authorization: `Bearer ${accessToken}`};
    for (const path of ['/api/v1/monitor/cache', '/api/v1/monitor/cache/names', '/api/v1/monitor/cache/keys?name=sys_config%3A', '/api/v1/monitor/cache/value?name=sys_config%3A&key=sys_config%3Aabsent']) expect((await page.request.get(path, {headers: own})).status()).toBe(403);
    expect((await page.request.delete('/api/v1/monitor/cache', {headers: own})).status()).toBe(403);
    await page.evaluate(token => sessionStorage.setItem('eforge.enterprise.session.v1', JSON.stringify({accessToken: token})), accessToken); await page.reload(); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); await page.goto('/cacheList'); await expect(page.getByRole('heading', {name: '暂无访问权限'})).toBeVisible(); expect(errors).toEqual([]);
  } finally {expect((await page.request.delete('/api/v1/system/users', {headers, data: {ids: [account.id]}})).status()).toBe(204);}
});
test('real cache key and namespace controls retain SQL records and other namespaces', async ({page}) => {
  const {headers} = await login(page, '/cacheList'), stamp = Date.now(), key = `缓存/键 & <img src=x> ${stamp}`, other = `cache-other-${stamp}`, value = '<img src=x onerror="window.cacheInjected=true"> 中文';
  const ids: string[] = [];
  try {
    for (const item of [key, other]) {const created = await page.request.post('/api/v1/system/configurations', {headers, data: {name: item, key: item, value, builtin: false}}); expect(created.status()).toBe(201); ids.push((await created.json()).id);}
    // Each configuration mutation invalidates the namespace; warm both persisted rows.
    for (const item of [key, other]) {const loaded = await page.request.get(`/api/v1/system/configurations/lookup?key=${encodeURIComponent(item)}`, {headers}); expect(loaded.status()).toBe(200); expect((await loaded.json()).value).toBe(value);}
    const dict = await page.request.get('/api/v1/monitor/cache/keys?name=sys_dict%3A', {headers}); expect(dict.status()).toBe(200); const dictKeys: string[] = await dict.json();
    await page.getByRole('button', {name: '查看缓存 sys_config:', exact: true}).click(); const literal = `sys_config:${key}`;
    await page.getByRole('button', {name: `查看键 ${literal}`, exact: true}).click(); await expect(page.getByLabel('缓存值', {exact: true})).toHaveText(value); await expect(page.getByRole('textbox', {name: '缓存键名', exact: true})).toHaveValue(key); expect(await page.locator('.cache-value img').count()).toBe(0);
    await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', {name: `清理键 ${literal}`, exact: true}).click(); await page.keyboard.press('Escape'); expect((await page.request.get(`/api/v1/monitor/cache/value?name=sys_config%3A&key=${encodeURIComponent(literal)}`, {headers})).status()).toBe(200);
    await page.getByRole('button', {name: `清理键 ${literal}`, exact: true}).click(); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('button', {name: `查看键 ${literal}`, exact: true})).toHaveCount(0); await expect(page.getByRole('button', {name: `查看键 sys_config:${other}`, exact: true})).toBeVisible();
    expect((await page.request.get(`/api/v1/monitor/cache/value?name=sys_config%3A&key=${encodeURIComponent(literal)}`, {headers})).status()).toBe(404);
    const lookup = await page.request.get(`/api/v1/system/configurations/lookup?key=${encodeURIComponent(key)}`, {headers}); expect(lookup.status()).toBe(200); expect((await lookup.json()).value).toBe(value);
    await page.getByRole('button', {name: '刷新键名', exact: true}).click(); await expect(page.getByRole('button', {name: `查看键 ${literal}`, exact: true})).toBeVisible();
    await page.getByRole('button', {name: '清理类别 sys_config:', exact: true}).click(); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByText('暂无缓存键', {exact: true})).toBeVisible();
    expect((await page.request.get('/api/v1/app/bootstrap', {headers})).status()).toBe(200); expect(await (await page.request.get('/api/v1/monitor/cache/keys?name=sys_dict%3A', {headers})).json()).toEqual(dictKeys);
    for (const id of ids) expect((await page.request.get(`/api/v1/system/configurations/${id}`, {headers})).status()).toBe(200);
  } finally {if (ids.length) expect((await page.request.delete('/api/v1/system/configurations', {headers: await freshHeaders(page), data: {ids}})).status()).toBe(204);}
});
for (const scope of ['key', 'name', 'all'] as const) test(`real ${scope} session clearing expires the appropriate tokens and browser`, async ({page}) => {
  const {token, headers} = await login(page, '/cacheList'); const reader = await page.request.post('/api/v1/auth/login', {data: {username: 'admin', password: 'admin123'}}); expect(reader.status()).toBe(200); const otherToken: string = (await reader.json()).accessToken, otherHeaders = {Authorization: `Bearer ${otherToken}`};
  const configKey = `cache-session-${scope}-${Date.now()}`, config = await page.request.post('/api/v1/system/configurations', {headers, data: {name: configKey, key: configKey, value: 'keep', builtin: false}}); expect(config.status()).toBe(201); const record = await config.json();
  try {
    await page.getByRole('button', {name: '查看缓存 login_tokens:', exact: true}).click(); const otherKey = `login_tokens:${sessionId(otherToken)}`;
    await page.getByRole('button', {name: `查看键 ${otherKey}`, exact: true}).click(); const contents = page.getByLabel('缓存值', {exact: true}); await expect(contents).toContainText('admin'); expect(await contents.textContent()).not.toMatch(/"(?:password|accessToken|credentials)"/);
    if (scope === 'key') {
      await page.getByRole('button', {name: `清理键 ${otherKey}`, exact: true}).click(); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('button', {name: `查看键 ${otherKey}`, exact: true})).toHaveCount(0);
      expect((await page.request.get('/api/v1/app/bootstrap', {headers: otherHeaders})).status()).toBe(401); expect((await page.request.get('/api/v1/app/bootstrap', {headers})).status()).toBe(200);
      await page.getByRole('button', {name: `清理键 login_tokens:${sessionId(token)}`, exact: true}).click();
    } else if (scope === 'name') await page.getByRole('button', {name: '清理类别 login_tokens:', exact: true}).click(); else await page.getByRole('button', {name: '清理全部', exact: true}).click();
    await expect(page.getByRole('alertdialog')).toContainText('会话'); await page.getByRole('button', {name: '确认清理', exact: true}).click(); await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
    for (const own of [headers, otherHeaders]) expect((await page.request.get('/api/v1/app/bootstrap', {headers: own})).status()).toBe(401);
    const fresh = await freshHeaders(page), result = await page.request.get(`/api/v1/monitor/cache/value?name=sys_config%3A&key=${encodeURIComponent(`sys_config:${configKey}`)}`, {headers: fresh}); expect(result.status()).toBe(scope === 'all' ? 404 : 200);
    expect((await page.request.get(`/api/v1/system/configurations/${record.id}`, {headers: fresh})).status()).toBe(200);
  } finally {expect((await page.request.delete('/api/v1/system/configurations', {headers: await freshHeaders(page), data: {ids: [record.id]}})).status()).toBe(204);}
});

test('real retained cache reads cancel interrupted refresh, preserve completed values and revalidate explicit refresh',async({page})=>{
  const {headers}=await login(page,'/cacheList'),key='retained-cache-'+Date.now(),value='真实 Redis 保留值';
  const menus=await(await page.request.get('/api/v1/system/menus',{headers})).json();expect(menus.find((menu:{routeId:string})=>menu.routeId==='monitor-cache-entries').cached).toBe(true);
  const created=await page.request.post('/api/v1/system/configurations',{headers,data:{name:key,key,value,builtin:false}});expect(created.status()).toBe(201);const id=(await created.json()).id;
  const counts={names:0,keys:0,value:0};let blocked=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/monitor/cache/**',async route=>{const kind=new URL(route.request().url()).pathname.split('/').at(-1) as keyof typeof counts;counts[kind]++;if(blocked&&kind==='value')await gate;await route.continue().catch(()=>{});});
  try{
    expect((await page.request.get('/api/v1/system/configurations/lookup?key='+encodeURIComponent(key),{headers})).status()).toBe(200);
    await page.getByRole('button',{name:'查看缓存 sys_config:',exact:true}).click();await page.getByRole('button',{name:'查看键 sys_config:'+key,exact:true}).click();
    await expect(page.getByLabel('缓存值',{exact:true})).toHaveText(value);const before={...counts};
    await page.getByRole('link',{name:'工作台',exact:true}).click();await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：缓存列表',exact:true}).click();
    await expect(page.getByLabel('缓存值',{exact:true})).toHaveText(value);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(counts).toEqual(before);
    blocked=true;const requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/v1/monitor/cache/value');
    await page.getByRole('button',{name:'刷新内容',exact:true}).click();const interrupted=await requested;
    await page.getByRole('link',{name:'工作台',exact:true}).click();await expect.poll(()=>interrupted.failure()?.errorText).toMatch(/aborted/i);
    blocked=false;release();const resumed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/cache/value'&&response.status()===200);
    await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：缓存列表',exact:true}).click();await resumed;await expect(page.getByLabel('缓存值',{exact:true})).toHaveText(value);
    for(const [label,kind] of [['刷新名称','names'],['刷新键名','keys'],['刷新内容','value']] as const){const count=counts[kind],response=page.waitForResponse(result=>new URL(result.url()).pathname==='/api/v1/monitor/cache/'+kind&&result.status()===200);
      await page.getByRole('button',{name:label,exact:true}).click();await response;await expect(page.getByLabel('缓存值',{exact:true})).toHaveText(value);expect(counts[kind]).toBe(count+1);}
    expect((await(await page.request.get('/api/v1/system/configurations/'+id,{headers})).json()).value).toBe(value);
  }finally{release();expect((await page.request.delete('/api/v1/system/configurations',{headers:await freshHeaders(page),data:{ids:[id]}})).status()).toBe(204);}
});
test('real cached Redis statistics retain graphs and keyboard interaction, cancel interrupted reads and explicitly refresh',async({page})=>{
  const first=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/cache'&&response.status()===200);const {headers}=await login(page,'/cache'),data:CacheStatistics=await(await first).json();
  await expect(page.locator('.cache-info > div').filter({has:page.getByText('Key 数量',{exact:true})}).locator('dd')).toHaveText(data.keyCount);await expect(page.locator('.cache-chart svg')).toHaveCount(2);
  const menus=await(await page.request.get('/api/v1/system/menus',{headers})).json();expect(menus.find((menu:{routeId:string})=>menu.routeId==='monitor-cache').cached).toBe(true);
  const observed:import('@playwright/test').Request[]=[];let blocked=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/monitor/cache',async route=>{observed.push(route.request());if(blocked)await gate;await route.continue().catch(()=>{});});
  await page.getByRole('link',{name:'工作台',exact:true}).click();await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：缓存监控',exact:true}).click();
  await expect(page.locator('.cache-info > div').filter({has:page.getByText('Key 数量',{exact:true})}).locator('dd')).toHaveText(data.keyCount);await expect(page.locator('.cache-chart svg')).toHaveCount(2);
  const command=data.commands[0]!;await page.getByRole('button',{name:new RegExp('^'+command.name+'：')}).focus();await page.keyboard.press('Enter');await expect(page.locator('.cache-chart-tooltip')).toContainText(command.calls+' 次');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect(observed).toHaveLength(0);
  blocked=true;const requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/v1/monitor/cache');await page.getByRole('button',{name:'刷新',exact:true}).click();const interrupted=await requested;
  try{await page.getByRole('link',{name:'工作台',exact:true}).click();await expect.poll(()=>interrupted.failure()?.errorText).toMatch(/aborted/i);}finally{blocked=false;release();}
  const resumed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/cache'&&response.status()===200);await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：缓存监控',exact:true}).click();const next:CacheStatistics=await(await resumed).json();await expect(page.locator('.cache-info > div').filter({has:page.getByText('Key 数量',{exact:true})}).locator('dd')).toHaveText(next.keyCount);await expect(page.locator('.cache-chart svg')).toHaveCount(2);
  const outcomes=await Promise.all(observed.map(async request=>({failure:request.failure(),status:(await request.response())?.status()})));expect(outcomes.filter(result=>result.status===200)).toHaveLength(1);expect(outcomes.filter(result=>result.status!==200).every(result=>/aborted/i.test(result.failure?.errorText??''))).toBe(true);const before=observed.length;
  const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/monitor/cache'&&response.status()===200);await page.getByRole('button',{name:'刷新',exact:true}).click();const final:CacheStatistics=await(await refreshed).json();await expect(page.locator('.cache-info > div').filter({has:page.getByText('Key 数量',{exact:true})}).locator('dd')).toHaveText(final.keyCount);expect(observed).toHaveLength(before+1);
});