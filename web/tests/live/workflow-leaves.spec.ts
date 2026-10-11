import {test,expect,type Page} from '@playwright/test';

async function login(page:Page,path:string,username='admin',password='admin123'){
  await page.goto(path);await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('real leave request, separate approver, claim/approve/reject/withdraw and disabled pages',async({page,browser})=>{
  test.setTimeout(150000);
  await login(page,'/workflow/requests');
  const signed=await page.request.post('/api/v1/auth/login',{data:{username:'admin',password:'admin123'}});expect(signed.status()).toBe(200);
  const auth={Authorization:`Bearer ${(await signed.json()).accessToken}`};
  let userId:string|undefined,roleId:string|undefined;
  const approverContext=await browser.newContext({baseURL:new URL(page.url()).origin});
  try{
    const status=await page.request.get('/api/v1/workflow/status',{headers:auth});expect(status.status()).toBe(200);
    if(!(await status.json()).enabled){
      await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();await expect(page.getByRole('button',{name:'发起请假'})).toBeDisabled();
      await page.goto('/workflow/tasks');await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();return;
    }
    const stamp=Date.now(),username=`leave${stamp}`;
    const role=await page.request.post('/api/v1/system/roles',{headers:auth,data:{name:`审批${stamp}`,key:`leave${stamp}`,sort:10,status:'0',remark:'',menuLinked:false,menuKeys:['workflow','workflow-tasks','workflow-task-handle']}});expect(role.status()).toBe(201);roleId=(await role.json()).id;
    const user=await page.request.post('/api/v1/system/users',{headers:auth,data:{user:{username,displayName:'审批人',departmentId:'103',sex:'2',status:'0',roleIds:['2',roleId],postIds:[]},password:'Workflow123'}});expect(user.status()).toBe(201);userId=(await user.json()).id;
    await page.goto('/workflow/packages');await page.getByRole('button',{name:'新增流程包',exact:true}).click();
    const packageEditor=page.getByRole('region',{name:'新增流程包',exact:true});
    await packageEditor.getByLabel('流程名称',{exact:true}).fill(`浏览器审批${stamp}`);
    await expect(packageEditor.getByLabel('流程文件',{exact:true})).toHaveCount(0);
    await expect(packageEditor.getByRole('button',{name:'添加人工审批',exact:true})).toBeEnabled();
    await packageEditor.getByLabel('选择节点或连线').selectOption('review');
    await packageEditor.getByLabel('节点名称',{exact:true}).fill('画布编辑后的审批');
    await packageEditor.getByRole('button',{name:'应用属性',exact:true}).click();
    const creation=page.waitForResponse(response=>response.url().endsWith('/api/v1/workflow/packages')&&response.request().method()==='POST');
    await packageEditor.getByRole('button',{name:'保存草稿',exact:true}).click();
    const created=await creation;expect(created.status()).toBe(201);const packageId=(await created.json()).id;
    expect((await page.request.post(`/api/v1/workflow/packages/${packageId}/validation`,{headers:auth,data:{expectedRevision:'1'}})).status()).toBe(200);
    const published=await page.request.post(`/api/v1/workflow/packages/${packageId}/releases`,{headers:auth,data:{expectedRevision:'1'}});expect(published.status()).toBe(200);const release=await published.json();
    const active=await page.request.get('/api/v1/workflow/activations/leave',{headers:auth});expect(active.status()).toBe(200);
    expect((await page.request.put('/api/v1/workflow/activations/leave',{headers:auth,data:{releaseId:release.id,expectedRevision:(await active.json()).revision}})).status()).toBe(200);
    await page.goto('/workflow/requests');
    const approver=await approverContext.newPage();await login(approver,'/workflow/tasks',username,'Workflow123');
    for(const outcome of ['批准','拒绝','撤回']){
      const reason=`${outcome}申请${stamp}`;
      await page.getByRole('button',{name:'发起请假',exact:true}).click();const editor=page.getByRole('dialog',{name:'发起请假',exact:true});
      await editor.getByLabel('开始日期',{exact:true}).fill('2026-11-01');await editor.getByLabel('结束日期',{exact:true}).fill('2026-11-02');await editor.getByLabel('请假事由').fill(reason);
      const submitted=page.waitForResponse(response=>response.url().endsWith('/api/v1/workflow/leaves')&&response.request().method()==='POST');
      await editor.getByRole('button',{name:'提交申请'}).click();const submittedReply=await submitted;expect(submittedReply.status()).toBe(200);const leave=await submittedReply.json();expect(leave.releaseId).toBe(release.id);
      await expect(editor).toHaveCount(0);
      if(outcome==='撤回'){
        await page.getByRole('row').filter({has:page.getByRole('cell',{name:reason,exact:true})}).getByRole('button',{name:'详情'}).click();
        const detail=page.getByRole('dialog',{name:'请假审批详情'});await detail.getByRole('button',{name:'撤回申请'}).click();await detail.getByLabel('处理意见').fill('行程取消');await detail.getByRole('button',{name:'确认撤回'}).click();
        await expect(detail.getByText('已撤回',{exact:true})).toBeVisible();await detail.getByRole('button',{name:'关闭',exact:true}).click();
      }else{
        await approver.getByRole('button',{name:'待办',exact:true}).click();await approver.getByRole('button',{name:'刷新列表',exact:true}).click();
        await approver.getByRole('row').filter({has:approver.getByRole('cell',{name:reason,exact:true})}).getByRole('button',{name:'详情'}).click();const detail=approver.getByRole('dialog',{name:'请假审批详情'});
        await detail.getByRole('button',{name:'领取',exact:true}).click();await detail.getByRole('button',{name:'确认领取',exact:true}).click();
        if(outcome==='批准'){
          await expect(detail.getByRole('button',{name:'批准',exact:true})).toBeVisible();
          expect((await page.request.put(`/api/v1/system/users/${userId}/roles`,{headers:auth,data:{roleIds:[roleId]}})).status()).toBe(204);
          await detail.getByRole('button',{name:'重新读取',exact:true}).click();await expect(detail.getByRole('button',{name:'批准',exact:true})).toHaveCount(0);
          await expect(detail.getByRole('button',{name:'拒绝',exact:true})).toHaveCount(0);
          expect((await page.request.put(`/api/v1/system/users/${userId}/roles`,{headers:auth,data:{roleIds:['2',roleId]}})).status()).toBe(204);
          await detail.getByRole('button',{name:'重新读取',exact:true}).click();
        }
        await detail.getByRole('button',{name:outcome,exact:true}).click();await detail.getByLabel('处理意见').fill(`${outcome}，已核实`);await detail.getByRole('button',{name:`确认${outcome}`,exact:true}).click();
        await expect(detail.getByText(`已${outcome}`,{exact:true})).toBeVisible();await expect(detail.getByRole('button',{name:'领取',exact:true})).toHaveCount(0);
        await approver.screenshot({path:`test-results/live/workflow-leave-${outcome}.png`,fullPage:true});await detail.getByRole('button',{name:'关闭',exact:true}).click();
        await approver.getByRole('button',{name:'已办',exact:true}).click();await expect(approver.getByRole('cell',{name:reason,exact:true})).toBeVisible();
      }
      const read=await page.request.get(`/api/v1/workflow/leaves/${leave.id}`,{headers:auth});expect(read.status()).toBe(200);const detail=await read.json();
      expect(detail.leave.status).toBe(outcome==='批准'?'APPROVED':outcome==='拒绝'?'REJECTED':'WITHDRAWN');expect(detail.tasks).toEqual([]);
      expect(detail.history.map((event:{action:string})=>event.action)).toEqual(outcome==='撤回'?['SUBMIT','WITHDRAW']:['SUBMIT','CLAIM',outcome==='批准'?'APPROVE':'REJECT']);
    }
  }finally{
    await approverContext.close();
    if(userId)expect((await page.request.delete('/api/v1/system/users',{headers:auth,data:{ids:[userId]}})).status()).toBe(204);
    if(roleId)expect((await page.request.delete('/api/v1/system/roles',{headers:auth,data:{ids:[roleId]}})).status()).toBe(204);
    await page.request.post('/logout',{headers:auth});
  }
});
