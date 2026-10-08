import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const contracts=JSON.parse(readFileSync(new URL('../../app/route-contract.json',import.meta.url),'utf8')) as {path:string;id:string}[];

test.beforeEach(async({page})=>{
  await page.addInitScript(token=>{
    sessionStorage.setItem('eforge.enterprise.session.v1',JSON.stringify({accessToken:token}));
    // Audit the new default and retain the user's existing browser preferences.
    localStorage.removeItem('eforge.enterprise.layout.v1');
  },process.env.EFORGE_VISUAL_TOKEN!);
});

for (const mode of ['左侧菜单','混合菜单','顶部菜单'] as const) test(`read-only shell audit ${mode}`,async({page},info)=>{
  await page.goto('/post');
  await expect(page.locator('.enterprise-header')).toBeVisible();
  await page.getByRole('button',{name:'布局设置',exact:true}).click();
  const dialog=page.getByRole('dialog').last();
  await dialog.getByRole('radio',{name:mode,exact:true}).check();
  await page.screenshot({path:info.outputPath('settings.png'),fullPage:true});
  await dialog.getByRole('button',{name:'关闭设置',exact:true}).click();
  await expect(page.getByRole('heading',{name:'岗位管理',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('desktop.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('read-only Cron tabs audit',async({page},info)=>{
  await page.goto('/job');
  await page.getByRole('button',{name:'Cron表达式编辑',exact:true}).click();
  const dialog=page.getByRole('dialog').last();
  await expect(dialog.getByLabel('执行时间预览',{exact:true})).toBeVisible();
  for(const field of ['秒','分钟','小时','日','月','周','年']) {
    await dialog.getByRole('tab',{name:field,exact:true}).click();
    await page.screenshot({path:info.outputPath(`field-${field}.png`),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
const pages=[...contracts.map(route=>({path:route.path,name:route.id})),
  {path:'/user/profile',name:'profile'}, {path:'/job/log/0',name:'job-logs'},
  {path:'/role/users/2',name:'role-users'}, {path:'/dict/data/1',name:'dictionary-data'}];
for(const item of pages) test(`read-only visual audit ${item.name}`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(item.path);
  await expect(page.locator('.enterprise-header')).toBeVisible();
  const reminder=page.getByRole('alertdialog',{name:'安全提示'});
  if(await reminder.isVisible())await reminder.getByRole('button',{name:'取消',exact:true}).click();
  const content=page.locator(`[data-page-path="${item.path}"]`);
  await expect(content.locator('h1').first()).toBeVisible();
  await expect(content.getByText(/正在加载|Loading data/)).toHaveCount(0,{timeout:30_000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'打开菜单',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});
  expect(errors).toEqual([]);
});

for(const [path,action,name] of [
  ['/user','新增用户','user-form'],['/role','新增角色','role-form'],
  ['/dept','新增部门','department-form'],['/post','新增岗位','post-form'],
  ['/menu','新增菜单','menu-form'],['/dict','新增字典类型','dictionary-form'],
  ['/config','新增参数','configuration-form'],['/notice','新增公告','notice-editor'],
  ['/job','新增任务','job-form'],['/gen','导入表','generator-import'],
  ['/gen','创建表','generator-create'],['/user/profile','修改头像','avatar-editor']
] as const)test(`read-only component audit ${name}`,async({page},info)=>{
  await page.goto(path);await expect(page.locator('.enterprise-header')).toBeVisible();
  const reminder=page.getByRole('alertdialog',{name:'安全提示'});if(await reminder.isVisible())await reminder.getByRole('button',{name:'取消',exact:true}).click();
  await page.getByRole('button',{name:action,exact:true}).click();
  const dialog=page.getByRole('dialog').last();await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/正在加载|Loading data/)).toHaveCount(0,{timeout:30_000});
  await page.screenshot({path:info.outputPath('desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const box=await dialog.boundingBox();expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(391);
  await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});
});
