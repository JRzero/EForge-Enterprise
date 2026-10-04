import {test,expect} from './fixtures';
test('authenticated self-service route retries without grants, validates forms, and supports mobile cancel/close', async ({page}) => {
  let failed = true, writes = 0;
  const user = {id:'9007199254740993',username:'ordinary',displayName:'普通用户'};
  await page.route('**/captchaImage',route => route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route => route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route => route.fulfill({json:{user,roles:[],permissions:[],navigation:[]}}));
  await page.route('**/api/v1/me',route => {
    if (route.request().method()==='PUT') {writes++; return route.fulfill({status:204});}
    return route.fulfill(failed ? {status:503,json:{code:'INTERNAL_ERROR'}} : {json:{...user,sex:'2',roleNames:'',postNames:'',phone:'',email:''}});
  });
  await page.goto('/user/profile'); await page.getByLabel('账号',{exact:true}).fill('ordinary'); await page.getByLabel('密码',{exact:true}).fill('Password123'); await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('button',{name:'重试加载个人资料'})).toBeVisible(); failed=false; await page.getByRole('button',{name:'重试加载个人资料'}).click();
  await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); await expect(page.getByRole('heading',{name:'暂无访问权限'})).toHaveCount(0);
  await page.getByRole('button',{name:'保存资料',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('正确的手机号码'); expect(writes).toBe(0);
  await page.getByRole('tab',{name:'修改密码'}).click(); await page.getByLabel('旧密码',{exact:true}).fill('Password123'); await page.getByLabel('新密码',{exact:true}).fill('New12345'); await page.getByLabel('确认新密码',{exact:true}).fill('different');
  await page.getByRole('button',{name:'保存密码',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('不一致');
  await page.getByRole('button',{name:'修改头像',exact:true}).click(); await expect(page.getByRole('button',{name:'保存头像',exact:true})).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844}); await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); expect(await page.evaluate(()=>document.body.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab',{name:'修改密码'}).focus(); await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('tab',{name:'基本资料'})).toHaveAttribute('aria-selected','true'); await expect(page.getByRole('tab',{name:'基本资料'})).toBeFocused();
  await page.getByRole('button',{name:'修改头像',exact:true}).click(); const dialogBox=await page.getByRole('dialog').boundingBox(); expect(dialogBox!.x).toBeGreaterThanOrEqual(0); expect(dialogBox!.x+dialogBox!.width).toBeLessThanOrEqual(390); await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'关闭个人中心'}).click(); await expect(page).toHaveURL(/\/dashboard$/); await page.getByRole('link',{name:'个人中心',exact:true}).click(); await expect(page).toHaveURL(/\/user\/profile$/);
});
