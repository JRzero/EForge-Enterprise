import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
async function setup(page:Page,cached=true){
  const state={permissions:['app:dashboard:view','system:role:list','system:post:list'],cached,userId:'1'};
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/logout',route=>route.fulfill({json:{code:200}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:state.userId,username:'admin',displayName:'管理员'},roles:['admin'],permissions:state.permissions,navigation:[
    {key:'home',type:'ROUTE',routeId:'dashboard',label:'工作台',order:0,children:[]},
    {key:'role',type:'ROUTE',routeId:'system-roles',label:'角色管理',cached:state.cached,order:1,children:[]},
    {key:'post',type:'ROUTE',routeId:'system-posts',label:'岗位管理',order:2,children:[]}]}}));
  await page.route('**/api/v1/system/roles?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.route('**/api/v1/system/posts?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('password');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'你好，管理员'})).toBeVisible();return state;
}
async function navigate(page:Page,name:string){await page.locator('.ef-app-shell__nav').getByRole('link',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
test('cached real resource drafts survive tab switches; refresh, close and logout discard them',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
  await navigate(page,'角色管理');await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('未提交草稿');
  await navigate(page,'岗位管理');const tabs=page.getByRole('navigation',{name:'页面标签'});
  await expect(tabs.getByRole('link')).toHaveCount(3);await expect(tabs.getByRole('button',{name:'关闭标签 工作台'})).toHaveCount(0);
  await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).click();await expect(page.locator('.list-filters').getByLabel('角色名称',{exact:true})).toHaveValue('未提交草稿');
  await tabs.getByRole('button',{name:'刷新当前页面'}).click();await expect(page.locator('.list-filters').getByLabel('角色名称',{exact:true})).toHaveValue('');
  await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('关闭后不保留');await tabs.getByRole('button',{name:'关闭标签 角色管理'}).click();
  await expect(tabs.getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);await navigate(page,'角色管理');await expect(page.locator('.list-filters').getByLabel('角色名称',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'退出登录'}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(tabs).toHaveCount(0);expect(errors).toEqual([]);
});
test('uncached pages reset on switching; context actions retain the affix and close correct sides',async({page})=>{
  await setup(page,false);await navigate(page,'角色管理');await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('不缓存');
  await navigate(page,'岗位管理');const tabs=page.getByRole('navigation',{name:'页面标签'});await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
  await expect(page.locator('.list-filters').getByLabel('角色名称',{exact:true})).toHaveValue('');
  await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).click({button:'right'});const menu=page.getByRole('menu',{name:'标签操作菜单'});
  await expect(menu.getByRole('menuitem',{name:'刷新页面'})).toBeFocused();await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitem',{name:'关闭当前'})).toBeFocused();
  await menu.getByRole('menuitem',{name:'关闭右侧'}).click();await expect(tabs.getByRole('link')).toHaveCount(2);
  await navigate(page,'岗位管理');await tabs.getByRole('link',{name:'页面标签：岗位管理',exact:true}).click({button:'right'});await menu.getByRole('menuitem',{name:'关闭左侧'}).click();
  await expect(tabs.getByRole('link')).toHaveCount(2);await expect(tabs.getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);
  await tabs.getByRole('button',{name:'标签操作'}).click();await menu.getByRole('menuitem',{name:'全部关闭'}).click();
  await expect(page.getByRole('heading',{name:'你好，管理员'})).toBeVisible();await expect(tabs.getByRole('link')).toHaveCount(1);
});
test('dropdown, fullscreen escape, mobile scrolling and revoked cache isolate resource pages',async({page})=>{
  const state=await setup(page);await navigate(page,'角色管理');await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('旧权限草稿');
  const tabs=page.getByRole('navigation',{name:'页面标签'});await tabs.getByRole('button',{name:'标签操作'}).click();
  await page.getByRole('menuitem',{name:'全屏显示'}).click();await expect(page.locator('.ef-app-shell__sidebar')).toBeHidden();await page.keyboard.press('Escape');await expect(page.locator('.ef-app-shell__sidebar')).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(tabs.getByRole('link',{name:/工作台/})).toBeFocused();
  state.permissions=['app:dashboard:view'];await page.reload();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();
  await expect(page.locator('[data-page-path="/role"]')).toHaveCount(0);await expect(tabs.getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);
});

test('opt-in remembered tags restore only authorized static routes and never another account cache',async({page})=>{
  const state=await setup(page);await navigate(page,'角色管理');await navigate(page,'岗位管理');
  await page.getByLabel('记住标签',{exact:true}).check();
  const remembered=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('eforge.enterprise.page-tabs.v1.1')??'null')?.hrefs);
  await expect.poll(remembered).toEqual(['/role','/post']);
  await page.reload();await expect(page.getByRole('heading',{name:'岗位管理',exact:true})).toBeVisible();
  const tabs=page.getByRole('navigation',{name:'页面标签'});await expect(tabs.getByRole('link')).toHaveCount(3);
  state.permissions=['app:dashboard:view','system:post:list'];await page.reload();
  // Absence alone also matches the lazy loading screen; first wait for the restored workspace.
  await expect(page.getByRole('heading',{name:'岗位管理',exact:true})).toBeVisible();
  await expect(tabs.getByRole('link',{name:'页面标签：岗位管理',exact:true})).toBeVisible();
  await expect(tabs.getByRole('link')).toHaveCount(2);
  await expect(tabs.getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);
  await expect.poll(remembered).toEqual(['/post']);
  await page.evaluate(()=>localStorage.setItem('eforge.enterprise.page-tabs.v1.1',JSON.stringify({enabled:true,hrefs:['https://evil.example/role','javascript:alert(1)','/role','/unknown','/role/users/%']})));
  await page.reload();await expect(page.getByRole('heading',{name:'岗位管理',exact:true})).toBeVisible();await expect(tabs.getByRole('link')).toHaveCount(2);
  await page.getByLabel('记住标签',{exact:true}).uncheck();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('eforge.enterprise.page-tabs.v1.1'))).toBeNull();
});
test('hidden cached page cancels pending reads and resumes them when restored',async({page})=>{
  await setup(page);const rows={items:[{id:'2',name:'恢复读取角色',key:'resumed',sort:1,status:'0'}],total:1,page:1,pageSize:10};
  await page.route('**/api/v1/system/roles?*',route=>route.fulfill({json:rows}));
  await navigate(page,'角色管理');await expect(page.getByRole('cell',{name:'恢复读取角色',exact:true})).toBeVisible();
  let requests=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/system/roles?*',async route=>{requests++;await gate;await route.fulfill({json:rows}).catch(()=>{});});
  // Refresh a completed list, so the captured request is not an initial StrictMode abort.
  const requested=page.waitForRequest(request=>request.url().includes('/api/v1/system/roles?'));
  await page.getByRole('button',{name:'刷新列表',exact:true}).click();const pending=await requested;
  const aborted=page.waitForEvent('requestfailed',{predicate:request=>request===pending});
  try{await navigate(page,'岗位管理');expect((await aborted).failure()?.errorText).toMatch(/abort|cancel/i);}
  finally{release();}
  const before=requests,resumed=page.waitForResponse(response=>response.url().includes('/api/v1/system/roles?'));
  await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
  expect((await resumed).status()).toBe(200);await expect(page.getByRole('cell',{name:'恢复读取角色',exact:true})).toBeVisible();expect(requests).toBeGreaterThan(before);
  const completed=requests,selection=page.getByRole('checkbox',{name:'选择角色 恢复读取角色',exact:true});await selection.check();
  await navigate(page,'岗位管理');await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
  await expect(selection).toBeChecked();expect(requests).toBe(completed);
});
test('a bootstrap permission refresh clears retained pages immediately without reloading the document',async({page})=>{
  const state=await setup(page);state.permissions.push('system:role:add');await page.reload();
  await page.route('**/api/v1/system/roles/menus',route=>route.fulfill({json:[]}));
  await page.route('**/api/v1/system/roles',route=>{state.permissions=['app:dashboard:view','system:post:list'];return route.fulfill({status:201,json:{id:'3',name:'已保存角色',key:'saved',sort:0,status:'0'}});});
  await navigate(page,'角色管理');await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('原权限草稿');
  await navigate(page,'岗位管理');await page.locator('.list-filters').getByLabel('岗位名称',{exact:true}).fill('其他草稿');
  await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
  await page.getByRole('button',{name:'新增角色',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('角色名称',{exact:true}).fill('已保存角色');await dialog.getByLabel('权限字符',{exact:true}).fill('saved');
  await dialog.getByRole('button',{name:'保存角色',exact:true}).click();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();
  await expect(page.locator('[data-page-path="/role"]')).toHaveCount(0);await expect(page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);
  await navigate(page,'岗位管理');await expect(page.locator('.list-filters').getByLabel('岗位名称',{exact:true})).toHaveValue('');
});
test('remembered links are separated by bootstrap account identity and page drafts never survive logout',async({page})=>{
  const state=await setup(page);await navigate(page,'角色管理');await page.locator('.list-filters').getByLabel('角色名称',{exact:true}).fill('账号一草稿');
  await page.getByLabel('记住标签',{exact:true}).check();await page.getByRole('button',{name:'退出登录'}).click();
  await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();state.userId='2';
  await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
  const tabs=page.getByRole('navigation',{name:'页面标签'});await expect(tabs.getByRole('link')).toHaveCount(1);await expect(page.getByLabel('记住标签',{exact:true})).not.toBeChecked();
  await navigate(page,'角色管理');await expect(page.locator('.list-filters').getByLabel('角色名称',{exact:true})).toHaveValue('');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('eforge.enterprise.page-tabs.v1.1')!).hrefs)).toEqual(['/role']);
});
test('completed cached table selection remains exact after hiding and restoring the page',async({page})=>{
  await setup(page);
  await page.route('**/api/v1/system/roles?*',route=>route.fulfill({json:{items:[{id:'2',name:'缓存角色',key:'cache-role',sort:1,status:'0'}],total:1,page:1,pageSize:10}}));
  await navigate(page,'角色管理');const selection=page.getByRole('checkbox',{name:'选择角色 缓存角色',exact:true});
  await selection.check();await expect(selection).toBeChecked();await navigate(page,'岗位管理');
  await page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
  await expect(selection).toBeChecked();
});
