import {test,expect,type Page} from '@playwright/test';
import type {MenuResponse,MenuWriteRequest,RoleResponse} from '../../generated/api';
async function login(page:Page,username='admin',password='admin123'){
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
}
async function headers(page:Page){const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);return {Authorization:'Bearer '+token};}
async function navigate(page:Page,name:string){await page.locator('.ef-app-shell__nav').getByRole('link',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
test('actual SQL cache preference controls resource drafts, refresh, retained tabs and logout',async({page})=>{
  await login(page);const auth=await headers(page),menus=await (await page.request.get('/api/v1/system/menus',{headers:auth})).json() as MenuResponse[];
  const menu=menus.find(item=>item.key==='system-roles')!;
  const original:MenuWriteRequest={key:menu.key!,name:menu.name,parentId:menu.parentId,sort:menu.sort,type:menu.type,status:menu.status,visible:menu.visible,
    routeId:menu.routeId,externalUrl:menu.externalUrl,permission:menu.permission,icon:menu.icon,remark:menu.remark,groupPath:menu.groupPath,queryText:menu.queryText,cached:menu.cached};
  try{
    expect((await page.request.put('/api/v1/system/menus/'+menu.id,{headers:auth,data:{...original,cached:true}})).status()).toBe(204);
    await page.reload();await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();
    await navigate(page,'角色管理');await page.getByLabel('角色名称筛选',{exact:true}).fill('实际缓存草稿');
    await navigate(page,'岗位管理');const tabs=page.getByRole('navigation',{name:'页面标签'});
    await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).click();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('实际缓存草稿');
    await tabs.getByRole('button',{name:'刷新当前页面'}).click();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('');
    await page.getByLabel('记住标签',{exact:true}).check();await page.reload();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();
    await expect(tabs.getByRole('link')).toHaveCount(3);await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('');
    expect((await page.request.put('/api/v1/system/menus/'+menu.id,{headers:auth,data:{...original,cached:false}})).status()).toBe(204);
    await page.reload();await expect(page.getByRole('heading',{name:'角色管理',exact:true})).toBeVisible();await page.getByLabel('角色名称筛选',{exact:true}).fill('实际不缓存草稿');
    await navigate(page,'岗位管理');await tabs.getByRole('link',{name:'页面标签：角色管理',exact:true}).click();await expect(page.getByLabel('角色名称筛选',{exact:true})).toHaveValue('');
    await tabs.getByRole('link',{name:'页面标签：岗位管理',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'关闭其他'}).click();await expect(tabs.getByRole('link')).toHaveCount(2);
    await tabs.getByRole('button',{name:'标签操作'}).click();await page.getByRole('menuitem',{name:'全部关闭'}).click();
    await expect(page.getByRole('heading',{name:/^你好，/})).toBeVisible();await expect(tabs.getByRole('link')).toHaveCount(1);
  }finally{expect((await page.request.put('/api/v1/system/menus/'+menu.id,{headers:auth,data:original})).status()).toBe(204);}
  await page.getByRole('button',{name:'退出登录'}).click();await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(page.locator('[data-page-path]')).toHaveCount(0);
});
test('actual menu grant withdrawal and bootstrap refresh evict cached data without a document reload',async({page})=>{
  test.setTimeout(90000);await login(page);const auth=await headers(page),stamp=String(Date.now());
  const menus=await (await page.request.get('/api/v1/system/menus',{headers:auth})).json() as MenuResponse[];
  const permissions=['app:dashboard:view','system:role:list','system:post:list'];
  const keys=menus.filter(item=>item.type==='GROUP' || permissions.includes(item.permission ?? '')).map(item=>item.key!);
  const roleBody={name:'标签权限'+stamp,key:'tabs-role-'+stamp,sort:1,status:'0',menuLinked:false,menuKeys:keys};
  const roleReply=await page.request.post('/api/v1/system/roles',{headers:auth,data:roleBody});expect(roleReply.status()).toBe(201);
  const role=await roleReply.json() as RoleResponse;let userId:string|undefined;

  try{
    const username='t'+stamp,userReply=await page.request.post('/api/v1/system/users',{headers:auth,data:{user:{username,displayName:'标签验证账号',departmentId:'103',sex:'2',status:'0',roleIds:[role.id],postIds:[]},password:'Browser123'}});
    expect(userReply.status()).toBe(201);userId=(await userReply.json()).id;
    await page.evaluate(()=>sessionStorage.removeItem('eforge.enterprise.session.v1'));const member=page;await test.step('Sign in as the owned member account',async()=>{await login(member,username,'Browser123');});const memberAuth=await headers(member);
    await navigate(member,'角色管理');await member.getByLabel('角色名称筛选',{exact:true}).fill('真实旧授权草稿');await navigate(member,'岗位管理');
    await member.getByLabel('岗位名称筛选',{exact:true}).fill('真实另一页草稿');
    const revokedKeys=keys.filter(key=>!menus.some(item=>item.key===key && item.permission==='system:role:list'));
    expect((await page.request.put('/api/v1/system/roles/'+role.id,{headers:auth,data:{...roleBody,menuKeys:revokedKeys}})).status()).toBe(204);
    expect((await member.request.get('/api/v1/system/roles?page=1&pageSize=10',{headers:memberAuth})).status()).toBe(403);
    await member.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true}).click();
    await member.getByRole('button',{name:'刷新列表',exact:true}).click();await expect(member.getByRole('alert').filter({hasText:'权限'})).toBeVisible();
    // Role editor options themselves require the withdrawn list grant. Use an
    // independently authorized self-profile write to trigger real bootstrap refresh.
    await member.getByRole('link',{name:'个人中心',exact:true}).click();
    await expect(member.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await member.getByLabel('用户昵称',{exact:true}).fill('刷新标签账号');await member.getByLabel('手机号码',{exact:true}).fill('13900000009');
    await member.getByLabel('邮箱',{exact:true}).fill(username+'@example.com');
    const saved=member.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/me' && response.request().method()==='PUT',{timeout:10000});
    const refreshed=member.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/app/bootstrap' && response.status()===200,{timeout:10000});
    await member.getByRole('button',{name:'保存资料',exact:true}).click();expect((await saved).status()).toBe(204);
    const bootstrap=await (await refreshed).json();expect(bootstrap.permissions).not.toContain('system:role:list');
    await expect(member.locator('[data-page-path="/role"]')).toHaveCount(0);
    await expect(member.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：角色管理',exact:true})).toHaveCount(0);
    await navigate(member,'岗位管理');await expect(member.getByLabel('岗位名称筛选',{exact:true})).toHaveValue('');
    await member.getByRole('button',{name:'退出登录'}).click();await expect(member.getByRole('heading',{name:'登录工作空间'})).toBeVisible();
  }finally{
    if(userId)expect((await page.request.delete('/api/v1/system/users',{headers:auth,data:{ids:[userId]}})).status()).toBe(204);
    expect((await page.request.delete('/api/v1/system/roles',{headers:auth,data:{ids:[role.id]}})).status()).toBe(204);
  }
});
