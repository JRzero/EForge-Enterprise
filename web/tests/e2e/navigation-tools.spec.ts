import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
async function setup(page:Page) {
  const state={permissions:['app:dashboard:view','system:role:list'],queryText:'',cached:true,extraGroup:false,routeChild:false};
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/logout',route=>route.fulfill({json:{code:200}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'1',username:'admin',displayName:'管理员'},roles:['admin'],permissions:state.permissions,navigation:[
    {key:'home',type:'ROUTE',routeId:'dashboard',label:'工作台',order:0,children:[]},
    {key:'system',type:'GROUP',label:'系统管理',order:1,children:[{key:'role',type:'ROUTE',routeId:'system-roles',label:'角色管理',icon:'peoples',queryText:state.queryText,cached:state.cached,order:0,children:state.routeChild?[{key:'post-child',type:'ROUTE',routeId:'system-posts',label:'岗位子页面',order:0,children:[]}]:[]}]},
    {key:'external',type:'EXTERNAL',label:'文档 İabc (x) <img src=x onerror=alert(1)>',externalUrl:'https://example.com/docs',order:2,children:[]},
    ...(state.extraGroup?[{key:'tools',type:'GROUP',label:'工具菜单',order:4,children:[{key:'nested',type:'GROUP',label:'嵌套工具',order:0,children:[{key:'guide',type:'EXTERNAL',label:'使用指南',externalUrl:'https://example.com/guide',order:0,children:[]}]}]}]:[]),
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