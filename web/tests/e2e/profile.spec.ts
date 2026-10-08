import {test,expect} from './fixtures';
test('authenticated self-service route retries without grants, validates forms, and supports mobile cancel/close', async ({page}) => {
  let failed = true, writes = 0;
  const user = {id:'9007199254740993',username:'ordinary',displayName:'普通用户'};
  await page.route('**/captchaImage',route => route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route => route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route => route.fulfill({json:{user,roles:[],permissions:[],navigation:[]}}));
  await page.route('**/api/v1/me',route => {
    if (route.request().method()==='PUT') {writes++;user.displayName=route.request().postDataJSON().displayName; return route.fulfill({status:204});}
    return route.fulfill(failed ? {status:503,json:{code:'INTERNAL_ERROR'}} : {json:{...user,sex:'2',roleNames:'',postNames:'',phone:'',email:''}});
  });
  await page.goto('/user/profile'); await page.getByLabel('账号',{exact:true}).fill('ordinary'); await page.getByLabel('密码',{exact:true}).fill('Password123'); await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('button',{name:'重试加载个人资料'})).toBeVisible(); failed=false; await page.getByRole('button',{name:'重试加载个人资料'}).click();
  await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); await expect(page.getByRole('heading',{name:'暂无访问权限'})).toHaveCount(0);
  await page.getByRole('button',{name:'保存资料',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('正确的手机号码'); expect(writes).toBe(0);
  await page.getByLabel('用户昵称',{exact:true}).fill('已保存普通用户');await page.getByLabel('手机号码',{exact:true}).fill('13900000008');await page.getByLabel('邮箱',{exact:true}).fill('ordinary@example.com');
  await page.getByRole('button',{name:'保存资料',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'个人资料已保存'})).toBeVisible();await expect(page.locator('.account-name')).toHaveText('已保存普通用户');expect(writes).toBe(1);
  await page.getByRole('tab',{name:'修改密码'}).click(); await page.getByLabel('旧密码',{exact:true}).fill('Password123'); await page.getByLabel('新密码',{exact:true}).fill('New12345'); await page.getByLabel('确认新密码',{exact:true}).fill('different');
  await page.getByRole('button',{name:'保存密码',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('不一致');
  await page.getByRole('button',{name:'修改头像',exact:true}).click(); await expect(page.getByRole('button',{name:'保存头像',exact:true})).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844}); await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); expect(await page.evaluate(()=>document.body.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab',{name:'修改密码'}).focus(); await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('tab',{name:'基本资料'})).toHaveAttribute('aria-selected','true'); await expect(page.getByRole('tab',{name:'基本资料'})).toBeFocused();
  await page.getByRole('button',{name:'修改头像',exact:true}).click(); const dialogBox=await page.getByRole('dialog').boundingBox(); expect(dialogBox!.x).toBeGreaterThanOrEqual(0); expect(dialogBox!.x+dialogBox!.width).toBeLessThanOrEqual(390); await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'关闭个人中心'}).click(); await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('[data-page-path="/user/profile"]')).toHaveCount(0);await expect(page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：个人中心',exact:true})).toHaveCount(0); await page.getByRole('link',{name:'个人中心',exact:true}).click(); await expect(page).toHaveURL(/\/user\/profile$/);await expect(page.getByRole('tab',{name:'基本资料'})).toHaveAttribute('aria-selected','true');await page.getByRole('tab',{name:'修改密码'}).click();await expect(page.getByLabel('旧密码',{exact:true})).toHaveValue('');
});

test('header avatar uses safe profile images, recovers broken images and retains the native profile entry', async ({page}) => {
  let avatarUrl='/profile/avatar/current.png';
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'7',username:'ordinary',displayName:'😀普通用户',avatarUrl},roles:[],permissions:[],navigation:[]}}));
  await page.route('**/api/v1/me',route=>route.fulfill({json:{id:'7',username:'ordinary',displayName:'😀普通用户',sex:'2',roleNames:'',postNames:''}}));
  await page.route('**/profile/avatar/current.png',route=>route.fulfill({path:'tests/fixtures/avatar.png',contentType:'image/png'}));
  await page.route('**/profile/avatar/missing.png',route=>route.fulfill({status:404}));
  await page.goto('/user/profile');await page.getByLabel('账号',{exact:true}).fill('ordinary');await page.getByLabel('密码',{exact:true}).fill('Password123');await page.getByRole('button',{name:'登录',exact:true}).click();
  const link=page.getByRole('link',{name:'个人中心',exact:true});await expect(link.locator('img')).toHaveAttribute('src',avatarUrl);await expect.poll(()=>link.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  avatarUrl='/profile/avatar/missing.png';await page.reload();await expect(link.locator('img')).toHaveCount(0);await expect(link.locator('.header-account-avatar-fallback')).toHaveText('😀');
  avatarUrl='https://example.com/tracking.png';await page.reload();await expect(link.locator('.header-account-avatar-fallback')).toHaveText('😀');expect(requests.some(url=>url.includes('example.com/tracking'))).toBe(false);await expect(link).toHaveAttribute('href','/user/profile');
});
for(const initial of [true,false])test(`password reminder ${initial?'initial priority':'expiry'} supports cancel and enters the retained password tab`,async({page},info)=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  const user={id:'7',username:'ordinary',displayName:'普通用户'};
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user,roles:[],permissions:[],navigation:[],passwordStatus:{characterType:'0',initialChangeRecommended:initial,expired:true}}}));
  await page.route('**/api/v1/me',route=>route.fulfill({json:{...user,sex:'2',roleNames:'',postNames:'',phone:'13900000008',email:'ordinary@example.com'}}));
  await page.goto('/user/profile');await page.getByLabel('账号',{exact:true}).fill('ordinary');await page.getByLabel('密码',{exact:true}).fill('Password123');await page.getByRole('button',{name:'登录',exact:true}).click();
  const reminder=page.getByRole('alertdialog',{name:'安全提示'});await expect(reminder).toContainText(initial?'您的密码还是初始密码，请修改密码！':'您的密码已过期，请尽快修改密码！');
  if(initial){
    await page.setViewportSize({width:1440,height:1000});await reminder.getByRole('button',{name:'确定',exact:true}).focus();
    await page.screenshot({path:info.outputPath('reminder-desktop.png')});
    await page.setViewportSize({width:390,height:844});const box=await reminder.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
    await page.screenshot({path:info.outputPath('reminder-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  }
  if(initial)await expect(reminder).not.toContainText('已过期');await reminder.getByRole('button',{name:'取消',exact:true}).click();await expect(reminder).toHaveCount(0);await expect(page.getByRole('tab',{name:'基本资料'})).toHaveAttribute('aria-selected','true');await page.getByLabel('用户昵称',{exact:true}).fill('取消后草稿');await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByLabel('用户昵称',{exact:true})).toHaveValue('取消后草稿');
  await page.reload();await expect(reminder).toBeVisible();await reminder.getByRole('button',{name:'确定',exact:true}).click();await expect(reminder).toHaveCount(0);await expect(page).toHaveURL(/\/user\/profile\?password=1$/);await expect(page.getByRole('tab',{name:'修改密码'})).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('旧密码',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'基本资料'}).click();await page.getByLabel('用户昵称',{exact:true}).fill('保留页面草稿');await page.getByRole('tab',{name:'修改密码'}).click();await page.getByRole('tab',{name:'基本资料'}).click();await expect(page.getByLabel('用户昵称',{exact:true})).toHaveValue('保留页面草稿');
});
