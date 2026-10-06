import {test, expect} from '@playwright/test';
for (const username of ['admin', 'ry']) {
  test(`${username}: real login, Redis session restore and logout invalidation`, async ({page}) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/dashboard'); await page.getByLabel('账号', {exact: true}).fill(username);
    await page.getByLabel('密码', {exact: true}).fill('admin123');
    await page.getByRole('button', {name: '登录', exact: true}).click();
    await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible();
    await expect(page.getByRole('link', {name: '工作台', exact: true})).toBeVisible();
    await page.screenshot({path: `test-results/live-${username}-dashboard.png`, fullPage: true});
    const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
    await page.reload(); await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible();
    await page.goto('/missing'); await expect(page.getByRole('heading', {name: '页面不存在'})).toBeVisible();
    await page.getByRole('button', {name: '返回工作台'}).click();
    await page.getByRole('button', {name: '退出登录'}).click();
    await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
    const status = await page.evaluate(async token => (await fetch('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${token}`}})).status, token);
    expect(status).toBe(401); expect(errors).toEqual([]);
  });
}

test('real server revocation finishes when concurrent notice 401 clears local auth', async ({page}) => {
  const failures:string[]=[];page.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/logout')failures.push(request.failure()?.errorText??'failed');});
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');
  await page.getByLabel('密码',{exact:true}).fill('admin123');await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
  await page.getByRole('button',{name:/^通知公告（/}).click();await expect(page.getByRole('button',{name:'刷新公告',exact:true})).toBeEnabled();
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  let release!:()=>void,revoked!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});const serverRevoked=new Promise<void>(resolve=>{revoked=resolve;});
  await page.route('**/logout',async route=>{
    const response=await route.fetch();expect(response.status()).toBe(200);expect((await response.json()).code).toBe(200);
    revoked();await gate;await route.fulfill({response});
  });
  try {
    await page.getByRole('button',{name:'退出登录',exact:true}).click();await serverRevoked;
    await page.getByRole('button',{name:/^通知公告（/}).click();
    const unauthorized=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/system/notices/feed'&&response.status()===401);
    await page.getByRole('button',{name:'刷新公告',exact:true}).click();await unauthorized;
    await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
    expect(failures).toEqual([]);
    const completed=page.waitForResponse(response=>new URL(response.url()).pathname==='/logout'&&response.request().method()==='POST');
    release();expect((await completed).status()).toBe(200);expect(failures).toEqual([]);
    expect((await page.request.get('/api/v1/app/bootstrap',{headers:{Authorization:'Bearer '+token}})).status()).toBe(401);
  } finally {release();}
});
