import {test,expect} from '@playwright/test';
import type {ConfigurationResponse,PageResponseConfigurationResponse,PageResponseUserResponse} from '../../generated/api';
test('actual registration switch, no-session success, fresh no-role login, duplicate and disabled recovery',async({page})=>{
  const root=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});expect(root.status()).toBe(200);
  const admin={Authorization:'Bearer '+(await root.json()).accessToken};const backups:ConfigurationResponse[]=[];let userId:string|undefined;
  const username='rv'+Date.now();
  async function configure(value:string){
    const records=await page.request.get('/api/v1/system/configurations?key=sys.account.registerUser',{headers:admin});expect(records.status()).toBe(200);
    const row=((await records.json()) as PageResponseConfigurationResponse).items.find(item=>item.key==='sys.account.registerUser')!;expect(row).toBeTruthy();if(!backups.some(item=>item.id===row.id))backups.push(row);
    expect((await page.request.put('/api/v1/system/configurations/'+row.id,{headers:admin,data:{name:row.name,key:row.key,value,builtin:row.builtin,remark:row.remark??''}})).status()).toBe(204);
  }
  try{
    await configure('false');await page.goto('/login');await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible();await expect(page.getByRole('link',{name:'注册账号',exact:true})).toHaveCount(0);
    await page.goto('/register');await expect(page.getByRole('status')).toContainText('注册暂未开放');
    await configure('true');await page.goto('/login');await page.getByRole('link',{name:'注册账号',exact:true}).click();await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByLabel('确认密码',{exact:true}).fill('Register123');await page.getByRole('button',{name:'注册',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'注册成功'})).toContainText(username);expect(await page.evaluate(()=>sessionStorage.getItem('eforge.enterprise.session.v1'))).toBeNull();
    const users=await page.request.get('/api/v1/system/users?username='+username,{headers:admin});expect(users.status()).toBe(200);userId=((await users.json()) as PageResponseUserResponse).items.find(item=>item.username===username)!.id;
    await page.getByRole('button',{name:'前往登录'}).click();await expect(page).toHaveURL(/\/login$/);await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByRole('button',{name:'登录',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('heading',{name:'暂无访问权限'})).toBeVisible();await page.getByRole('link',{name:'个人中心',exact:true}).click();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken);
    const boot=await(await page.request.get('/api/v1/app/bootstrap',{headers:{Authorization:'Bearer '+token}})).json();expect(boot.roles).toEqual([]);expect(boot.permissions).toEqual([]);expect(boot.passwordStatus.initialChangeRecommended).toBe(false);expect(boot.user.password).toBeUndefined();
    await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.goto('/register');await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('Register123');await page.getByLabel('确认密码',{exact:true}).fill('Register123');await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('alert')).toContainText('账号已存在');await expect(page.getByLabel('密码',{exact:true})).toHaveValue('');
    await configure('false');await page.reload();await expect(page.getByRole('status')).toContainText('注册暂未开放');await expect(page.getByRole('button',{name:'注册',exact:true})).toHaveCount(0);
  }finally{
    for(const row of backups)expect((await page.request.put('/api/v1/system/configurations/'+row.id,{headers:admin,data:{name:row.name,key:row.key,value:row.value,builtin:row.builtin,remark:row.remark??''}})).status()).toBe(204);
    if(userId)expect((await page.request.delete('/api/v1/system/users',{headers:admin,data:{ids:[userId]}})).status()).toBe(204);
    await page.request.post('/logout',{headers:admin});
  }
});
