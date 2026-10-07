import type {MenuResponse,MenuWriteRequest,NavigationNode} from '../../generated/api';
import {test,expect} from '@playwright/test';
test('real bootstrap navigation search and internal breadcrumb preserve authorization and logout',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('admin123');await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
  await page.getByRole('button',{name:'导航搜索',exact:true}).click();const dialog=page.getByRole('dialog',{name:'导航搜索'}),input=dialog.getByRole('combobox',{name:'菜单搜索'});await expect(input).toBeFocused();await input.fill('/role');
  await expect(dialog.getByRole('option')).toHaveCount(1);await input.press('ArrowDown');await input.press('Enter');await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  await page.goto('/role/users/2');await expect(page.getByRole('heading',{name:'用户授权',exact:true})).toBeVisible();const crumbs=page.getByRole('navigation',{name:'面包屑'});await expect(crumbs.getByRole('link',{name:'面包屑：角色管理'})).toHaveAttribute('href','/role');await expect(crumbs).toContainText('用户授权');await crumbs.getByRole('link',{name:'面包屑：角色管理'}).click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'导航搜索',exact:true}).click();await input.fill('no-such-page');await expect(dialog.getByRole('option')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await input.press('Escape');await expect(page.getByRole('button',{name:'导航搜索',exact:true})).toBeFocused();await page.getByRole('button',{name:'导航搜索',exact:true}).click();await expect(dialog).toBeVisible();await page.mouse.click(5,5);await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'导航搜索',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'退出登录'}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);expect(errors).toEqual([]);
});
test('real SQL menu defaults preserve exact query links, active state, search and internal parent breadcrumbs',async({page})=>{
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('admin123');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
  const auth={Authorization:'Bearer '+token};
  const listResponse=await page.request.get('/api/v1/system/menus',{headers:auth});expect(listResponse.status()).toBe(200);
  const menus=await listResponse.json() as MenuResponse[],menu=menus.find(row=>row.key==='system-roles')!;
  expect(menu).toBeTruthy();
  const original:MenuWriteRequest={key:menu.key!,name:menu.name,parentId:menu.parentId,sort:menu.sort,type:menu.type,status:menu.status,visible:menu.visible,
    routeId:menu.routeId,externalUrl:menu.externalUrl,permission:menu.permission,icon:menu.icon,remark:menu.remark,groupPath:menu.groupPath,queryText:menu.queryText,cached:menu.cached};
  const queryText='{"id":"9007199254740999","__proto__":"文字 &?/#","list":["a","b"],"bare":null}';
  const href='/role?id=9007199254740999&__proto__=%E6%96%87%E5%AD%97%20%26%3F%2F%23&list=a&list=b&bare';
  function find(nodes:NavigationNode[]):NavigationNode|undefined {for(const node of nodes){if(node.key==='system-roles')return node;const child=find(node.children);if(child)return child;}}
  try{
    expect((await page.request.put('/api/v1/system/menus/'+menu.id,{headers:auth,data:{...original,queryText,cached:false}})).status()).toBe(204);
    const bootstrap=await page.request.get('/api/v1/app/bootstrap',{headers:auth});expect(bootstrap.status()).toBe(200);
    expect(find((await bootstrap.json()).navigation)).toMatchObject({queryText,cached:false,type:'ROUTE'});
    await page.reload();await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
    const link=page.locator('.ef-app-shell__nav').getByRole('link',{name:'角色管理',exact:true});
    await expect(link).toHaveAttribute('href',href);await link.click();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
    expect(new URL(page.url()).search).toBe(href.slice('/role'.length));await expect(link).toHaveAttribute('aria-current','page');
    await page.goto('/role/users/2');await expect(page.getByRole('heading',{name:'用户授权',exact:true})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'面包屑'}).getByRole('link',{name:'面包屑：角色管理'})).toHaveAttribute('href',href);
    await page.getByRole('button',{name:'导航搜索',exact:true}).click();const input=page.getByRole('dialog',{name:'导航搜索'}).getByRole('combobox',{name:'菜单搜索'});
    await input.fill('角色管理');await expect(page.getByRole('dialog',{name:'导航搜索'}).getByRole('option')).toHaveCount(1);await input.press('ArrowDown');await input.press('Enter');
    await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();expect(new URL(page.url()).search).toBe(href.slice('/role'.length));
  }finally{expect((await page.request.put('/api/v1/system/menus/'+menu.id,{headers:auth,data:original})).status()).toBe(204);}
  await page.getByRole('button',{name:'退出登录'}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();
});