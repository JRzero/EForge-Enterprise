import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
const id='00000000-0000-0000-0000-000000000001',revision='9007199254740993';
const row={id,name:'审批 <plain>',businessType:'leave',revision,validatedRevision:revision,updatedAt:'2026-10-10T01:00:00Z'};
const source={bpmnXml:'<process name="plain"/>',scenarios:[]};
async function login(page:Page,permissions:string[],enabled=true){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'reader',displayName:'测试账号'},roles:[],permissions,
    navigation:[{key:'workflow-packages',type:'ROUTE',routeId:'workflow-packages',label:'流程管理',order:0,children:[]}]}}));
  await page.route('**/api/v1/workflow/status',route=>route.fulfill({json:{enabled}}));
  await page.goto('/workflow/packages');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('workflow disabled state does not request unavailable package storage',async({page})=>{
  let reads=0;await page.route('**/api/v1/workflow/packages?*',route=>{reads++;return route.fulfill({status:503,json:{}});});
  await login(page,['workflow:definition:list','workflow:definition:edit'],false);
  await expect(page.getByText('工作流尚未启用，请联系管理员。')).toBeVisible();expect(reads).toBe(0);
  await expect(page.getByRole('button',{name:'新增流程包',exact:true})).toBeDisabled();
});
test('workflow readonly list retries, retains exact versions and fits supported viewport sizes',async({page})=>{
  let failing=true;
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill(failing?{status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}}:{json:{items:[row],total:1,page:1,pageSize:10}}));
  await login(page,['workflow:definition:list']);await expect(page.getByRole('alert')).toContainText('工作流存储暂不可用');failing=false;
  await page.getByRole('button',{name:'重试列表'}).click();await expect(page.getByRole('cell',{name:revision,exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:row.name,exact:true})).toBeVisible();
  for(const name of ['新增流程包','编辑','校验','发布'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`test-results/workflow-${width}.png`,fullPage:true}); const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))})); expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(width);}
});
test('workflow edit conflict retains unsaved source and never loses version precision',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  const writes:unknown[]=[];
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{...row,source}});
    writes.push(route.request().postDataJSON());return route.fulfill({status:409,json:{code:'WORKFLOW_PACKAGE_CONFLICT'}});
  });
  await login(page,['workflow:definition:list','workflow:definition:edit']);await page.getByRole('button',{name:'编辑',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'编辑流程包',exact:true});await editor.getByLabel('流程文件',{exact:true}).fill('<process name="changed"/>');
  await editor.getByRole('button',{name:'保存草稿'}).click();await expect(editor.getByRole('alert')).toContainText('流程版本已变化');
  await expect(editor.getByLabel('流程文件',{exact:true})).toHaveValue('<process name="changed"/>');
  expect(writes).toEqual([{expectedRevision:revision,content:{name:row.name,businessType:'leave',source:{bpmnXml:'<process name="changed"/>',scenarios:[]}}}]);
});
test('workflow publication and activation are separate confirmed actions',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>route.fulfill({json:{...row,source}}));
  let publishes=0,activates=0;
  await page.route(`**/api/v1/workflow/packages/${id}/releases`,route=>{publishes++;return route.fulfill({json:{id:'release',packageRevision:revision}});});
  await page.route(`**/api/v1/workflow/packages/${id}/releases?*`,route=>route.fulfill({json:{items:[{id:'release',name:row.name,packageRevision:revision}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/workflow/activations/leave',route=>{
    if(route.request().method()==='PUT'){activates++;expect(route.request().postDataJSON()).toEqual({releaseId:'release',expectedRevision:revision});return route.fulfill({status:409,json:{code:'WORKFLOW_RELEASE_CONFLICT'}});}
    return route.fulfill({json:{businessType:'leave',revision}});
  });
  await login(page,['workflow:definition:list','workflow:definition:publish','workflow:definition:activate']);
  await page.getByRole('button',{name:'发布',exact:true}).click();expect(publishes).toBe(0);
  await page.getByRole('alertdialog').getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.getByRole('alertdialog')).toHaveCount(0);expect(publishes).toBe(1);expect(activates).toBe(0);
  await page.getByRole('button',{name:'详情',exact:true}).click();const panel=page.getByRole('dialog',{name:'流程详情与发布版本'});
  await panel.getByRole('button',{name:`激活版本 ${revision}`,exact:true}).click();expect(activates).toBe(0);
  await panel.getByRole('button',{name:'确认激活',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('流程版本已变化');expect(activates).toBe(1);
  await page.screenshot({path:'test-results/workflow-release-desktop.png',fullPage:true});
  await page.setViewportSize({width:320,height:900});await expect(panel).toBeVisible();
  await expect.poll(async()=>{const bounds=await panel.boundingBox();return bounds?bounds.x>=0&&bounds.x+bounds.width<=320:false;}).toBe(true);
  await page.screenshot({path:'test-results/workflow-release-mobile.png',fullPage:true});
});

test('workflow comparison is read-only, keeps exact versions and safely retries at mobile width',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>route.fulfill({json:{...row,source}}));
  await page.route(`**/api/v1/workflow/packages/${id}/releases?*`,route=>route.fulfill({json:{items:[{id,name:row.name,packageRevision:revision}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/workflow/activations/leave',route=>route.fulfill({json:{revision:'0'}}));
  let failed=true;const queries:string[]=[];
  await page.route(`**/api/v1/workflow/packages/${id}/comparison?*`,route=>{
    expect(route.request().method()).toBe('GET');queries.push(route.request().url());
    return route.fulfill(failed?{status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}}:{json:{packageId:id,baseline:{revision},target:{kind:'DRAFT',revision:'9007199254740994'},fields:[{name:'bpmnXml',before:'<script>window.injected=true</script>',after:'<next/>',changed:true}]}});
  });
  await login(page,['workflow:definition:list']);await page.getByRole('button',{name:'详情',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'流程详情与发布版本'});
  await panel.getByRole('button',{name:`版本 ${revision} 设为基准`,exact:true}).click();
  await panel.getByRole('button',{name:'与当前草稿对比',exact:true}).click();
  const comparison=panel.getByRole('region',{name:'版本内容对比'});await expect(comparison.getByRole('alert')).toContainText('工作流存储暂不可用');
  failed=false;await comparison.getByRole('button',{name:'重新读取对比'}).click();
  await expect(comparison).toContainText('9007199254740994');await expect(comparison.locator('pre').first()).toHaveText('<script>window.injected=true</script>');
  expect(await page.evaluate(()=>Object.hasOwn(window,'injected'))).toBe(false);
  expect(new URL(queries[0]!).searchParams.has('targetReleaseId')).toBe(false);
  await panel.getByRole('button',{name:`比较版本 ${revision}`,exact:true}).click();
  await expect.poll(()=>new URL(queries.at(-1)!).searchParams.get('targetReleaseId')).toBe(id);
  await page.setViewportSize({width:320,height:900});await expect(comparison).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await comparison.locator('pre').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/workflow-comparison-mobile.png',fullPage:true});
});
