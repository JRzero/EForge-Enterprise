import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
const id='00000000-0000-0000-0000-000000000001',revision='9007199254740993';
const leave={id,submissionId:id,initiatorId:'2',releaseId:id,processId:'process',startDate:'2026-11-01',endDate:'2026-11-02',reason:'家庭事务 <安全文本>',status:'PENDING',revision,createdAt:'2026-10-10T01:00:00Z'};
async function login(page:Page,routeId:string,permissions:string[],enabled=true){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'reader',displayName:'审批账号'},roles:[],permissions,
    navigation:[{key:routeId,type:'ROUTE',routeId,label:'审批',order:0,children:[]}]}}));
  await page.route('**/api/v1/workflow/status',route=>route.fulfill({json:{enabled}}));
  await page.goto(routeId==='workflow-tasks'?'/workflow/tasks':'/workflow/requests');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('disabled approvals never read business tables',async({page})=>{
  let reads=0;await page.route('**/api/v1/workflow/leaves/**',route=>{reads++;return route.fulfill({status:503,json:{}});});
  await login(page,'workflow-requests',['workflow:request:list','workflow:request:submit'],false);
  await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();expect(reads).toBe(0);
  await expect(page.getByRole('button',{name:'发起请假'})).toBeDisabled();
});
test('submission retry retains its identity and user input',async({page})=>{
  await page.route('**/api/v1/workflow/leaves/mine?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  const writes:Record<string,unknown>[]=[];await page.route('**/api/v1/workflow/leaves',route=>{writes.push(route.request().postDataJSON());return route.fulfill(writes.length===1?{status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}}:{json:leave});});
  await login(page,'workflow-requests',['workflow:request:list','workflow:request:submit']);await page.getByRole('button',{name:'发起请假'}).click();
  const dialog=page.getByRole('dialog',{name:'发起请假'});await dialog.getByLabel('开始日期',{exact:true}).fill('2026-11-01');await dialog.getByLabel('结束日期',{exact:true}).fill('2026-11-02');await dialog.getByLabel('请假事由').fill('家庭事务');
  await dialog.getByRole('button',{name:'提交申请'}).click();await expect(dialog.getByRole('alert')).toContainText('存储暂不可用');await expect(dialog.getByLabel('请假事由')).toHaveValue('家庭事务');
  await dialog.getByRole('button',{name:'提交申请'}).click();await expect(dialog).toHaveCount(0);expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);expect(writes[0]?.submissionId).toMatch(/^[a-f0-9-]{36}$/);
});
test('approval confirmation keeps exact revision and same command on a failed retry',async({page})=>{
  const task={id:'task-1',key:'review',name:'主管审批',assignee:'2'};let canHandle=true;
  await page.route('**/api/v1/workflow/leaves/pending?*',route=>route.fulfill({json:{items:[{leave,task,canHandle:true}],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/leaves/${id}`,route=>route.fulfill({json:{leave,tasks:[{...task,canHandle}],history:[{action:'SUBMIT',actorId:'2',comment:'',createdAt:leave.createdAt}]}}));
  const commands:Record<string,unknown>[]=[];await page.route(`**/api/v1/workflow/leaves/${id}/decision`,route=>{commands.push(route.request().postDataJSON());return route.fulfill({status:409,json:{code:'WORKFLOW_LEAVE_CONFLICT'}});});
  await login(page,'workflow-tasks',['workflow:task:list','workflow:task:handle']);await page.getByRole('button',{name:'详情',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'请假审批详情'});await dialog.getByRole('button',{name:'批准',exact:true}).click();expect(commands).toHaveLength(0);
  await dialog.getByLabel('处理意见').fill('同意');await dialog.getByRole('button',{name:'确认批准'}).click();await expect(dialog.getByRole('alert')).toContainText('审批版本已变化');
  await expect(dialog.getByLabel('处理意见')).toBeDisabled();await dialog.getByRole('button',{name:'确认批准'}).click();await expect.poll(()=>commands.length).toBe(2);
  expect(commands[0]).toEqual(commands[1]);expect(commands[0]).toMatchObject({approved:true,command:{expectedRevision:revision,taskId:'task-1',comment:'同意'}});
  for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:900});await expect.poll(async()=>{const bounds=await dialog.boundingBox();return bounds?bounds.x>=0&&bounds.x+bounds.width<=width:false;}).toBe(true);await page.screenshot({path:`test-results/workflow-leave-${width}.png`,fullPage:true});}
  canHandle=false;await dialog.getByRole('button',{name:'重新读取',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'批准',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'拒绝',exact:true})).toHaveCount(0);
});
test('read-only task details omit all mutation controls and read errors can retry',async({page})=>{
  let failed=true;await page.route('**/api/v1/workflow/leaves/pending?*',route=>route.fulfill(failed?{status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}}:{json:{items:[{leave,task:{id:'task-1',key:'review'},canHandle:true}],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/leaves/${id}`,route=>route.fulfill({json:{leave,tasks:[{id:'task-1',key:'review'}],history:[]}}));
  await login(page,'workflow-tasks',['workflow:task:list']);await expect(page.getByRole('alert')).toBeVisible();failed=false;await page.getByRole('button',{name:'重试列表'}).click();await page.getByRole('button',{name:'详情',exact:true}).click();
  for(const label of ['领取','批准','拒绝','撤回申请'])await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText(leave.reason,{exact:true})).toBeVisible();
});
