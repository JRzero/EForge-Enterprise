import {test,expect,type Page} from '@playwright/test';

async function login(page:Page,username='admin',password='admin123'){
  await page.goto('/workflow/packages');await page.getByLabel('账号',{exact:true}).fill(username);
  await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('real workflow editor, scenario proof, immutable publication and separate activation',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await login(page);await expect(page.getByRole('heading',{name:'流程管理',exact:true})).toBeAttached();
  // A separate owned API login avoids reading credentials from browser storage.
  const signed=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});expect(signed.status()).toBe(200);
  const auth={Authorization:`Bearer ${(await signed.json()).accessToken}`};
  try{
    const status=await page.request.get('/api/v1/workflow/status',{headers:auth});expect(status.status()).toBe(200);
    if(!(await status.json()).enabled){
      await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();
      await expect(page.getByRole('button',{name:'新增流程包',exact:true})).toBeDisabled();return;
    }
    const name=`浏览器审批${Date.now()}`;await page.getByRole('button',{name:'新增流程包',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'新增流程包',exact:true});await editor.getByLabel('流程名称',{exact:true}).fill(name);
    await expect(editor.getByLabel('流程文件',{exact:true})).toContainText('candidateGroups="role:2"');
    const created=page.waitForResponse(response=>response.url().endsWith('/api/v1/workflow/packages')&&response.request().method()==='POST');
    await editor.getByRole('button',{name:'保存草稿',exact:true}).click();const reply=await created;expect(reply.status()).toBe(201);const draft=await reply.json();
    const row=page.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})});await expect(row).toBeVisible();
    await expect(row.getByRole('button',{name:'发布',exact:true})).toBeDisabled();
    await row.getByRole('button',{name:'校验',exact:true}).click();await expect(row.getByRole('cell',{name:'已通过',exact:true})).toBeVisible();
    await row.getByRole('button',{name:'发布',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'确认发布',exact:true}).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(page.getByText('流程已发布，尚未改变当前启用版本。可在详情中选择激活。',{exact:true})).toBeVisible();
    await row.getByRole('button',{name:'详情',exact:true}).click();const panel=page.getByRole('dialog',{name:'流程详情与发布版本',exact:true});
    await panel.getByRole('button',{name:'激活版本 1',exact:true}).click();await panel.getByRole('button',{name:'确认激活',exact:true}).click();
    await expect(panel.getByRole('cell',{name:'当前启用',exact:true})).toBeVisible();
    await page.screenshot({path:'test-results/live/workflow-release.png',fullPage:true});
    await panel.getByRole('button',{name:'关闭',exact:true}).click();await row.getByRole('button',{name:'编辑',exact:true}).click();
    await page.getByRole('dialog').getByLabel('流程名称',{exact:true}).fill(name+'新版');await page.getByRole('button',{name:'保存草稿',exact:true}).click();
    const updated=page.getByRole('row').filter({has:page.getByRole('cell',{name:name+'新版',exact:true})});await expect(updated.getByRole('cell',{name:'待校验',exact:true})).toBeVisible();
    await expect(updated.getByRole('button',{name:'发布',exact:true})).toBeDisabled();
    const versions=await page.request.get(`/api/v1/workflow/packages/${draft.id}/releases`,{headers:auth});expect(versions.status()).toBe(200);
    const releases=(await versions.json()).items;expect(releases).toHaveLength(1);expect(releases[0].name).toBe(name);expect(releases[0].packageRevision).toBe('1');
    const active=await page.request.get('/api/v1/workflow/activations/leave',{headers:auth});expect((await active.json()).releaseId).toBe(releases[0].id);
    await updated.getByRole('button',{name:'详情',exact:true}).click();
    await panel.getByRole('button',{name:'版本 1 设为基准',exact:true}).click();
    await panel.getByRole('button',{name:'与当前草稿对比',exact:true}).click();
    const comparison=panel.getByRole('region',{name:'版本内容对比'});
    await expect(comparison).toContainText('目标：草稿 2');
    const changedName=comparison.locator('details').filter({has:page.getByText('流程名称 · 已变更',{exact:true})});
    await expect(changedName.locator('pre').first()).toHaveText(name);await expect(changedName.locator('pre').last()).toHaveText(name+'新版');
    await panel.getByRole('button',{name:'比较版本 1',exact:true}).click();
    await expect(comparison.getByText('两侧内容一致',{exact:true})).toBeVisible();
    await page.screenshot({path:'test-results/live/workflow-comparison.png',fullPage:true});
    expect(errors).toEqual([]);
    // Immutable records belong to this runner's disposable database, removed by its owner.
  }finally{await page.request.post('/logout',{headers:auth});}
});

test('real workflow read-only grants and immediate backend revocation',async({page})=>{
  test.setTimeout(60000);
  const signed=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});expect(signed.status()).toBe(200);
  const auth={Authorization:`Bearer ${(await signed.json()).accessToken}`};let userId:string|undefined,roleId:string|undefined;
  try{
    const stamp=Date.now(),username=`wf${stamp}`,role={name:`流程只读${stamp}`,key:`wf${stamp}`,sort:10,status:'0',remark:'',menuLinked:false,menuKeys:['workflow','workflow-packages']};
    const createdRole=await page.request.post('/api/v1/system/roles',{headers:auth,data:role});expect(createdRole.status()).toBe(201);roleId=(await createdRole.json()).id;
    const createdUser=await page.request.post('/api/v1/system/users',{headers:auth,data:{user:{username,displayName:'流程只读账号',departmentId:'103',sex:'2',status:'0',roleIds:[roleId],postIds:[]},password:'Workflow123'}});expect(createdUser.status()).toBe(201);userId=(await createdUser.json()).id;
    await login(page,username,'Workflow123');await expect(page.getByRole('heading',{name:'流程管理',exact:true})).toBeAttached();
    for(const action of ['新增流程包','编辑','校验','发布'])await expect(page.getByRole('button',{name:action,exact:true})).toHaveCount(0);
    const userLogin=await page.request.post('/api/v1/auth/login',{data:{username,password:'Workflow123'}});expect(userLogin.status()).toBe(200);const userAuth={Authorization:`Bearer ${(await userLogin.json()).accessToken}`};
    try{
      expect((await page.request.post('/api/v1/workflow/packages',{headers:userAuth,data:{name:'无权创建',businessType:'leave',source:{bpmnXml:'<process/>',scenarios:[{name:'拒绝',decisions:[{taskKey:'review',approved:false}],expectedEnd:'end'}]}}})).status()).toBe(403);
      expect((await page.request.put(`/api/v1/system/roles/${roleId}`,{headers:auth,data:{...role,menuKeys:[]}})).status()).toBe(204);
      expect((await page.request.get('/api/v1/workflow/packages',{headers:userAuth})).status()).toBe(403);
      expect((await page.request.get('/api/v1/workflow/packages/00000000-0000-0000-0000-000000000001/comparison?baselineReleaseId=00000000-0000-0000-0000-000000000002',{headers:userAuth})).status()).toBe(403);
      await page.getByRole('button',{name:'刷新列表',exact:true}).click();
      const status=await page.request.get('/api/v1/workflow/status',{headers:auth});
      if((await status.json()).enabled)await expect(page.getByRole('alert')).toBeVisible();
      await page.reload();await expect(page.getByRole('heading',{name:'流程管理',exact:true})).toHaveCount(0);
    }finally{await page.request.post('/logout',{headers:userAuth});}
  }finally{
    if(userId)expect((await page.request.delete('/api/v1/system/users',{headers:auth,data:{ids:[userId]}})).status()).toBe(204);
    if(roleId)expect((await page.request.delete('/api/v1/system/roles',{headers:auth,data:{ids:[roleId]}})).status()).toBe(204);
    await page.request.post('/logout',{headers:auth});
  }
});
