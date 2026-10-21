import {test,expect,type Page} from '@playwright/test';
async function login(page:Page,path:string,username='admin',password='admin123'){
  await page.goto(path);await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('real purchase designer, draft items, private attachment and designated approve/reject/withdraw',async({page,browser})=>{
  test.setTimeout(180000);
  await login(page,'/samples/purchases');
  const signed=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});expect(signed.status()).toBe(200);
  const auth={Authorization:`Bearer ${(await signed.json()).accessToken}`};
  const status=await page.request.get('/api/v1/workflow/status',{headers:auth});expect(status.status()).toBe(200);
  if(!(await status.json()).enabled){await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();await expect(page.getByRole('button',{name:'新增采购申请'})).toBeDisabled();return;}
  let roleId:string|undefined,userId:string|undefined;
  const separate=await browser.newContext({baseURL:new URL(page.url()).origin}),stamp=Date.now(),username=`buyer${stamp}`;
  try{
    const role=await page.request.post('/api/v1/system/roles',{headers:auth,data:{name:`采购${stamp}`,key:`purchase${stamp}`,sort:10,status:'0',remark:'owned fixture',menuLinked:false,menuKeys:['workflow','sample-purchases','sample-purchase-approve']}});expect(role.status()).toBe(201);roleId=(await role.json()).id;
    const user=await page.request.post('/api/v1/system/users',{headers:auth,data:{user:{username,displayName:`采购审批员${stamp}`,departmentId:'103',sex:'2',status:'0',roleIds:[roleId],postIds:[]},password:'Purchase123'}});expect(user.status()).toBe(201);userId=(await user.json()).id;
    await page.goto('/workflow/packages');await page.getByRole('button',{name:'新增流程包',exact:true}).click();const packageEditor=page.getByRole('region',{name:'新增流程包',exact:true});
    await packageEditor.getByRole('combobox',{name:'审批业务',exact:true}).selectOption('purchase');
    await packageEditor.getByLabel('流程名称',{exact:true}).fill(`采购模板${stamp}`);
    await expect(packageEditor.getByRole('button',{name:'添加人工审批',exact:true})).toBeEnabled();
    const creation=page.waitForResponse(response=>response.url().endsWith('/api/v1/workflow/packages')&&response.request().method()==='POST');
    await packageEditor.getByRole('button',{name:'保存草稿',exact:true}).click();const created=await creation;expect(created.status()).toBe(201);const packageId=(await created.json()).id;
    expect((await page.request.post(`/api/v1/workflow/packages/${packageId}/validation`,{headers:auth,data:{expectedRevision:'1'}})).status()).toBe(200);
    const publication=await page.request.post(`/api/v1/workflow/packages/${packageId}/releases`,{headers:auth,data:{expectedRevision:'1'}});expect(publication.status()).toBe(200);const release=await publication.json();
    const active=await page.request.get('/api/v1/workflow/activations/purchase',{headers:auth});expect(active.status()).toBe(200);
    expect((await page.request.put('/api/v1/workflow/activations/purchase',{headers:auth,data:{releaseId:release.id,expectedRevision:(await active.json()).revision}})).status()).toBe(200);
    await page.goto('/samples/purchases');const approver=await separate.newPage();await login(approver,'/samples/purchases',username,'Purchase123');
    for(const outcome of ['批准','拒绝','撤回']){
      const title=`${outcome}采购${stamp}`;await page.getByRole('button',{name:'新增采购申请',exact:true}).click();const editor=page.getByRole('dialog',{name:'新增采购申请'});
      await editor.getByRole('textbox',{name:'申请标题',exact:true}).fill(title);await editor.getByRole('textbox',{name:'采购事由',exact:true}).fill('采购 <安全文本>');
      await editor.getByRole('combobox',{name:'指定审批人'}).click();await editor.getByRole('searchbox',{name:'搜索指定审批人'}).fill(username);await editor.getByRole('option',{name:`采购审批员${stamp}`,exact:true}).click();
      await editor.getByLabel('第 1 行采购内容').fill('精确计价设备');await editor.getByLabel('第 1 行数量').fill('0.005');await editor.getByLabel('第 1 行单价').fill('1.00');
      const saving=page.waitForResponse(response=>response.url().endsWith('/api/v1/samples/purchases')&&response.request().method()==='POST');
      await editor.getByRole('button',{name:'保存草稿',exact:true}).click();const saved=await saving;expect(saved.status()).toBe(201);const purchase=await saved.json();expect(purchase.total).toBe('0.01');
      const detail=page.getByRole('dialog',{name:'采购申请详情'});await expect(detail.getByRole('button',{name:'提交审批',exact:true})).toBeVisible();
      if(outcome==='批准'){
        await detail.getByLabel('添加附件').setInputFiles({name:'采购报价.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nquotation\n%%EOF')});
        await detail.getByRole('button',{name:'确认操作',exact:true}).click();await expect(detail.getByRole('button',{name:'采购报价.pdf',exact:true})).toBeVisible();
        const files=await page.request.get(`/api/v1/samples/purchases/${purchase.id}/attachments`,{headers:auth});expect(files.status()).toBe(200);const file=(await files.json())[0];
        const anonymous=await page.request.get(`/api/v1/samples/purchases/${purchase.id}/attachments/${file.id}`);expect(anonymous.status()).toBe(401);
        const download=page.waitForEvent('download');await detail.getByRole('button',{name:'采购报价.pdf',exact:true}).click();expect((await download).suggestedFilename()).toBe('采购报价.pdf');
      }
      await detail.getByRole('button',{name:'提交审批',exact:true}).click();await detail.getByRole('button',{name:'确认操作',exact:true}).click();await expect(detail.getByText('审批中',{exact:true})).toBeVisible();
      if(outcome==='撤回'){
        await detail.getByRole('button',{name:'撤回申请'}).click();await detail.getByRole('button',{name:'确认操作',exact:true}).click();await expect(detail.getByText('已撤回',{exact:true})).toBeVisible();
      }else{
        await approver.getByRole('button',{name:'待我审批',exact:true}).click();await approver.getByRole('button',{name:'刷新列表',exact:true}).click();
        await approver.getByRole('row').filter({has:approver.getByRole('cell',{name:title,exact:true})}).getByRole('button',{name:'详情',exact:true}).click();
        const approval=approver.getByRole('dialog',{name:'采购申请详情'});await approval.getByRole('button',{name:outcome,exact:true}).click();await approval.getByLabel('处理意见').fill(`${outcome}，已核对`);
        await approval.getByRole('button',{name:'确认操作',exact:true}).click();await expect(approval.getByText(`已${outcome}`,{exact:true})).toBeVisible();
        await approval.getByRole('button',{name:'关闭详情'}).click();
      }
      await detail.getByRole('button',{name:'关闭详情'}).click();
      const final=await page.request.get(`/api/v1/samples/purchases/${purchase.id}`,{headers:auth});expect(final.status()).toBe(200);const finalData=await final.json();
      expect(finalData.purchase.status).toBe(outcome==='批准'?'APPROVED':outcome==='拒绝'?'REJECTED':'WITHDRAWN');expect(finalData.purchase.releaseId).toBe(release.id);expect(finalData.purchase.total).toBe('0.01');
    }
  }finally{
    await separate.close();
    if(userId)expect((await page.request.delete('/api/v1/system/users',{headers:auth,data:{ids:[userId]}})).status()).toBe(204);
    if(roleId)expect((await page.request.delete('/api/v1/system/roles',{headers:auth,data:{ids:[roleId]}})).status()).toBe(204);
    await page.request.post('/logout',{headers:auth});
  }
});
