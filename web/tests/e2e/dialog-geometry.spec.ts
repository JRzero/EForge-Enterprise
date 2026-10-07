import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';

async function editor(page:Page,retainedHeading=false){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'dialog-fixture',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'1',username:'editor',displayName:'编辑'},roles:[],permissions:['system:post:list','system:post:add'],navigation:[{key:'posts',type:'ROUTE',routeId:'system-posts',label:'岗位管理',order:0,children:[]}]}}));
  await page.route('**/api/v1/system/posts?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.goto('/post');await page.getByLabel('账号',{exact:true}).fill('editor');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
  if(retainedHeading)await page.evaluate(()=>{const heading=document.createElement('h2');heading.id='post-editor-title';heading.textContent='另一个保留页的编辑器';heading.hidden=true;document.body.prepend(heading);});
  await page.getByRole('button',{name:'新增岗位',exact:true}).click();
  return page.getByRole('dialog',{name:'新增岗位',exact:true});
}
test('actual editor title drag and width/corner resize retain field drafts and reachable viewport bounds',async({page})=>{
  const dialog=await editor(page,true);await dialog.getByLabel('岗位名称',{exact:true}).fill('保留草稿');
  const before=(await dialog.boundingBox())!;const title=(await dialog.getByRole('heading',{name:'新增岗位'}).boundingBox())!;
  await page.mouse.move(title.x+30,title.y+10);await page.mouse.down();await page.mouse.move(title.x+90,title.y+45);await page.mouse.up();
  await expect.poll(async()=>Math.round((await dialog.boundingBox())!.x-before.x)).toBe(60);
  const width=dialog.getByRole('button',{name:'调整弹窗宽度',exact:true});await width.focus();const moved=(await dialog.boundingBox())!;await page.keyboard.press('ArrowRight');await expect.poll(async()=>Math.round((await dialog.boundingBox())!.width-moved.width)).toBe(10);
  const corner=dialog.getByRole('button',{name:'调整弹窗大小',exact:true});const grip=(await corner.boundingBox())!;const sized=(await dialog.boundingBox())!;await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+25,grip.y+grip.height/2+20);await page.mouse.up();await expect.poll(async()=>Math.round((await dialog.boundingBox())!.width-sized.width)).toBe(25);
  await page.setViewportSize({width:390,height:600});await expect.poll(async()=>{const box=(await dialog.boundingBox())!;return box.x>=15 && box.y>=15 && box.x+box.width<=375 && box.y+box.height<=585;}).toBe(true);
  await expect(dialog.getByLabel('岗位名称',{exact:true})).toHaveValue('保留草稿');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'新增岗位',exact:true})).toBeFocused();
});
test('keyboard movement resets geometry and an owned pending save disables geometry and cancellation',async({page})=>{
  const dialog=await editor(page);const initial=(await dialog.boundingBox())!;const move=dialog.getByRole('button',{name:'移动弹窗',exact:true});await move.focus();await page.keyboard.press('Shift+ArrowLeft');await expect.poll(async()=>Math.round((await dialog.boundingBox())!.x-initial.x)).toBe(-50);await page.keyboard.press('Home');await expect.poll(async()=>Math.round((await dialog.boundingBox())!.x-initial.x)).toBe(0);
  await dialog.getByLabel('岗位名称',{exact:true}).fill('待提交');await dialog.getByLabel('岗位编码',{exact:true}).fill('pending');let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('**/api/v1/system/posts',async route=>{await gate;await route.fulfill({status:503,json:{code:'SERVICE_UNAVAILABLE'}});});const pending=page.waitForRequest(request=>request.method()==='POST' && new URL(request.url()).pathname==='/api/v1/system/posts');await dialog.getByRole('button',{name:'保存岗位'}).click();await pending;
  try{await expect(move).toBeDisabled();await expect(dialog.getByRole('button',{name:'调整弹窗大小'})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();}finally{release();}
  await expect(dialog.getByRole('alert')).toBeVisible();await expect(move).toBeEnabled();await expect(dialog.getByLabel('岗位名称',{exact:true})).toHaveValue('待提交');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
