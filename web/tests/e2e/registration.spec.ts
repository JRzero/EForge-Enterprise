import {test,expect} from './fixtures';
test('registration defaults closed and status failure recovers without exposing credentials',async({page})=>{
  let enabled=false,failed=false,writes=0;
  await page.route('**/api/v1/auth/registration',route=>route.fulfill(failed?{status:503,json:{code:'REGISTRATION_UNAVAILABLE'}}:{json:{enabled}}));
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/register',route=>{writes++;return route.fulfill({status:201});});
  await page.goto('/login');await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(page.getByRole('link',{name:'注册账号',exact:true})).toHaveCount(0);
  await page.goto('/register');await expect(page.getByRole('status')).toContainText('注册暂未开放');await expect(page.getByRole('button',{name:'注册',exact:true})).toHaveCount(0);
  failed=true;await page.reload();await expect(page.getByRole('alert')).toContainText('注册暂时无法完成');failed=false;enabled=true;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByLabel('账号',{exact:true})).toBeVisible();expect(writes).toBe(0);
});
test('registration rejects mismatch, gates pending writes, preserves inert account text and never creates a session',async({page})=>{
  let writes=0,release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/v1/auth/registration',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'registered-session',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'42',username:'<img src=x>',displayName:'<img src=x>'},roles:[],permissions:[],navigation:[]}}));
  await page.route('**/api/v1/auth/register',async route=>{writes++;expect(route.request().postDataJSON()).toEqual({username:'<img src=x>',password:'Register123',confirmPassword:'Register123'});await gate;await route.fulfill({status:201});});
  await page.goto('/login');await page.getByRole('link',{name:'注册账号',exact:true}).click();await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel('账号',{exact:true}).fill('<img src=x>');await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByLabel('确认密码',{exact:true}).fill('Different123');await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('alert')).toContainText('不一致');expect(writes).toBe(0);
  await page.getByLabel('确认密码',{exact:true}).fill('Register123');await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('button',{name:'正在注册…'})).toBeDisabled();await page.getByRole('link',{name:'使用已有账户登录'}).click();await expect(page).toHaveURL(/\/register$/);expect(writes).toBe(1);
  release();await expect(page.getByRole('status').filter({hasText:'账号 <img src=x> 注册成功'})).toContainText('账号 <img src=x> 注册成功');await expect(page.locator('img[src="x"]')).toHaveCount(0);await expect(page.getByRole('button',{name:'注册',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('Register123');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'前往登录'}).click();await expect(page).toHaveURL(/\/login$/);await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');
  await page.getByLabel('账号',{exact:true}).fill('<img src=x>');await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();await expect(page.getByRole('link',{name:'个人中心',exact:true})).toBeVisible();
});
test('registration duplicate and captcha rejection refresh challenge for explicit recovery and respects disabled policy',async({page})=>{
  let challenges=0,writes=0,enabled=true,reject=true;
  await page.route('**/api/v1/auth/registration',route=>route.fulfill({json:{enabled}}));
  await page.route('**/captchaImage',route=>{challenges++;return route.fulfill({json:{code:200,captchaEnabled:true,uuid:'challenge-'+challenges,img:'dGVzdA=='}});});
  await page.route('**/api/v1/auth/register',route=>{writes++;const body=route.request().postDataJSON();expect(body.code).toBe('42');expect(body.uuid).toBe('challenge-'+challenges);return route.fulfill(reject?{status:409,json:{code:'REGISTRATION_USERNAME_EXISTS'}}:{status:403,json:{code:'REGISTRATION_DISABLED'}});});
  await page.goto('/register');await page.getByLabel('账号',{exact:true}).fill('newaccount');await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByLabel('确认密码',{exact:true}).fill('Register123');
  await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('alert')).toContainText('请输入验证码');expect(writes).toBe(0);
  const initialChallenges=challenges;await page.getByLabel('验证码',{exact:true}).fill('42');await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('alert')).toContainText('账号已存在');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');await expect(page.getByLabel('验证码',{exact:true})).toHaveValue('');expect(challenges).toBe(initialChallenges+1);
  await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByLabel('确认密码',{exact:true}).fill('Register123');await page.getByLabel('验证码',{exact:true}).fill('42');enabled=false;reject=false;await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('status')).toContainText('注册暂未开放');expect(writes).toBe(2);await expect(page.getByRole('button',{name:'注册',exact:true})).toHaveCount(0);
});



