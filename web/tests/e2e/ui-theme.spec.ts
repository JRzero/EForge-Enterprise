import {test, expect} from './fixtures';

test('reference theme keeps lists and dialogs operable at desktop and mobile widths', async ({page}, testInfo) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/system/dictionaries/lookup/sys_normal_disable', route => route.fulfill({json:[{value:'0',label:'正常',style:'PRIMARY',defaultEntry:true},{value:'1',label:'停用',style:'DANGER',defaultEntry:false}]}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json:{
    user:{id:'2',username:'designer',displayName:'界面验收'},roles:[],permissions:['system:post:list','system:post:add','system:post:edit','system:post:export'],
    navigation:[{key:'system',type:'GROUP',label:'系统管理',order:0,children:[{key:'posts',type:'ROUTE',routeId:'system-posts',label:'岗位管理',order:0,children:[]}]}]
  }}));
  await page.route('**/api/v1/system/posts?*', route => route.fulfill({json:{items:[
    {id:'1',code:'ceo',name:'董事长',sort:1,status:'0'},
    {id:'2',code:'project',name:'项目经理',sort:2,status:'0'},
    {id:'3',code:'developer',name:'研发工程师',sort:3,status:'0'}
  ],total:3,page:1,pageSize:10}}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/post');
  await page.getByLabel('账号',{exact:true}).fill('designer');
  const username=page.getByLabel('账号',{exact:true});
  await username.focus();
  expect(await username.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
  expect(await username.evaluate(element=>getComputedStyle(element.parentElement!).paddingLeft)).toBe('12px');
  await page.screenshot({path:testInfo.outputPath('input-focus.png'),fullPage:true});
  await page.getByLabel('密码',{exact:true}).fill('fixture');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('cell',{name:'研发工程师',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'查询',exact:true})).toBeVisible();
  await expect(page.locator('.enterprise-layout')).toHaveAttribute('data-side-theme','light');
  const selected = page.locator('.ef-app-shell__nav a[aria-current=page]');
  await expect(selected).toHaveCSS('color','rgb(33, 116, 204)');
  await expect(selected).toHaveCSS('background-color','rgb(234, 243, 252)');
  await expect(selected).toHaveCSS('font-size','14px');
  await expect(selected).toHaveCSS('font-weight','600');
  await expect(page.getByRole('button',{name:'查询',exact:true})).toHaveCSS('background-color','rgb(36, 104, 242)');
  await expect(page.locator('.ef-data-table th').first()).toHaveCSS('font-size','14px');
  await expect(page.locator('.ef-data-table th').first()).toHaveCSS('font-weight','400');
  await expect(page.getByRole('cell',{name:'研发工程师',exact:true})).toHaveCSS('font-size','12px');
  await expect(page.locator('.list-filters label').first()).toHaveCSS('font-size','14px');
  const query = page.getByRole('button',{name:'查询',exact:true});
  await expect(query).toHaveCSS('border-radius','4px');
  await expect(query).toHaveCSS('font-size','14px');
  await query.hover();
  await expect(query).toHaveCSS('background-color','rgb(82, 142, 255)');
  await page.mouse.down();
  await expect(query).toHaveCSS('background-color','rgb(20, 75, 204)');
  await page.mouse.up();
  const reset = page.getByRole('button',{name:'重置',exact:true});
  await reset.hover();
  await expect(reset).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(reset).toHaveCSS('border-top-color','rgb(36, 104, 242)');
  const disabled = page.getByRole('button',{name:'上一页',exact:true});
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveCSS('color','rgb(184, 186, 191)');
  await expect(disabled).toHaveCSS('background-color','rgb(247, 248, 250)');
  const tag = page.locator('.ui-tag').first();
  await expect(tag).toHaveCSS('font-size','12px');
  await expect(tag).toHaveCSS('border-radius','0px');
  await expect(tag).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(tag).toHaveCSS('background-color','rgb(36, 104, 242)');
  await page.mouse.move(0,0);
  const tagActions = page.getByRole('button',{name:'标签操作',exact:true});
  const actionBox = (await tagActions.boundingBox())!;
  const arrowBox = (await tagActions.locator('svg').boundingBox())!;
  expect(actionBox.width).toBe(28);
  expect(actionBox.height).toBe(28);
  expect(Math.abs(actionBox.y + actionBox.height/2 - arrowBox.y - arrowBox.height/2)).toBeLessThan(1);
  expect(Math.abs(actionBox.x + actionBox.width/2 - arrowBox.x - arrowBox.width/2)).toBeLessThan(1);
  await tagActions.focus();
  await page.keyboard.press('Enter');
  await expect(tagActions).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('menu',{name:'标签操作菜单'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('tag-actions.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(tagActions).toHaveAttribute('aria-expanded','false');
  await expect(tagActions).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'新增岗位',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('dialog.png'),fullPage:true});
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(tagActions).toHaveCSS('height','36px');
  await expect(page.getByRole('button',{name:'打开菜单',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'新增岗位',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(391);
  await page.getByRole('button',{name:'取消',exact:true}).click();
});
