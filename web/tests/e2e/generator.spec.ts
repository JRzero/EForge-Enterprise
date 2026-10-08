import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
const id='9007199254740993';
const table={id,name:'ef_test',comment:'<img src=x onerror=alert(1)>',className:'Example',category:'crud',webType:'eforge-react'};

test('generator component visual review covers all configuration panels without writing',async({page},info)=>{
  const detail={table:{...table,comment:'示例业务表'},configuration:{packageName:'io.example',moduleName:'sample',businessName:'example',functionName:'示例管理',author:'作者',formColumns:2,outputType:'0',outputPath:'/',options:{parentMenuId:'0',generateDetail:false}},columns:[{id:'11',name:'entry_id',databaseType:'bigint',primaryKey:true,javaType:'Long',javaField:'entryId',comment:'编号',required:false,insertable:false,editable:false,listed:true,queryable:false,queryType:'EQ',controlType:'input',order:0}],tables:[]};
  let writes=0;
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[detail.table],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/tables/'+id,route=>{if(route.request().method()!=='GET')writes++;return route.fulfill({json:detail});});
  await page.setViewportSize({width:1440,height:1000});
  await login(page,['tool:gen:list','tool:gen:query','tool:gen:edit']);
  await page.getByRole('button',{name:'编辑 ef_test',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('tablist')).toBeVisible();
  for(const [label,name] of [['基本信息','basic'],['字段信息','fields'],['生成信息','output']] as const) {
    await dialog.getByRole('tab',{name:label,exact:true}).click();
    await page.screenshot({path:info.outputPath(name+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(name+'-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
  }
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  expect(writes).toBe(0);
});
async function login(page:Page,permissions:string[],roles:string[]=[]){
  await page.route('**/api/v1/tool/generator/menu-options',route=>route.fulfill({json:[{id:'3',parentId:'0',name:'系统工具',kind:'M'},{id:'9007199254740995',parentId:'3',name:'选择菜单',kind:'C'},{id:'9007199254740996',parentId:'9007199254740995',name:'功能',kind:'F'}]}));
  await page.route('**/api/v1/system/dictionaries/options',route=>route.fulfill({json:[{id:'1',name:'通用状态',code:'sys_common_status',status:'0'}]}));
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'reader',displayName:'账号'},roles,permissions,navigation:[{key:'tool',type:'GROUP',label:'系统工具',order:0,children:[{key:'tool-generator',type:'ROUTE',routeId:'tool-generator',label:'代码生成',order:1,children:[]}]}]}}));
  await page.goto('/gen');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
}
test('generator list retry, server filters, inert values and original permission gates',async({page})=>{
  let fail=true;const queries:URLSearchParams[]=[];
  await page.route('**/api/v1/tool/generator/tables?*',route=>{queries.push(new URL(route.request().url()).searchParams);return route.fulfill(fail?{status:503,json:{}}:{json:{items:[table],total:1,page:1,pageSize:10}});});
  await login(page,['tool:gen:list']);await expect(page.getByRole('alert')).toContainText('服务暂时不可用');fail=false;await page.getByRole('button',{name:'重试列表'}).click();
  await expect(page.getByRole('cell',{name:id,exact:true})).toBeVisible();await expect(page.locator('.generator-page img,.generator-page script')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'导入表',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'创建表',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'编辑 ef_test',exact:true})).toHaveCount(0);
  await page.getByLabel('表名称筛选',{exact:true}).fill('x & 中文');await page.getByRole('button',{name:'查询',exact:true}).click();await expect.poll(()=>queries.at(-1)?.get('name')).toBe('x & 中文');
  await page.getByLabel('排序字段',{exact:true}).selectOption('name');await expect.poll(()=>queries.at(-1)?.get('sort')).toBe('name');
  await page.getByLabel('开始日期',{exact:true}).fill('2026-10-01');await page.getByLabel('结束日期',{exact:true}).fill('2026-10-07');await page.getByRole('button',{name:'查询',exact:true}).click();await expect.poll(()=>queries.at(-1)?.get('from')).toBe('2026-10-01');expect(queries.at(-1)?.get('to')).toBe('2026-10-07');await page.getByRole('button',{name:'重置',exact:true}).click();await expect.poll(()=>queries.at(-1)?.get('name')).toBe('');
});
test('generator import selection and metadata deletion send exact identities after confirmation',async({page})=>{
  let imported:unknown,deleted:unknown;
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[table],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/database-tables?*',route=>route.fulfill({json:{items:[{name:'待导入表',comment:'文本'},{name:'__proto__',comment:'合法表名称'}],total:2,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/imports',route=>{imported=route.request().postDataJSON();return route.fulfill({status:201,json:{tables:[]}});});
  await page.route('**/api/v1/tool/generator/tables',route=>{deleted=route.request().postDataJSON();return route.fulfill({status:204});});
  await login(page,['tool:gen:list','tool:gen:import','tool:gen:remove']);await page.getByRole('button',{name:'导入表',exact:true}).click();await page.getByRole('checkbox',{name:'选择待导入表 待导入表',exact:true}).check();await page.getByRole('checkbox',{name:'选择待导入表 __proto__',exact:true}).check();await page.getByRole('button',{name:'导入所选表',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(imported).toEqual({names:['待导入表','__proto__']});
  await page.getByRole('button',{name:'删除 ef_test',exact:true}).click();await page.keyboard.press('Escape');expect(deleted).toBeUndefined();await page.getByRole('button',{name:'删除 ef_test',exact:true}).click();await page.getByRole('button',{name:'确认操作',exact:true}).click();await expect(page.getByRole('alertdialog')).toHaveCount(0);expect(deleted).toEqual({ids:[id]});
});

test('generator creation partial results remain visible without automatic DDL retry',async({page})=>{
  let writes=0;
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[table],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/creations',route=>{writes++;return route.fulfill({status:409,json:{code:'GENERATOR_CREATE_PARTIAL',detail:'private database secret',creation:{physical:[{name:'新建表',state:'CREATED'},{name:'失败表',state:'FAILED'},{name:'待处理表',state:'UNATTEMPTED'}],importState:'UNATTEMPTED',imported:[]}}});});
  await login(page,['tool:gen:list'],['admin']);await page.getByRole('button',{name:'创建表',exact:true}).click();await page.getByLabel('建表 SQL',{exact:true}).fill('CREATE TABLE 新建表 (id bigint)');await page.getByRole('button',{name:'执行建表',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('建表结果')).toContainText('新建表：已创建');await expect(dialog).toContainText('失败表：失败');await expect(dialog).toContainText('待处理表：未尝试');await expect(dialog).not.toContainText('private database secret');expect(writes).toBe(1);await page.getByRole('button',{name:'关闭',exact:true}).click();expect(writes).toBe(1);
});
test('generator editing preserves selected template, exact fields and edits after failed save',async({page})=>{
  const detail={table,configuration:{packageName:'io.example',moduleName:'sample',businessName:'example',functionName:'功能',author:'作者',formColumns:1,outputType:'0',outputPath:'/',options:{parentMenuId:'0',generateDetail:false}},columns:[{id:'9007199254740994',name:'entry_id',databaseType:'bigint',primaryKey:true,javaType:'Long',javaField:'entryId',comment:'编号',required:false,insertable:false,editable:false,listed:true,queryable:false,queryType:'EQ',controlType:'input',order:0}],tables:[]};
  let saved:unknown,fail=true;
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[table],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/tables/'+id,route=>{if(route.request().method()==='PUT'){saved=route.request().postDataJSON();return route.fulfill(fail?{status:409,json:{code:'GENERATOR_CONFLICT'}}:{status:204});}return route.fulfill({json:detail});});
  await login(page,['tool:gen:list','tool:gen:query','tool:gen:edit']);await page.getByRole('button',{name:'编辑 ef_test',exact:true}).click();const dialog=page.getByRole('dialog');await page.getByRole('tab',{name:'生成信息',exact:true}).click();await dialog.getByLabel('上级菜单',{exact:true}).selectOption('9007199254740995');await dialog.getByLabel('前端类型',{exact:true}).selectOption('element-plus-typescript');await page.getByLabel('生成功能名',{exact:true}).fill('保留修改');await page.getByRole('button',{name:'保存配置',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(page.getByLabel('生成功能名',{exact:true})).toHaveValue('保留修改');expect(saved).toMatchObject({webType:'element-plus-typescript',functionName:'保留修改',options:{parentMenuId:'9007199254740995'},columns:[{id:'9007199254740994',javaField:'entryId'}]});fail=false;await page.getByRole('button',{name:'保存配置',exact:true}).click();await expect(dialog).toHaveCount(0);
});
test('generator options fail independently, preserve stored parent/dictionary and retry without clearing draft',async({page})=>{
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[table],total:1,page:1,pageSize:10}}));
  const detail={table,configuration:{packageName:'io.example',moduleName:'sample',businessName:'example',functionName:'功能',author:'作者',formColumns:1,outputType:'0',outputPath:'/custom',options:{parentMenuId:'9007199254740997',parentMenuName:'原有目录',generateDetail:false}},columns:[{id:'9007199254740994',name:'name',databaseType:'varchar(64)',javaType:'String',javaField:'name',comment:'名称',required:true,insertable:true,editable:true,listed:true,queryable:true,queryType:'LIKE',controlType:'select',dictionaryType:'stored_type',order:0}],tables:[]};
  await page.route('**/api/v1/tool/generator/tables/'+id,route=>route.fulfill({json:detail}));
  await login(page,['tool:gen:list','tool:gen:query','tool:gen:edit']);let fail=true;
  await page.route('**/api/v1/tool/generator/menu-options',route=>route.fulfill(fail?{status:503,json:{}}:{json:[{id:'3',parentId:'0',name:'系统工具',kind:'M'}]}));
  await page.getByRole('button',{name:'编辑 ef_test',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('tab',{name:'基本信息',exact:true}).focus();await page.keyboard.press('End');await expect(dialog.getByRole('tab',{name:'生成信息',exact:true})).toBeFocused();await expect(dialog.getByRole('alert')).toContainText('菜单选项');await expect(dialog.getByLabel('上级菜单',{exact:true})).toHaveValue('9007199254740997');await dialog.getByLabel('生成功能名',{exact:true}).fill('仍保留');fail=false;await dialog.getByRole('button',{name:'重试菜单选项'}).click();await expect(dialog.getByRole('alert')).toHaveCount(0);await expect(dialog.getByLabel('生成功能名',{exact:true})).toHaveValue('仍保留');await dialog.getByRole('button',{name:'恢复默认生成路径'}).click();await expect(dialog.getByLabel('自定义路径',{exact:true})).toHaveValue('/');await dialog.getByRole('tab',{name:'字段信息'}).click();await expect(dialog.getByLabel('字典类型 name',{exact:true})).toHaveValue('stored_type');await page.keyboard.press('Escape');await expect(dialog.getByText('有未保存的修改，是否放弃？')).toBeVisible();await dialog.getByRole('button',{name:'放弃修改'}).click();await expect(dialog).toHaveCount(0);
});
test('custom output long paths reproduce the old mobile overflow and wrap without dropping outcome text',async({page})=>{
  const path='main/resources/'+('A'.repeat(140))+'.tsx';
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[{...table,outputType:'1'}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/tool/generator/tables/'+id+'/custom-output',route=>route.fulfill({json:{files:[{path,state:'CREATED'}]}}));
  await login(page,['tool:gen:list','tool:gen:code']);await page.getByRole('button',{name:'生成代码 ef_test',exact:true}).click();await page.getByRole('button',{name:'确认操作',exact:true}).click();await expect(page.getByLabel('自定义输出结果')).toContainText(path);await page.setViewportSize({width:375,height:812});
  const oldStyle=await page.addStyleTag({content:'.generator-page [aria-label="自定义输出结果"] {overflow-wrap:normal}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(true);await oldStyle.evaluate(element=>element.parentNode?.removeChild(element));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByLabel('自定义输出结果')).toContainText('已创建');
});
test('tree and subtable selectors submit physical fields and switching template clears the old child relation',async({page})=>{
  const fields=[{id:'11',name:'entry_id',databaseType:'bigint',javaType:'Long',javaField:'entryId',controlType:'input',queryType:'EQ',order:0},{id:'12',name:'parent_id',databaseType:'bigint',javaType:'Long',javaField:'parentId',controlType:'input',queryType:'EQ',order:1},{id:'13',name:'name',databaseType:'varchar(64)',javaType:'String',javaField:'name',controlType:'input',queryType:'LIKE',order:2}];
  const detail={table,configuration:{packageName:'io.example',moduleName:'sample',businessName:'example',functionName:'功能',author:'作者',formColumns:1,outputType:'0',outputPath:'/',options:{parentMenuId:'0',generateDetail:false}},columns:fields,tables:[{id:'21',name:'child_table',comment:'子表',columns:[{id:'22',name:'root_id',javaType:'Long',javaField:'rootId'}]}]};let saved:unknown;
  await page.route('**/api/v1/tool/generator/tables?*',route=>route.fulfill({json:{items:[table],total:1,page:1,pageSize:10}}));await page.route('**/api/v1/tool/generator/tables/'+id,route=>{if(route.request().method()==='PUT'){saved=route.request().postDataJSON();return route.fulfill({status:204});}return route.fulfill({json:detail});});
  await login(page,['tool:gen:list','tool:gen:query','tool:gen:edit']);await page.getByRole('button',{name:'编辑 ef_test',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('tab',{name:'生成信息'}).click();await dialog.getByLabel('生成模板',{exact:true}).selectOption('sub');await dialog.getByLabel('关联子表',{exact:true}).selectOption('child_table');await dialog.getByLabel('子表外键',{exact:true}).selectOption('root_id');await dialog.getByLabel('生成模板',{exact:true}).selectOption('tree');await dialog.getByLabel('树编码字段',{exact:true}).selectOption('entry_id');await dialog.getByLabel('树父编码字段',{exact:true}).selectOption('parent_id');await dialog.getByLabel('树名称字段',{exact:true}).selectOption('name');await dialog.getByRole('button',{name:'保存配置',exact:true}).click();await expect(dialog).toHaveCount(0);expect(saved).toMatchObject({category:'tree',subTableName:'',subTableForeignKey:'',options:{treeCode:'entry_id',treeParentCode:'parent_id',treeName:'name'}});
  await page.getByRole('button',{name:'编辑 ef_test',exact:true}).click();await dialog.getByRole('tab',{name:'生成信息'}).click();await dialog.getByLabel('生成模板',{exact:true}).selectOption('sub');await dialog.getByLabel('关联子表',{exact:true}).selectOption('child_table');await dialog.getByLabel('子表外键',{exact:true}).selectOption('root_id');await dialog.getByRole('button',{name:'保存配置',exact:true}).click();await expect(dialog).toHaveCount(0);expect(saved).toMatchObject({category:'sub',subTableName:'child_table',subTableForeignKey:'root_id'});
});
