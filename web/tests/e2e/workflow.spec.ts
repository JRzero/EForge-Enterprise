import {test,expect} from './fixtures';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const id='00000000-0000-0000-0000-000000000001',revision='9007199254740993';
const row={id,name:'审批 <plain>',businessType:'leave',revision,validatedRevision:revision,updatedAt:'2026-10-10T01:00:00Z'};
const source={bpmnXml:'<process name="plain"/>',scenarios:[]};
const designerSource=readFileSync(new URL('../../../workflows/leave-approval/process.bpmn20.xml',import.meta.url),'utf8');
async function login(page:Page,permissions:string[],enabled=true){
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'reader',displayName:'测试账号'},roles:[],permissions,
    navigation:[{key:'workflow-packages',type:'ROUTE',routeId:'workflow-packages',label:'流程管理',order:0,children:[]}]}}));
  await page.route('**/api/v1/workflow/status',route=>route.fulfill({json:{enabled}}));
  await page.goto('/workflow/packages');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}

test('visual workflow designer edits real shapes, preserves Flowable XML and protects conflicting drafts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  let written='';
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{...row,source:{bpmnXml:designerSource,scenarios:[]}}});
    written=route.request().postDataJSON().content.source.bpmnXml;return route.fulfill({status:409,json:{code:'WORKFLOW_PACKAGE_CONFLICT'}});
  });
  await login(page,['workflow:definition:list','workflow:definition:edit']);await page.getByRole('button',{name:'编辑',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'编辑流程包',exact:true});
  await expect(editor.getByLabel('流程文件',{exact:true})).toHaveCount(0);
  await expect(editor.getByLabel('审批场景',{exact:true})).not.toBeVisible();
  const designer=editor.getByRole('region',{name:'可视化流程设计器',exact:true});
  await expect(designer.getByRole('button',{name:'添加人工审批',exact:true})).toBeEnabled();
  await expect(designer.locator('.djs-element[data-element-id="review"]')).toBeVisible();
  await editor.getByText('高级配置 · 审批验证场景',{exact:true}).click();
  await expect(editor.getByLabel('审批场景',{exact:true})).toHaveValue('[]');
  await editor.getByText('高级配置 · 审批验证场景',{exact:true}).click();
  await designer.getByLabel('选择节点或连线').selectOption('review');
  await page.setViewportSize({width:1440,height:1100});
  await designer.scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/designer-guided.png',fullPage:true});
  await designer.locator('.workflow-designer-canvas').evaluate(async element=>{
    element.setAttribute('style','display:none');await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    element.removeAttribute('style');await new Promise(requestAnimationFrame);
  });
  await designer.locator('.djs-element[data-element-id="approvedEnd_label"]').click();
  await expect(designer.getByLabel('节点标识',{exact:true})).toHaveValue('approvedEnd');
  await designer.getByLabel('节点名称',{exact:true}).fill('批准完成');await designer.getByRole('button',{name:'应用属性',exact:true}).click();
  await expect(designer.locator('.djs-shape[data-element-id="approvedEnd"]')).toBeVisible();
  await designer.getByLabel('选择节点或连线').selectOption('review');await designer.getByLabel('节点名称',{exact:true}).fill('主管复核 <安全文本>');
  await editor.getByRole('button',{name:'返回 XML 源码'}).click();await expect(editor.getByRole('alert')).toContainText('应用属性');
  await designer.getByLabel('选择节点或连线').selectOption('start');await expect(designer.getByLabel('节点名称',{exact:true})).toHaveValue('主管复核 <安全文本>');
  await designer.getByRole('button',{name:'应用属性',exact:true}).click();
  await designer.getByRole('button',{name:'撤销',exact:true}).click();await expect(designer.getByLabel('节点名称',{exact:true})).not.toHaveValue('主管复核 <安全文本>');
  await designer.getByRole('button',{name:'重做',exact:true}).click();await expect(designer.getByLabel('节点名称',{exact:true})).toHaveValue('主管复核 <安全文本>');
  const shape=designer.locator('.djs-shape[data-element-id="review"] .djs-visual');const bounds=await shape.boundingBox();expect(bounds).toBeTruthy();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width/2+45,bounds!.y+bounds!.height/2+30,{steps:8});await page.mouse.up();
  await editor.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('流程版本已变化');
  expect(written).toContain('BPMNDiagram');expect(written).toContain('candidateGroups="role:2"');expect(written).toContain('主管复核');
  await editor.getByRole('button',{name:'返回 XML 源码'}).click();await expect(editor.getByLabel('流程文件',{exact:true})).toHaveValue(written);
  await editor.getByRole('button',{name:'可视化设计',exact:true}).click();await expect(designer.getByRole('button',{name:'添加人工审批'})).toBeEnabled();
  await designer.getByRole('button',{name:'添加人工审批'}).click();
  const added=await designer.getByLabel('节点标识',{exact:true}).inputValue();expect(added).not.toBe('review');
  await designer.getByLabel('连接到').selectOption('review');await designer.getByRole('button',{name:'连接节点',exact:true}).click();
  await designer.getByLabel('选择节点或连线').selectOption(added);await designer.getByRole('button',{name:'删除所选',exact:true}).click();
  await expect(designer.locator(`.djs-shape[data-element-id="${added}"]`)).toHaveCount(0);
  await designer.getByRole('button',{name:'撤销',exact:true}).click();await expect(designer.locator(`.djs-shape[data-element-id="${added}"]`)).toBeVisible();
  await designer.getByRole('button',{name:'重做',exact:true}).click();await expect(designer.locator(`.djs-shape[data-element-id="${added}"]`)).toHaveCount(0);
  for(const width of [1440,1024,768,320]){await page.setViewportSize({width,height:900});await designer.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/designer-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:1440,height:900});
  await editor.getByRole('button',{name:'返回 XML 源码'}).click();
  const xml=await editor.getByLabel('流程文件',{exact:true}).inputValue();
  const download=page.waitForEvent('download');await editor.getByRole('button',{name:'导出 BPMN',exact:true}).click();
  expect(readFileSync((await (await download).path())!,'utf8')).toBe(xml);
  await editor.getByLabel('导入 BPMN 文件').setInputFiles({name:'bad.xml',mimeType:'application/xml',buffer:Buffer.from('<broken>')});
  await expect(editor.getByRole('alert')).toContainText('原草稿内容已保留');await expect(editor.getByLabel('流程文件',{exact:true})).toHaveValue(xml);
  await editor.getByLabel('导入 BPMN 文件').setInputFiles({name:'workflow.bpmn',mimeType:'application/xml',buffer:Buffer.from(xml)});
  await expect(editor.getByRole('alert')).toHaveCount(0);
  await editor.getByLabel('流程文件',{exact:true}).fill(xml.replace('flowable:candidateGroups="role:2"','flowable:assignee="${approver}"'));
  await editor.getByRole('button',{name:'可视化设计',exact:true}).click();await expect(designer.getByRole('button',{name:'添加人工审批'})).toBeEnabled();
  await designer.getByLabel('选择节点或连线').selectOption('review');await designer.getByLabel('节点名称',{exact:true}).fill('动态审批人');
  await designer.getByRole('button',{name:'应用属性',exact:true}).click();
  await editor.getByRole('button',{name:'返回 XML 源码'}).click();
  const dynamicXml=await editor.getByLabel('流程文件',{exact:true}).inputValue();expect(dynamicXml).toContain('flowable:assignee="${approver}"');
  await editor.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByRole('alertdialog',{name:'有未保存的修改'})).toBeVisible();
  await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(editor.getByLabel('流程文件',{exact:true})).toHaveValue(dynamicXml);
  expect(errors).toEqual([]);
});
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

test('failed workflow jobs require confirmation, retain command on failure and report queued only',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>route.fulfill({json:{...row,source}}));
  await page.route(`**/api/v1/workflow/packages/${id}/releases?*`,route=>route.fulfill({json:{items:[{id,name:row.name,packageRevision:revision}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/workflow/activations/leave',route=>route.fulfill({json:{revision:'0'}}));
  let readFailure=true,queued=false;const writes:unknown[]=[];
  await page.route(`**/api/v1/workflow/releases/${id}/failed-jobs?*`,route=>route.fulfill(readFailure?{status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}}:{json:{page:{items:queued?[]:[{id:'job-1',processId:'process <safe>',releaseId:id,leaveId:id,elementId:'review',retries:0,createdAt:'2026-10-10T00:00:00Z'}],total:queued?0:1,page:1,pageSize:10},recoveryEnabled:true}}));
  await page.route('**/api/v1/workflow/jobs/job-1/retry',route=>{
    writes.push(route.request().postDataJSON());if(writes.length===1)return route.fulfill({status:503,json:{code:'WORKFLOW_STORAGE_UNAVAILABLE'}});
    queued=true;return route.fulfill({status:202,json:{status:'QUEUED'}});
  });
  await login(page,['workflow:definition:list','workflow:operation:list','workflow:operation:retry']);
  await page.getByRole('button',{name:'详情',exact:true}).click();await page.getByRole('button',{name:`版本 ${revision} 失败作业`,exact:true}).click();
  const panel=page.getByRole('region',{name:'失败作业运维',exact:true});await expect(panel.getByRole('alert')).toContainText('工作流存储暂不可用');
  readFailure=false;await panel.getByRole('button',{name:'刷新失败作业'}).click();await expect(panel.getByRole('cell',{name:'process <safe>',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'恢复作业',exact:true}).click();expect(writes).toHaveLength(0);
  await panel.getByRole('button',{name:'确认恢复',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('工作流存储暂不可用');
  await panel.getByRole('button',{name:'确认恢复',exact:true}).click();await expect(panel.getByText('恢复请求已入队。请刷新查看结果；审批仍需人工处理。')).toBeVisible();
  expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
  await expect(panel.getByRole('button',{name:'恢复作业',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:320,height:900});await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({path:'test-results/workflow-jobs-mobile.png',fullPage:true});
});

test('workflow read-only operation grant hides retry and executor-disabled mode explains restriction',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>route.fulfill({json:{...row,source}}));
  await page.route(`**/api/v1/workflow/packages/${id}/releases?*`,route=>route.fulfill({json:{items:[{id,name:row.name,packageRevision:revision}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/workflow/activations/leave',route=>route.fulfill({json:{revision:'0'}}));
  await page.route(`**/api/v1/workflow/releases/${id}/failed-jobs?*`,route=>route.fulfill({json:{page:{items:[{id:'job-1',processId:'process',releaseId:id,leaveId:id,elementId:'review',retries:0,createdAt:'2026-10-10T00:00:00Z'}],total:1,page:1,pageSize:10},recoveryEnabled:false}}));
  await login(page,['workflow:definition:list','workflow:operation:list']);await page.getByRole('button',{name:'详情',exact:true}).click();
  await page.getByRole('button',{name:`版本 ${revision} 失败作业`,exact:true}).click();
  await expect(page.getByText('当前环境未启用异步恢复，只能查看失败作业。')).toBeVisible();
  await expect(page.getByRole('button',{name:'恢复作业',exact:true})).toHaveCount(0);
});

test('workflow activation blocks overlapping recovery until its response completes',async({page})=>{
  await page.route('**/api/v1/workflow/packages?*',route=>route.fulfill({json:{items:[row],total:1,page:1,pageSize:10}}));
  await page.route(`**/api/v1/workflow/packages/${id}`,route=>route.fulfill({json:{...row,source}}));
  await page.route(`**/api/v1/workflow/packages/${id}/releases?*`,route=>route.fulfill({json:{items:[{id,name:row.name,packageRevision:revision}],total:1,page:1,pageSize:10}}));
  let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});let activating=false;
  await page.route('**/api/v1/workflow/activations/leave',async route=>{
    if(route.request().method()==='PUT'){activating=true;await gate;return route.fulfill({json:{revision:'1',releaseId:id}});}
    return route.fulfill({json:{revision:'0'}});
  });
  await page.route(`**/api/v1/workflow/releases/${id}/failed-jobs?*`,route=>route.fulfill({json:{page:{items:[{id:'job-1',processId:'process',releaseId:id,leaveId:id,elementId:'review',retries:0,createdAt:'2026-10-10T00:00:00Z'}],total:1,page:1,pageSize:10},recoveryEnabled:true}}));
  try{
    await login(page,['workflow:definition:list','workflow:definition:activate','workflow:operation:list','workflow:operation:retry']);
    await page.getByRole('button',{name:'详情',exact:true}).click();await page.getByRole('button',{name:`版本 ${revision} 失败作业`,exact:true}).click();
    await expect(page.getByRole('button',{name:'恢复作业',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:`激活版本 ${revision}`,exact:true}).click();await page.getByRole('button',{name:'确认激活',exact:true}).click();
    await expect.poll(()=>activating).toBe(true);
    await expect(page.getByRole('button',{name:'恢复作业',exact:true})).toBeDisabled();
    await expect(page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true})).toBeDisabled();
  }finally{finish();}
});
