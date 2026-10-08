import {test,expect} from './fixtures';

test('centered account panel retains focus and readable errors at desktop and phone widths',async({page},info)=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({status:403,json:{}}));
  await page.setViewportSize({width:1440,height:1000});await page.goto('/login');
  await expect(page.getByRole('button',{name:'登录',exact:true})).toBeEnabled();
  const panel=page.locator('.login-panel');expect((await panel.boundingBox())!.width).toBe(400);
  await page.getByLabel('账号',{exact:true}).focus();
  expect(await page.getByLabel('账号',{exact:true}).evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
  await page.screenshot({path:info.outputPath('login-desktop.png'),fullPage:true});
  await page.getByLabel('账号',{exact:true}).fill('visual-reader');await page.getByLabel('密码',{exact:true}).fill('Wrong123');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('login-error-mobile.png'),fullPage:true});
});

test('registration uses the same panel and keeps validation without sending a mismatched password',async({page},info)=>{
  await page.route('**/api/v1/auth/registration',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  let writes=0;await page.route('**/api/v1/auth/register',route=>{writes++;return route.fulfill({status:204});});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/register');
  await expect(page.getByRole('button',{name:'注册',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('register-desktop.png'),fullPage:true});
  await page.getByLabel('账号',{exact:true}).fill('visual-reader');await page.getByLabel('密码',{exact:true}).fill('Current123');await page.getByLabel('确认密码',{exact:true}).fill('Different123');
  await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('两次输入的密码不一致。');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('register-error-mobile.png'),fullPage:true});expect(writes).toBe(0);
});
