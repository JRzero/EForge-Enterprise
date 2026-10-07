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
  let gate: Promise<void> | undefined;
  async function retry() {
    let release!: () => void; gate = new Promise<void>(resolve => {release = resolve;});
    await page.getByRole('button', {name: '重试', exact: true}).click();
    // Consecutive failures share text. Remove the preceding alert before releasing
    // this request so an assertion cannot accidentally accept the previous phase.
    await expect(page.getByText('正在加载控制台，请稍候！')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
    gate = undefined; release();
  }
  await page.route('**/api/v1/monitor/consoles/druid', async route => {await gate; await route.fulfill({status, json: status === 200 ? {enabled: true} : {code: status === 403 ? 'ACCESS_DENIED' : 'CONSOLE_UNAVAILABLE'}});});
  await page.route('**/api/v1/monitor/consoles/druid/session', async route => {await gate; await route.fulfill({status: opening, json: opening === 200 ? {entryPath: entry, expiresInSeconds: 300} : {code: 'CONSOLE_UNAVAILABLE'}});});
  await page.route('**/druid/login.html', async route => {await gate; await route.fulfill({status: resource, contentType: resource === 200 ? 'text/html' : 'application/problem+json', body: resource === 200 ? '<html><body>监控资源</body></html>' : '{"status":401}'});});
  await login(page); await expect(page.getByRole('alert')).toContainText('控制台暂时不可用');
  status = 200; opening = 503; await retry(); await expect(page.getByRole('alert')).toContainText('控制台暂时不可用');
  opening = 200; entry = 'https://example.org/?token=unsafe'; await retry(); await expect(page.getByRole('alert')).toContainText('控制台暂时无法加载'); await expect(page.locator('iframe')).toHaveCount(0);
  entry = '/druid/login.html'; resource = 401; const rejected = page.waitForResponse(response => response.url().endsWith('/druid/login.html') && response.status() === 401); await retry(); await rejected; await expect(page.getByRole('alert')).toContainText('控制台暂时无法加载');
  resource = 200; await retry(); await expect(page.frameLocator('iframe').getByText('监控资源')).toBeVisible();
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

async function cachedConsoleLogin(page:Page,target:'druid'|'api-docs'){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'reader',displayName:'读者'},roles:[],permissions:['app:dashboard:view','monitor:druid:list','tool:swagger:list'],navigation:[{key:'dashboard',type:'ROUTE',routeId:'dashboard',label:'工作台',cached:true,order:0,children:[]},{key:'monitor-druid',type:'ROUTE',routeId:'monitor-druid',label:'数据监控',cached:true,order:1,children:[]},{key:'tool-openapi',type:'ROUTE',routeId:'tool-openapi',label:'接口文档',cached:true,order:2,children:[]}]}}));
  await page.goto(target==='druid'?'/druid':'/swagger');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}
for(const [target,entry,label] of [['druid','/druid/login.html','数据监控'],['api-docs','/swagger-ui/index.html','接口文档']] as const)test('cached console '+target+' retains its native document and input without a renewed ticket',async({page})=>{
  let opens=0,documents=0,blocked=false;
  await page.route('**/api/v1/monitor/consoles/'+target,route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/v1/monitor/consoles/'+target+'/session',async route=>{opens++;if(!blocked)await route.fulfill({json:{entryPath:entry,expiresInSeconds:300}}).catch(()=>{});});
  await page.route('**'+entry,route=>{expect(route.request().headers().authorization).toBeUndefined();if(route.request().resourceType()==='document')documents++;return route.fulfill({contentType:'text/html',body:'<html><body><label>控制台筛选<input aria-label="控制台筛选"></label><h1>已认证的控制台</h1></body></html>'});});
  await cachedConsoleLogin(page,target);const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'已认证的控制台'})).toBeVisible();await frame.getByRole('textbox',{name:'控制台筛选'}).fill('保留的原生控制台状态');
  const nonce=await frame.locator('html').evaluate(element=>{element.dataset.ownerNonce=crypto.randomUUID();return element.dataset.ownerNonce;});const before={opens,documents};blocked=true;
  await page.getByRole('link',{name:'工作台',exact:true}).click();await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：'+label,exact:true}).click();
  await expect(frame.getByRole('textbox',{name:'控制台筛选'})).toHaveValue('保留的原生控制台状态');await expect(frame.locator('html')).toHaveAttribute('data-owner-nonce',nonce);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect({opens,documents}).toEqual(before);
});

test('cached console hidden credential expiry cannot silently open a new ticket',async({page})=>{
  await page.clock.install();let opens=0;
  await page.route('**/api/v1/monitor/consoles/druid',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session',route=>{opens++;return route.fulfill({json:{entryPath:'/druid/login.html',expiresInSeconds:20}});});
  await page.route('**/druid/login.html',route=>route.fulfill({contentType:'text/html',body:'<html><body><h1>已认证的控制台</h1></body></html>'}));
  await cachedConsoleLogin(page,'druid');await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();const before=opens;
  await page.getByRole('link',{name:'工作台',exact:true}).click();await page.clock.runFor(21000);await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：数据监控',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('控制台凭据已到期');await expect(page.locator('iframe')).toHaveCount(0);expect(opens).toBe(before);
  await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();expect(opens).toBe(before+1);
});
for(const mode of ['revoked','disabled'] as const)test('cached console return gates retained HTML until fresh '+mode+' status',async({page})=>{
  let opens=0,hold=false,statusRequests=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/monitor/consoles/druid',async route=>{statusRequests++;if(hold)await gate;await route.fulfill({status:hold&&mode==='revoked'?403:200,json:hold&&mode==='revoked'?{code:'ACCESS_DENIED'}:{enabled:!hold||mode!=='disabled'}}).catch(()=>{});});
  await page.route('**/api/v1/monitor/consoles/druid/session',route=>{opens++;return route.fulfill({json:{entryPath:'/druid/login.html',expiresInSeconds:300}});});
  await page.route('**/druid/login.html',route=>route.fulfill({contentType:'text/html',body:'<html><body><h1>已认证的控制台</h1></body></html>'}));
  await cachedConsoleLogin(page,'druid');await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();
  const nonce=await page.frameLocator('iframe').locator('html').evaluate(element=>{element.dataset.ownerNonce=crypto.randomUUID();return element.dataset.ownerNonce;});const before=opens;
  await page.getByRole('link',{name:'工作台',exact:true}).click();hold=true;const prior=statusRequests;
  await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：数据监控',exact:true}).click();await expect.poll(()=>statusRequests).toBeGreaterThan(prior);
  await expect(page.locator('iframe')).toHaveCount(1);await expect(page.locator('iframe')).toBeHidden();await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-owner-nonce',nonce);expect(opens).toBe(before);
  release();if(mode==='revoked')await expect(page.getByRole('alert')).toBeVisible();else await expect(page.getByText('该控制台尚未启用，请联系管理员。')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);expect(opens).toBe(before);
});
test('cached console rejects a lost scoped ticket while the main login remains valid',async({page})=>{
  let opens=0,denyNative=false;
  await page.route('**/api/v1/monitor/consoles/druid',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session',route=>{opens++;return route.fulfill({json:{entryPath:'/druid/login.html',expiresInSeconds:300}});});
  await page.route('**/druid/login.html',route=>{expect(route.request().headers().authorization).toBeUndefined();return route.fulfill({status:denyNative?401:200,contentType:denyNative?'application/problem+json':'text/html',body:denyNative?'{"code":"AUTHENTICATION_REQUIRED","status":401}':'<html><body><h1>已认证的控制台</h1></body></html>'});});
  await cachedConsoleLogin(page,'druid');await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();const before=opens;
  await page.getByRole('link',{name:'工作台',exact:true}).click();denyNative=true;await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：数据监控',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('控制台凭据已到期');await expect(page.locator('iframe')).toHaveCount(0);expect(opens).toBe(before);expect(await page.evaluate(()=>!!sessionStorage.getItem('eforge.enterprise.session.v1'))).toBe(true);
  denyNative=false;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();expect(opens).toBe(before+1);
});
test('late native navigation cannot reveal retained HTML before its scoped probe completes',async({page})=>{
  let opens=0,hold=false,pending=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/monitor/consoles/druid',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session',route=>{opens++;return route.fulfill({json:{entryPath:'/druid/login.html',expiresInSeconds:300}});});
  await page.route('**/druid/login.html',async route=>{if(hold&&route.request().resourceType()!=='document'){pending++;await gate;await route.fulfill({status:401,contentType:'application/problem+json',body:'{"status":401}'}).catch(()=>{});}else await route.fulfill({contentType:'text/html',body:'<html><body><h1>已认证的控制台</h1></body></html>'});});
  await page.route('**/druid/native-page.html',route=>route.fulfill({contentType:'text/html',body:'<html><body><h1>原生窗口晚完成</h1></body></html>'}));
  await cachedConsoleLogin(page,'druid');await expect(page.frameLocator('iframe').getByRole('heading',{name:'已认证的控制台'})).toBeVisible();const before=opens;
  await page.getByRole('link',{name:'工作台',exact:true}).click();hold=true;await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：数据监控',exact:true}).click();await expect.poll(()=>pending).toBeGreaterThan(0);await expect(page.locator('iframe')).toBeHidden();
  await page.frameLocator('iframe').locator('html').evaluate(element=>{element.ownerDocument.defaultView!.location.href='/druid/native-page.html';});await expect(page.frameLocator('iframe').locator('h1')).toHaveText('原生窗口晚完成');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('iframe')).toBeHidden();expect(opens).toBe(before);
  release();await expect(page.getByRole('alert')).toContainText('控制台凭据已到期');await expect(page.locator('iframe')).toHaveCount(0);expect(opens).toBe(before);
});
test('embedded authorization stays inside the remaining viewport after header layout and resize',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.route('**/api/v1/monitor/consoles/druid',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/v1/monitor/consoles/druid/session',route=>route.fulfill({json:{entryPath:'/druid/login.html',expiresInSeconds:300}}));
  await page.route('**/druid/login.html',route=>route.fulfill({contentType:'text/html',body:`<html><body><h1>Viewport console</h1><button onclick="document.getElementById('authorization').hidden=false">Open authorization</button><div id="authorization" hidden style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:220px;height:240px;max-height:90vh;overflow:auto;background:white;border:1px solid;padding:12px"><label>Credential<input aria-label="Credential"></label><div style="height:150px"></div><button onclick="document.body.dataset.applied='yes';document.getElementById('authorization').hidden=true">Apply credentials</button></div></body></html>`}));
  await login(page);await expect(page.frameLocator('iframe').getByRole('heading',{name:'Viewport console'})).toBeVisible();
  // Viewport emulation completes before the native resize/ResizeObserver callbacks.
  // Require the same exact positive-size bounds after owned layout settles.
  const fits=async()=>{await expect.poll(async()=>{const box=await page.locator('iframe').boundingBox();return box && box.height>0?box.y+box.height-page.viewportSize()!.height:Number.POSITIVE_INFINITY;}).toBeLessThanOrEqual(0);};
  await fits();const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'Open authorization',exact:true}).click();await frame.getByLabel('Credential',{exact:true}).fill('fixture');await frame.getByRole('button',{name:'Apply credentials',exact:true}).click();await expect(frame.locator('body')).toHaveAttribute('data-applied','yes');
  await page.setViewportSize({width:390,height:600});await fits();await page.setViewportSize({width:1280,height:560});await fits();
});
