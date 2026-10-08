import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
async function setup(page:Page) {
  const state={permissions:['app:dashboard:view','system:role:list'],queryText:'',cached:true,extraGroup:false,routeChild:false,userRoute:false,manyGroups:false};
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/logout',route=>route.fulfill({json:{code:200}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'1',username:'admin',displayName:'管理员'},roles:['admin'],permissions:state.permissions,navigation:[
    {key:'home',type:'ROUTE',routeId:'dashboard',label:'工作台',order:0,children:[]},
    {key:'system',type:'GROUP',label:'系统管理',order:1,children:[{key:'role',type:'ROUTE',routeId:'system-roles',label:'角色管理',icon:'peoples',queryText:state.queryText,cached:state.cached,order:0,children:state.routeChild?[{key:'post-child',type:'ROUTE',routeId:'system-posts',label:'岗位子页面',order:0,children:[]}]:[]},...(state.userRoute?[{key:'user-prefix',type:'ROUTE',routeId:'system-users',label:'用户管理',order:1,children:[]}]:[])]},
    {key:'external',type:'EXTERNAL',label:'文档 İabc (x) <img src=x onerror=alert(1)>',externalUrl:'https://example.com/docs',order:2,children:[]},
    ...(state.extraGroup?[{key:'tools',type:'GROUP',label:'工具菜单',order:4,children:[{key:'nested',type:'GROUP',label:'嵌套工具',order:0,children:[{key:'guide',type:'EXTERNAL',label:'使用指南',externalUrl:'https://example.com/guide',order:0,children:[]}]}]}]:[]),
    ...(state.manyGroups?Array.from({length:10},(_,index)=>({key:'extra-'+index,type:'GROUP',label:'扩展菜单'+index,order:10+index,children:[{key:'extra-link-'+index,type:'EXTERNAL',label:'帮助'+index,externalUrl:'https://example.com/guide'+index,order:0,children:[]}]})):[]),
    {key:'bad',type:'EXTERNAL',label:'非法链接',externalUrl:'javascript:alert(1)',order:3,children:[]} ]}}));
  await page.route('**/api/v1/system/roles?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.route('**/api/v1/system/roles/*/users?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('heading',{name:'你好，管理员'})).toBeVisible();return state;
}
test('layered title and path search, highlight, keyboard wrap, empty/clear, focus and mobile',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();const dialog=page.getByRole('dialog',{name:'导航搜索'}),input=dialog.getByRole('combobox',{name:'菜单搜索'});
  await expect(input).toBeFocused();await input.fill('角色管理');await expect(dialog.getByRole('option')).toHaveCount(1);await expect(dialog.locator('mark')).toHaveText('角色管理');
  await input.press('ArrowUp');await expect(dialog.getByRole('option')).toHaveAttribute('aria-selected','true');await input.press('ArrowDown');await input.press('Enter');
  await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  const crumbs=page.getByRole('navigation',{name:'面包屑'});await expect(crumbs).toContainText('系统管理');await expect(crumbs.getByRole('link',{name:'系统管理',exact:true})).toHaveCount(0);
  await crumbs.getByRole('link',{name:'面包屑：工作台'}).click();await expect(page.getByRole('heading',{name:'你好，管理员'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'导航搜索',exact:true}).click();await input.fill('/role');await expect(dialog.getByRole('option')).toHaveCount(1);
  await input.fill('no-such-page');await expect(dialog.getByRole('option')).toHaveCount(0);await expect(dialog).toContainText('未找到');await input.press('ArrowDown');await input.press('Enter');await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'清除搜索'}).click();await expect(input).toHaveValue('');await expect(dialog.getByRole('option')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await input.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'导航搜索',exact:true})).toBeFocused();await page.getByRole('button',{name:'导航搜索',exact:true}).click();await expect(dialog).toBeVisible();await page.mouse.click(5,5);await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'导航搜索',exact:true})).toBeFocused();expect(errors).toEqual([]);
});
test('parameter-page ancestry and revoked permission search do not create group routes',async({page})=>{
  const state=await setup(page);await page.goto('/role/users/9007199254740999');await expect(page.getByRole('heading',{name:'用户授权',exact:true})).toBeVisible();
  const crumbs=page.getByRole('navigation',{name:'面包屑'});await expect(crumbs).toContainText('系统管理');await expect(crumbs.getByRole('link',{name:'面包屑：角色管理'})).toHaveAttribute('href','/role');await expect(crumbs).toContainText('用户授权');
  state.permissions=['app:dashboard:view'];await page.reload();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();await expect(page.getByRole('navigation',{name:'面包屑'})).toHaveCount(0);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();const dialog=page.getByRole('dialog',{name:'导航搜索'});await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('角色');await expect(dialog.getByRole('option')).toHaveCount(0);
  await dialog.getByRole('button',{name:'关闭搜索'}).click();await page.getByRole('button',{name:'退出登录'}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(dialog).toHaveCount(0);
});
test('external results retain literal hostile labels, reject schemes and open without an opener',async({page,context})=>{
  await context.route('https://example.com/docs',route=>route.fulfill({contentType:'text/html',body:'<h1>Fixture documentation</h1>'}));await setup(page);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();const dialog=page.getByRole('dialog',{name:'导航搜索'});await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('abc');await expect(dialog.locator('mark')).toHaveText('abc');await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('(x)');await expect(dialog.locator('mark')).toHaveText('(x)');await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('文档');
  await expect(dialog.getByRole('option')).toHaveCount(1);await expect(dialog).toContainText('<img src=x onerror=alert(1)>');await expect(dialog.locator('img[src="x"]')).toHaveCount(0);
  const opened=page.waitForEvent('popup');await dialog.getByRole('button',{name:/^打开 文档/}).click();const popup=await opened;await expect(popup.getByRole('heading',{name:'Fixture documentation'})).toBeVisible();expect(await popup.evaluate(()=>window.opener)).toBeNull();expect(popup.url()).toBe('https://example.com/docs');await popup.close();await expect(dialog).toHaveCount(0);
});
test('menu query defaults reach links, search and parent breadcrumbs while malformed text stays inert',async({page})=>{
  const state=await setup(page);
  state.queryText='{"id":"9007199254740999","__proto__":"文字 &?/#","list":["a","b"],"bare":null}';state.cached=false;
  await page.reload();await expect(page.getByRole('heading',{name:'你好，管理员'})).toBeVisible();
  const href='/role?id=9007199254740999&__proto__=%E6%96%87%E5%AD%97%20%26%3F%2F%23&list=a&list=b&bare';
  const link=page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true});
  await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();await expect(link).toHaveAttribute('href',href);await link.click();await expect(page).toHaveURL(new RegExp('/role\\?id=9007199254740999&'));
  await expect(link).toHaveAttribute('aria-current','page');
  await page.goto('/role/users/2');await expect(page.getByRole('heading',{name:'用户授权',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'面包屑'}).getByRole('link',{name:'面包屑：角色管理'})).toHaveAttribute('href',href);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();const dialog=page.getByRole('dialog',{name:'导航搜索'});
  await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('角色');await dialog.getByRole('combobox',{name:'菜单搜索'}).press('ArrowDown');await dialog.getByRole('combobox',{name:'菜单搜索'}).press('Enter');
  await expect(page).toHaveURL(new URL(href,page.url()).href);
  state.queryText='<img src=x onerror=alert(1)>';await page.reload();await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'菜单参数配置有误'})).toBeVisible();
  await expect(page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();await dialog.getByRole('combobox',{name:'菜单搜索'}).fill('角色');
  await expect(dialog.getByRole('option')).toHaveCount(0);await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
test('sidebar groups disclose with keyboard, restore route ancestry and never navigate as routes',async({page})=>{
  await setup(page);const nav=page.locator('.ef-app-shell__nav');const group=nav.getByRole('button',{name:'系统管理',exact:true});
  await expect(group).toHaveAttribute('aria-expanded','false');await expect(nav.getByRole('link',{name:'角色管理',exact:true})).toBeHidden();
  await group.focus();await group.press('Enter');await expect(group).toHaveAttribute('aria-expanded','true');await expect(page).toHaveURL(/\/dashboard$/);
  await nav.getByRole('link',{name:'角色管理',exact:true}).click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  await page.reload();await expect(group).toHaveAttribute('aria-expanded','true');await group.click();await expect(nav.getByRole('link',{name:'角色管理',exact:true})).toBeHidden();
  await expect(page).toHaveURL(/\/role$/);await expect(nav.getByRole('link',{name:'系统管理',exact:true})).toHaveCount(0);
});
test('sidebar accordion isolates sibling levels and renders only allowlisted static icons',async({page})=>{
  const state=await setup(page);state.extraGroup=true;await page.reload();const nav=page.locator('.ef-app-shell__nav');
  const system=nav.getByRole('button',{name:'系统管理',exact:true}),tools=nav.getByRole('button',{name:'工具菜单',exact:true});
  await system.click();await expect(system).toHaveAttribute('aria-expanded','true');
  await tools.click();await expect(system).toHaveAttribute('aria-expanded','false');await expect(tools).toHaveAttribute('aria-expanded','true');
  const nested=nav.getByRole('button',{name:'嵌套工具',exact:true});await nested.focus();await nested.press('Space');
  await expect(nested).toHaveAttribute('aria-expanded','true');await expect(nav.getByRole('link',{name:'使用指南 在新窗口打开',exact:true})).toHaveAttribute('rel','noopener noreferrer');
  await system.click();await expect(tools).toHaveAttribute('aria-expanded','false');await expect(nav.getByRole('link',{name:'使用指南 在新窗口打开',exact:true})).toBeHidden();
  await expect(nav.locator('img')).toHaveAttribute('src','/ruoyi-icons/v3.9.2/peoples.svg');await expect(page).toHaveURL(/\/dashboard$/);
});
test('actual route parents retain their links and expose children with a separate disclosure',async({page})=>{
  const state=await setup(page);state.routeChild=true;state.permissions.push('system:post:list');await page.reload();const nav=page.locator('.ef-app-shell__nav');
  await nav.getByRole('button',{name:'系统管理',exact:true}).click();const role=nav.getByRole('link',{name:'角色管理',exact:true}),children=nav.getByRole('button',{name:'角色管理子菜单',exact:true});
  await expect(role).toHaveAttribute('href','/role');await expect(children).toHaveAttribute('aria-expanded','false');await children.click();
  await expect(nav.getByRole('link',{name:'岗位子页面',exact:true})).toHaveAttribute('href','/post');await expect(page).toHaveURL(/\/dashboard$/);
  await role.click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect(children).toHaveAttribute('aria-expanded','true');
  await children.click();await expect(nav.getByRole('link',{name:'岗位子页面',exact:true})).toBeHidden();await expect(role).toBeVisible();await expect(page).toHaveURL(/\/role$/);
});
test('mobile sidebar uses the original breakpoint, native focus trap and route/resize dismissal',async({page})=>{
  await page.setViewportSize({width:991,height:844});await setup(page);const opener=page.getByRole('button',{name:'打开菜单',exact:true});
  await expect(page.locator('.ef-app-shell__sidebar')).toBeHidden();await expect(page.getByRole('dialog',{name:'菜单',exact:true})).toHaveCount(0);
  await opener.click();const drawer=page.getByRole('dialog',{name:'菜单',exact:true});await expect(drawer).toBeVisible();await expect(page.locator('body')).toHaveCSS('overflow','hidden');
  await drawer.getByRole('button',{name:'系统管理',exact:true}).click();await drawer.getByRole('link',{name:'角色管理',exact:true}).click();
  await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect(drawer).toHaveCount(0);
  await opener.click();await drawer.getByRole('button',{name:'关闭菜单',exact:true}).focus();await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate(element=>element.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(opener).toBeFocused();await expect(page.locator('body')).toHaveCSS('overflow','visible');
  await opener.click();await page.mouse.click(980,700);await expect(drawer).toHaveCount(0);await expect(opener).toBeFocused();await expect(page.locator('body')).toHaveCSS('overflow','visible');
  await opener.click();await page.setViewportSize({width:992,height:844});await expect(drawer).toHaveCount(0);await expect(page.locator('.ef-app-shell__sidebar')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await expect(drawer).toHaveCount(0);await opener.click();await expect(drawer).toBeVisible();await expect(page.locator('body')).toHaveCSS('overflow','hidden');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('personal center does not borrow user-management ancestry from its URL prefix',async({page})=>{
  const state=await setup(page);state.userRoute=true;state.extraGroup=true;state.permissions.push('system:user:list');await page.reload();const nav=page.locator('.ef-app-shell__nav');
  const tools=nav.getByRole('button',{name:'工具菜单',exact:true}),system=nav.getByRole('button',{name:'系统管理',exact:true});
  await tools.click();await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
  await expect(tools).toHaveAttribute('aria-expanded','true');await expect(system).toHaveAttribute('aria-expanded','false');
});
test('desktop collapse retains popup navigation, keyboard dismissal, preference and page draft',async({page})=>{
  await setup(page);const sidebar=page.locator('.ef-app-shell__sidebar');await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(200);
  await page.getByRole('button',{name:'收起菜单',exact:true}).click();await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(54);
  const group=sidebar.getByRole('button',{name:'系统管理',exact:true}),role=sidebar.getByRole('link',{name:'角色管理',exact:true});
  await expect(group).toHaveAttribute('aria-expanded','false');await group.hover();await expect(role).toBeVisible();await group.focus();await group.press('Escape');await expect(role).toBeHidden();await expect(group).toBeFocused();
  await group.press('Enter');await expect(role).toBeVisible();await role.click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect(role).toBeHidden();
  await page.reload();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(54);
  await page.getByLabel('角色名称筛选',{exact:true}).fill('折叠草稿');await page.getByRole('button',{name:'展开菜单',exact:true}).click();await expect(role).toBeVisible();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('折叠草稿');
  await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(200);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('collapsed popup stays within the viewport, closes outside and preserves preference across mobile mode',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'收起菜单',exact:true}).click();const sidebar=page.locator('.ef-app-shell__sidebar'),group=sidebar.getByRole('button',{name:'系统管理',exact:true});
  await page.setViewportSize({width:1100,height:300});await group.hover();const popup=sidebar.locator('.navigation-popup:visible');await expect(popup).toBeVisible();
  const bounds=(await popup.boundingBox())!;expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(300);expect(bounds.x+bounds.width).toBeLessThanOrEqual(1100);
  await page.getByRole('heading',{name:'你好，管理员'}).click();await expect(popup).toHaveCount(0);
  await page.setViewportSize({width:991,height:844});await page.getByRole('button',{name:'打开菜单',exact:true}).click();const drawer=page.getByRole('dialog',{name:'菜单',exact:true});
  await drawer.getByRole('button',{name:'系统管理',exact:true}).click();await drawer.getByRole('link',{name:'角色管理',exact:true}).click();await expect(drawer).toHaveCount(0);await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  await page.setViewportSize({width:992,height:844});await expect.poll(async()=>Math.round((await sidebar.boundingBox())!.width)).toBe(54);await expect(page.getByRole('button',{name:'展开菜单',exact:true})).toBeVisible();await expect(popup).toHaveCount(0);
});

test('mixed navigation selects groups without routes, retains drafts and restores real child ancestry',async({page})=>{
  const state=await setup(page);state.extraGroup=true;await page.reload();
  await page.getByRole('button',{name:'布局设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'布局设置',exact:true});
  await settings.getByLabel('混合菜单',{exact:true}).check();await settings.getByRole('button',{name:'保存配置',exact:true}).click();await expect(settings.getByRole('status')).toHaveText('布局已保存');await settings.getByRole('button',{name:'关闭设置',exact:true}).click();
  const top=page.getByRole('navigation',{name:'顶部菜单',exact:true}),side=page.locator('.ef-app-shell__nav');
  await expect(page.locator('.ef-app-shell__sidebar')).toBeHidden();await top.getByRole('button',{name:'系统管理',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('.ef-app-shell__sidebar')).toBeVisible();await expect(side.getByRole('button',{name:'系统管理',exact:true})).toHaveCount(0);
  await side.getByRole('link',{name:'角色管理',exact:true}).click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await page.getByLabel('角色名称筛选',{exact:true}).fill('布局草稿');
  const tools=top.getByRole('button',{name:'工具菜单',exact:true});if(!await tools.isVisible())await top.getByRole('button',{name:'更多菜单',exact:true}).click();await tools.click();await expect(side.getByRole('button',{name:'嵌套工具',exact:true})).toBeVisible();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('布局草稿');
  await page.goto('/role/users/2');await expect(page.getByRole('heading',{name:'用户授权',exact:true})).toBeVisible();await expect(top.getByRole('button',{name:'系统管理',exact:true})).toHaveAttribute('aria-pressed','true');await expect(side.getByRole('link',{name:'角色管理',exact:true})).toBeVisible();
  state.permissions=['app:dashboard:view'];await page.reload();await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();await expect(top.getByRole('button',{name:'系统管理',exact:true})).toHaveCount(0);await expect(side.getByRole('link',{name:'角色管理',exact:true})).toHaveCount(0);
});

test('pure top navigation keeps overflow groups reachable, keyboard escape and mobile fallback',async({page})=>{
  const state=await setup(page);state.manyGroups=true;await page.reload();await page.setViewportSize({width:1100,height:844});
  await page.getByRole('button',{name:'布局设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'布局设置',exact:true});await settings.getByLabel('顶部菜单',{exact:true}).check();await settings.getByRole('button',{name:'保存配置',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();
  const top=page.getByRole('navigation',{name:'顶部菜单',exact:true});await expect(page.locator('.ef-app-shell__sidebar')).toBeHidden();
  const more=top.getByRole('button',{name:'更多菜单',exact:true});await more.click();const overflow=top.locator('.top-navigation-overflow');await expect(overflow).toBeVisible();
  await overflow.getByRole('button',{name:'扩展菜单9',exact:true}).focus();await overflow.getByRole('button',{name:'扩展菜单9',exact:true}).press('Enter');await expect(overflow.getByRole('link',{name:'帮助9 在新窗口打开',exact:true})).toHaveAttribute('rel','noopener noreferrer');
  await page.keyboard.press('Escape');await expect(overflow.getByRole('button',{name:'扩展菜单9',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(overflow).toBeHidden();await expect(more).toBeFocused();
  await top.getByRole('button',{name:'系统管理',exact:true}).focus();await top.getByRole('button',{name:'系统管理',exact:true}).press('Enter');await top.getByRole('link',{name:'角色管理',exact:true}).click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  await page.reload();await expect(top).toBeVisible();await expect(page.locator('.ef-app-shell__sidebar')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await more.click();const bounds=(await overflow.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(1100);await page.getByRole('heading',{name:'角色管理',exact:true}).click();await expect(overflow).toBeHidden();
  await page.setViewportSize({width:390,height:844});await expect(top).toHaveCount(0);await page.getByRole('button',{name:'打开菜单',exact:true}).click();const drawer=page.getByRole('dialog',{name:'菜单',exact:true});await expect(drawer.getByRole('button',{name:'扩展菜单9',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.setViewportSize({width:1100,height:844});await expect(top).toBeVisible();await page.getByRole('button',{name:'布局设置',exact:true}).click();await settings.getByRole('button',{name:'恢复默认',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(top).toHaveCount(0);await expect(page.locator('.ef-app-shell__sidebar')).toBeVisible();
});

test('layout settings preview actual visuals and preserve drafts, save and restore safely',async({page})=>{
  await setup(page);await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();await page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true}).click();await page.getByLabel('角色名称筛选',{exact:true}).fill('设置草稿');
  await page.getByRole('button',{name:'布局设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'布局设置',exact:true});
  await settings.getByLabel('侧栏风格',{exact:true}).selectOption('light');await expect(page.locator('.ef-app-shell__sidebar')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await settings.getByLabel('主题颜色',{exact:true}).evaluate(node=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,'#883399');node.dispatchEvent(new Event('input',{bubbles:true}));});
  await settings.getByLabel('界面尺寸',{exact:true}).selectOption('mini');await settings.getByLabel('固定头部',{exact:true}).check();await settings.getByLabel('动态标题',{exact:true}).check();await expect(page).toHaveTitle('角色管理 - EForge Enterprise');
  await settings.getByLabel('显示 Logo',{exact:true}).uncheck();await expect(page.locator('.ef-app-shell__brand')).toBeHidden();await settings.getByLabel('显示页签图标',{exact:true}).uncheck();await expect(page.getByRole('navigation',{name:'页面标签'}).locator('.menu-icon')).toHaveCount(0);
  await settings.getByLabel('显示页面标签',{exact:true}).uncheck();await expect(page.getByRole('navigation',{name:'页面标签'})).toBeHidden();
  await settings.getByLabel('显示页脚',{exact:true}).check();await settings.getByLabel('页脚内容',{exact:true}).fill('<img src=x onerror=alert(1)> 自定义版权');await expect(page.locator('.enterprise-footer')).toHaveText('<img src=x onerror=alert(1)> 自定义版权');await expect(page.locator('.enterprise-footer img')).toHaveCount(0);
  await settings.getByRole('button',{name:'保存配置',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('设置草稿');await expect(page.locator('.enterprise-layout')).toHaveAttribute('data-density','mini');await expect(page.locator('.ef-app-shell__header')).toHaveCSS('position','sticky');
  await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveCSS('font-size','12px');await expect(page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true})).toHaveCSS('border-left-color','rgb(136, 51, 153)');await expect(page.locator('.enterprise-layout')).toHaveCSS('--ef-color-accent','#883399');await page.reload();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect(page.locator('.enterprise-layout')).toHaveAttribute('data-side-theme','light');await expect(page.getByRole('navigation',{name:'页面标签'})).toBeHidden();await expect(page).toHaveTitle('角色管理 - EForge Enterprise');
  await page.getByRole('button',{name:'布局设置',exact:true}).click();await settings.getByRole('button',{name:'恢复默认',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.getByRole('navigation',{name:'页面标签'})).toBeVisible();await expect(page.locator('.ef-app-shell__brand')).toBeVisible();await expect(page.locator('.enterprise-footer')).toHaveCount(0);await expect(page).toHaveTitle('EForge Enterprise');
});

test('malformed or hostile saved settings cannot become CSS or markup and unavailable storage stays usable',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('eforge.enterprise.layout.v1',JSON.stringify({theme:'url(javascript:alert(1))',density:'url(x)',sideTheme:'<img src=x>',navMode:'arbitrary',tagsView:'false',footerContent:3,__proto__:{dynamicTitle:true}})));
  await setup(page);await expect(page.locator('.enterprise-layout')).toHaveAttribute('data-density','default');await expect(page.locator('.enterprise-layout')).toHaveAttribute('data-side-theme','dark');await expect(page.locator('.enterprise-layout')).toHaveCSS('--ef-color-accent','#2468f2');await expect(page.getByRole('navigation',{name:'页面标签'})).toBeVisible();await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await page.getByRole('button',{name:'布局设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'布局设置',exact:true});await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Unavailable','SecurityError');};});await settings.getByLabel('侧栏风格',{exact:true}).selectOption('light');await settings.getByRole('button',{name:'保存配置',exact:true}).click();await expect(settings.getByRole('status')).toContainText('无法保存布局');await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.getByRole('button',{name:'布局设置',exact:true})).toBeFocused();await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();await page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true}).click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
});
test('settings and per-user remembered tabs stay synchronized and resetting clears only owned persistence',async({page})=>{
  await setup(page);await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();await page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true}).click();
  await page.evaluate(()=>localStorage.setItem('eforge.enterprise.page-tabs.v1.99','unrelated-user-record'));
  await page.getByRole('button',{name:'布局设置',exact:true}).click();const settings=page.getByRole('dialog',{name:'布局设置',exact:true});await settings.getByLabel('持久化标签页',{exact:true}).check();await settings.getByRole('button',{name:'保存配置',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.getByLabel('记住标签',{exact:true})).toBeChecked();
  await page.locator('.ef-app-shell__nav').getByRole('link',{name:'工作台',exact:true}).click();await page.reload();await expect(page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true})).toBeVisible();
  await page.getByLabel('记住标签',{exact:true}).uncheck();await page.getByRole('button',{name:'布局设置',exact:true}).click();await expect(settings.getByLabel('持久化标签页',{exact:true})).not.toBeChecked();await settings.getByLabel('显示页面标签',{exact:true}).uncheck();await expect(settings.getByLabel('持久化标签页',{exact:true})).toBeDisabled();await expect(settings.getByLabel('显示页签图标',{exact:true})).toBeDisabled();
  await settings.getByRole('button',{name:'恢复默认',exact:true}).click();await settings.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.getByLabel('记住标签',{exact:true})).not.toBeChecked();expect(await page.evaluate(()=>localStorage.getItem('eforge.enterprise.page-tabs.v1.1'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('eforge.enterprise.page-tabs.v1.99'))).toBe('unrelated-user-record');
});
test('header utilities use actual browser fullscreen, safe links and persistent density without discarding drafts',async({page})=>{
  await setup(page);await page.locator('.ef-app-shell__nav').getByRole('button',{name:'系统管理',exact:true}).click();await page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true}).click();await page.getByLabel('角色名称筛选',{exact:true}).fill('工具草稿');
  await page.getByRole('button',{name:'进入屏幕全屏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===document.documentElement)).toBe(true);await page.getByRole('button',{name:'退出屏幕全屏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await page.locator('.header-utilities').getByLabel('界面尺寸',{exact:true}).selectOption('small');await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveCSS('font-size','13px');await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('工具草稿');await page.reload();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await expect(page.locator('.header-utilities').getByLabel('界面尺寸',{exact:true})).toHaveValue('small');
  await expect(page.getByRole('link',{name:'源码仓库 在新窗口打开',exact:true})).toHaveAttribute('rel','noopener noreferrer');await expect(page.getByRole('link',{name:'若依参考文档 在新窗口打开',exact:true})).toHaveAttribute('href','https://doc.ruoyi.vip/');
  await page.getByRole('button',{name:'进入屏幕全屏',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement!==null)).toBe(true);await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
});
test('mobile notice popup stays below the real header and never blocks navigation search',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);await page.getByRole('button',{name:'通知公告（0 条未读）',exact:true}).hover();const panel=page.locator('.notice-popover');await expect(panel).toBeVisible();const header=(await page.locator('.ef-app-shell__header').boundingBox())!,bounds=(await panel.boundingBox())!;expect(bounds.y).toBeGreaterThanOrEqual(header.y+header.height+6);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();await expect(page.getByRole('dialog',{name:'导航搜索'})).toBeVisible();await page.getByRole('dialog',{name:'导航搜索'}).getByRole('combobox',{name:'菜单搜索'}).fill('角色');await expect(page.getByRole('dialog',{name:'导航搜索'}).getByRole('option')).toHaveCount(1);
});