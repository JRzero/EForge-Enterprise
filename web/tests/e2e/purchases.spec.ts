import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
import type {PurchaseCreateRequest,PurchaseDecisionRequest} from '../../generated/api';
const id='00000000-0000-0000-0000-000000000001';
const purchase={id,initiatorId:'2',approverId:'3',title:'设备 <采购>',reason:'办公设备',total:'0.02',status:'DRAFT',revision:'9007199254740993',createdAt:'2026-10-21T01:00:00Z'};
const item={id:'line',name:'螺丝',unit:'件',quantity:'0.500',unitPrice:'0.01',amount:'0.01'};
async function login(page:Page,actor='2',permissions=['sample:purchase:list','sample:purchase:write'],enabled=true){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:actor,username:'buyer',displayName:'采购员'},roles:[],permissions,
    navigation:[{key:'sample-purchases',type:'ROUTE',routeId:'sample-purchases',label:'采购审批',order:0,children:[]}]}}));
  await page.route('**/api/v1/workflow/status',route=>route.fulfill({json:{enabled}}));
  await page.goto('/samples/purchases');await page.getByLabel('账号',{exact:true}).fill('buyer');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('purchase editor keeps exact decimals and replays a lost save response with the same command',async({page})=>{
  const saved:PurchaseCreateRequest[]=[];
  await page.route('**/api/v1/samples/purchases?*',route=>{expect(new URL(route.request().url()).searchParams.get('status')).toBe('');return route.fulfill({json:{items:[],total:0,page:1,pageSize:10}});});
  await page.route('**/api/v1/samples/purchases/approvers?*',route=>route.fulfill({json:{items:[{id:'3',name:'指定审批员'}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/samples/purchases',route=>{
    saved.push(route.request().postDataJSON());return saved.length===1?route.fulfill({status:503,json:{code:'PURCHASE_STORAGE_UNAVAILABLE'}}):route.fulfill({status:201,json:purchase});
  });
  await page.route(`**/api/v1/samples/purchases/${id}`,route=>route.fulfill({json:{purchase,items:[item],history:[]}}));
  await page.route(`**/api/v1/samples/purchases/${id}/attachments`,route=>route.fulfill({json:[]}));
  await login(page);await page.getByRole('button',{name:'新增采购申请'}).click();const editor=page.getByRole('dialog',{name:'新增采购申请'});
  await editor.getByRole('textbox',{name:'申请标题',exact:true}).fill('设备 <采购>');await editor.getByRole('textbox',{name:'采购事由',exact:true}).fill('办公设备');
  await editor.getByRole('combobox',{name:'指定审批人'}).click();await editor.getByRole('option',{name:'指定审批员'}).click();
  await editor.getByLabel('第 1 行采购内容').fill('螺丝');await editor.getByLabel('第 1 行数量').fill('5e-3');await editor.getByLabel('第 1 行单价').fill('0.01');
  await editor.getByRole('button',{name:'保存草稿',exact:true}).click();expect(saved).toHaveLength(0);expect(await editor.getByLabel('第 1 行数量').evaluate((element:HTMLInputElement)=>element.validity.patternMismatch)).toBe(true);
  await editor.getByLabel('第 1 行数量').fill('0.500');
  await editor.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('textbox',{name:'申请标题',exact:true})).toBeDisabled();await editor.getByRole('button',{name:'重试保存',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'采购申请详情'})).toBeVisible();expect(saved).toHaveLength(2);expect(saved[1]).toEqual(saved[0]);
  expect(saved[0]!.content.items[0]).toMatchObject({quantity:'0.500',unitPrice:'0.01'});expect(saved[0]!.content).not.toHaveProperty('total');
});
test('designated approver confirms once with exact revision and sees inert history on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});let current={...purchase,status:'PENDING'};const commands:PurchaseDecisionRequest[]=[];
  await page.route('**/api/v1/samples/purchases?*',route=>route.fulfill({json:{items:[current],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/samples/purchases/${id}`,route=>route.fulfill({json:{purchase:current,items:[item],history:[{action:'SUBMIT',actorId:'2',comment:'<img src=x onerror=alert(1)>',createdAt:purchase.createdAt}]}}));
  await page.route(`**/api/v1/samples/purchases/${id}/attachments`,route=>route.fulfill({json:[]}));
  await page.route(`**/api/v1/samples/purchases/${id}/decision`,route=>{commands.push(route.request().postDataJSON());current={...current,status:'APPROVED'};return route.fulfill({json:current});});
  await login(page,'3',['sample:purchase:list','sample:purchase:approve']);await page.getByRole('button',{name:'待我审批',exact:true}).click();
  await page.getByRole('button',{name:'详情',exact:true}).click();const detail=page.getByRole('dialog',{name:'采购申请详情'});
  await expect(detail.getByRole('button',{name:'编辑草稿'})).toHaveCount(0);await expect(detail.locator('img')).toHaveCount(0);
  await detail.getByRole('button',{name:'批准',exact:true}).click();expect(commands).toHaveLength(0);await detail.getByLabel('处理意见').fill('同意');
  await detail.getByRole('button',{name:'确认操作',exact:true}).click();await expect(detail.getByText('已批准',{exact:true})).toBeVisible();
  expect(commands).toHaveLength(1);expect(commands[0]).toMatchObject({approved:true,command:{expectedRevision:'9007199254740993',comment:'同意'}});
  await page.screenshot({path:'test-results/purchase-detail-mobile.png',fullPage:true});
});
test('disabled engine does not query purchase storage',async({page})=>{
  let reads=0;await page.route('**/api/v1/samples/purchases**',route=>{reads++;return route.fulfill({status:503,json:{}});});await login(page,'2',['sample:purchase:list','sample:purchase:write'],false);
  await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();expect(reads).toBe(0);await expect(page.getByRole('button',{name:'新增采购申请'})).toBeDisabled();
});
