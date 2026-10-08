import {test,expect} from './fixtures';

test('public no-tag layout reuses list/form/table controls and spcore colors without admin requests',async({page},info)=>{
  const apiCalls:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiCalls.push(request.url());});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/frontend-template.html');
  await expect(page.getByRole('heading',{name:'客户列表',exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'页面标签'})).toHaveCount(0);
  await expect(page.locator('.enterprise-data-table')).toBeVisible();
  await expect(page.getByRole('button',{name:'查询',exact:true})).toHaveCSS('background-color','rgb(36, 104, 242)');
  await page.getByLabel('关键词',{exact:true}).fill('远山');await page.getByRole('button',{name:'查询',exact:true}).click();
  await expect(page.getByRole('cell',{name:'远山设计',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'星河科技',exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('frontend-list-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'新增客户',exact:true}).click();
  await expect(page.locator('.form-page .enterprise-form')).toBeVisible();
  await page.getByLabel('客户名称',{exact:true}).fill('模板客户');await page.getByLabel('电子邮箱',{exact:true}).fill('template@example.com');
  await page.screenshot({path:info.outputPath('frontend-form-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'保存客户',exact:true}).click();await expect(page.getByRole('status',{name:'操作反馈',exact:true})).toContainText('客户已保存');
  await page.getByRole('button',{name:'重置',exact:true}).click();await expect(page.getByRole('cell',{name:'模板客户',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  const toggle=page.getByRole('button',{name:'前台导航菜单',exact:true});await expect(toggle).toBeVisible();await toggle.click();
  await page.getByRole('navigation',{name:'前台导航',exact:true}).getByRole('link',{name:'新增客户',exact:true}).click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('heading',{name:'新增客户',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('frontend-form-mobile.png'),fullPage:true});
  await toggle.click();await page.getByRole('navigation',{name:'前台导航',exact:true}).getByRole('link',{name:'客户列表',exact:true}).focus();await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','false');expect(apiCalls).toEqual([]);
});
