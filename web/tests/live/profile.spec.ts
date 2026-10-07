import {test,expect} from '@playwright/test';
test('real self profile, password verification, avatar crop/rotation/replace and no-grant account lifecycle', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  const adminLogin=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});
  expect(adminLogin.status()).toBe(200); const adminHeaders={Authorization:`Bearer ${(await adminLogin.json()).accessToken}`};
  const username=`p${Date.now()}`;
  const created=await page.request.post('/api/v1/system/users',{headers:adminHeaders,data:{user:{username,displayName:'个人资料浏览器用户',departmentId:'105',email:'',phone:'',sex:'2',status:'0',roleIds:[],postIds:['2']},password:'Profile123'}});
  expect(created.status()).toBe(201); const account=await created.json(); let avatarUrl:string|undefined;
  try {
    await page.goto('/user/profile'); await page.getByLabel('账号',{exact:true}).fill(username); await page.getByLabel('密码',{exact:true}).fill('Profile123'); await page.getByRole('button',{name:'登录',exact:true}).click();
    await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible(); await expect(page.getByText('测试部门',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'保存资料',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('正确的手机号码');
    await page.getByLabel('用户昵称',{exact:true}).fill('已保存个人资料'); await page.getByLabel('手机号码',{exact:true}).fill('13900000008'); await page.getByLabel('邮箱',{exact:true}).fill(`${username}@example.com`); await page.getByLabel('女',{exact:true}).check();
    await page.getByRole('button',{name:'保存资料',exact:true}).click(); await expect(page.getByRole('status').filter({hasText:'个人资料已保存'})).toBeVisible(); await expect(page.locator('.account-name')).toHaveText('已保存个人资料');
    await page.reload(); await expect(page.getByLabel('用户昵称',{exact:true})).toHaveValue('已保存个人资料'); await expect(page.getByLabel('邮箱',{exact:true})).toHaveValue(`${username}@example.com`);
    const stored=await (await page.request.get(`/api/v1/system/users/${account.id}`,{headers:adminHeaders})).json(); expect(stored.roleIds).toEqual([]); expect(stored.postIds).toEqual(['2']); expect(stored.user.departmentId).toBe('105');
    await page.getByRole('tab',{name:'修改密码'}).click(); await page.getByLabel('旧密码',{exact:true}).fill('wrong'); await page.getByLabel('新密码',{exact:true}).fill('Changed123'); await page.getByLabel('确认新密码',{exact:true}).fill('Changed123');
    await page.getByRole('button',{name:'显示旧密码',exact:true}).click();await expect(page.getByLabel('旧密码',{exact:true})).toHaveAttribute('type','text');await expect(page.getByLabel('新密码',{exact:true})).toHaveAttribute('type','password');await expect(page.getByLabel('确认新密码',{exact:true})).toHaveAttribute('type','password');
    await page.getByRole('button',{name:'隐藏旧密码',exact:true}).click();
    await expect(page.getByLabel('新密码',{exact:true})).toHaveAttribute('type','password'); await page.getByLabel('显示密码',{exact:true}).check(); await expect(page.getByLabel('新密码',{exact:true})).toHaveAttribute('type','text'); await page.getByLabel('显示密码',{exact:true}).uncheck();
    await page.getByRole('button',{name:'保存密码',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('旧密码不正确'); await page.getByLabel('旧密码',{exact:true}).fill('Profile123');
    await page.getByLabel('新密码',{exact:true}).fill('Profile123'); await page.getByLabel('确认新密码',{exact:true}).fill('Profile123'); await page.getByRole('button',{name:'保存密码',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('不能与旧密码相同');
    await page.getByLabel('新密码',{exact:true}).fill('Changed123'); await page.getByLabel('确认新密码',{exact:true}).fill('Changed123'); await page.getByRole('button',{name:'保存密码',exact:true}).click(); await expect(page.getByRole('status').filter({hasText:'密码已修改'})).toBeVisible(); await expect(page.getByLabel('旧密码',{exact:true})).toHaveValue('');
    expect((await page.request.post('/api/v1/auth/login',{data:{username,password:'Profile123'}})).status()).toBe(401);
    const newLogin=await page.request.post('/api/v1/auth/login',{data:{username,password:'Changed123'}}); expect(newLogin.status()).toBe(200);
    const ownHeaders={Authorization:`Bearer ${(await newLogin.json()).accessToken}`};
    await page.getByRole('button',{name:'修改头像',exact:true}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('选择头像图片',{exact:true}).setInputFiles({name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('wrong')}); await expect(dialog.getByRole('alert')).toContainText('有效的');
    await dialog.getByLabel('选择头像图片',{exact:true}).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not png')}); await expect(dialog.getByRole('alert')).toContainText('无法读取');
    await dialog.getByLabel('选择头像图片',{exact:true}).setInputFiles('tests/fixtures/avatar.png'); await expect(dialog.getByRole('button',{name:'保存头像',exact:true})).toBeEnabled();
    const original=await dialog.locator('canvas').first().evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL());
    await dialog.getByRole('button',{name:'向右旋转',exact:true}).click(); await expect.poll(()=>dialog.locator('canvas').first().evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL())).not.toBe(original);
    await dialog.getByRole('button',{name:'向左旋转',exact:true}).click(); await expect.poll(()=>dialog.locator('canvas').first().evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL())).toBe(original);
    await dialog.getByLabel('缩放',{exact:true}).press('End'); await expect(dialog.getByLabel('缩放',{exact:true})).toHaveValue('3');
    const beforeDrag=await dialog.locator('canvas').first().evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL()); const area=await dialog.locator('canvas').first().boundingBox();
    await page.mouse.move(area!.x+100,area!.y+100); await page.mouse.down(); await page.mouse.move(area!.x+130,area!.y+120); await page.mouse.up();
    await expect.poll(()=>dialog.locator('canvas').first().evaluate((canvas:HTMLCanvasElement)=>canvas.toDataURL())).not.toBe(beforeDrag);
    await dialog.getByLabel('水平位置',{exact:true}).press('End'); await dialog.getByLabel('垂直位置',{exact:true}).press('Home');
    const expected=await dialog.locator('canvas').first().evaluate(async (canvas:HTMLCanvasElement)=>({data:canvas.toDataURL(),hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',canvas.getContext('2d')!.getImageData(0,0,200,200).data))).join(',')})); expect(expected.data).not.toBe(original);
    await dialog.getByRole('button',{name:'保存头像',exact:true}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('status').filter({hasText:'头像已保存'})).toBeVisible();
    avatarUrl=(await (await page.request.get('/api/v1/me',{headers:ownHeaders})).json()).avatarUrl;
    await expect(page.getByRole('link',{name:'个人中心',exact:true}).locator('img')).toHaveAttribute('src',avatarUrl!);
    await expect.poll(()=>page.getByRole('link',{name:'个人中心',exact:true}).locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBe(200);
    const actual=await page.evaluate(async (url:string)=> {const image=new Image(); image.src=url; await image.decode(); const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight; const context=canvas.getContext('2d')!;context.drawImage(image,0,0); return {width:canvas.width,height:canvas.height,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',context.getImageData(0,0,200,200).data))).join(',')};},avatarUrl!);
    expect(actual).toEqual({width:200,height:200,hash:expected.hash});
    await page.reload(); await expect(page.getByRole('img',{name:'当前头像',exact:true})).toHaveAttribute('src',avatarUrl!);
    await page.getByRole('button',{name:'修改头像',exact:true}).click(); await expect(dialog.getByRole('button',{name:'保存头像',exact:true})).toBeEnabled(); await dialog.getByRole('button',{name:'取消',exact:true}).click(); expect((await (await page.request.get('/api/v1/me',{headers:ownHeaders})).json()).avatarUrl).toBe(avatarUrl);
    await page.getByRole('button',{name:'修改头像',exact:true}).click(); await dialog.getByLabel('选择头像图片',{exact:true}).setInputFiles('tests/fixtures/avatar.png'); await dialog.getByRole('button',{name:'重置裁剪',exact:true}).click(); await dialog.getByRole('button',{name:'保存头像',exact:true}).click(); await expect(dialog).toHaveCount(0);
    expect((await page.request.get(avatarUrl!)).status()).toBe(404); avatarUrl=(await (await page.request.get('/api/v1/me',{headers:ownHeaders})).json()).avatarUrl;
    await page.screenshot({path:'test-results/live-profile.png',fullPage:true}); await page.getByRole('button',{name:'关闭个人中心'}).click(); await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('[data-page-path="/user/profile"]')).toHaveCount(0);await expect(page.getByRole('navigation',{name:'页面标签'}).getByRole('link',{name:'页面标签：个人中心',exact:true})).toHaveCount(0); await page.getByRole('link',{name:'个人中心',exact:true}).click(); await expect(page.getByLabel('用户昵称',{exact:true})).toHaveValue('已保存个人资料');
    await page.getByRole('button',{name:'退出登录',exact:true}).click(); await expect(page.getByRole('heading',{name:'登录工作空间'})).toBeVisible(); expect(errors).toEqual([]);
    await page.request.post('/logout',{headers:ownHeaders});
  } finally {
    if (avatarUrl) {
      // Upload cleanup is performed by the runtime fixture's owned file directory cleanup.
      expect(avatarUrl).toMatch(/^\/profile\/avatar\/canonical\/[0-9a-f-]+\.png$/);
    }
    expect((await page.request.delete('/api/v1/system/users',{headers:adminHeaders,data:{ids:[account.id]}})).status()).toBe(204); await page.request.post('/logout',{headers:adminHeaders});
  }
});
