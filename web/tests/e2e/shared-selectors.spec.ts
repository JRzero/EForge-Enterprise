import {test,expect} from './fixtures';

test('date range keeps date-only values and clears both bounds without submitting the form',async({page})=>{
  await page.goto('/showcase.html#form');
  const range=page.getByRole('group',{name:'服务周期',exact:true});
  await range.getByLabel('开始日期',{exact:true}).fill('2026-10-13');
  await range.getByLabel('结束日期',{exact:true}).fill('2026-10-12');
  await expect(range.getByRole('alert')).toHaveText('开始日期不能晚于结束日期');
  await expect(range.getByLabel('开始日期',{exact:true})).toHaveAttribute('aria-invalid','true');
  await range.getByLabel('结束日期',{exact:true}).fill('2026-10-14');
  await expect(range.getByRole('alert')).toHaveCount(0);
  await expect(range.getByLabel('开始日期',{exact:true})).toHaveValue('2026-10-13');
  await range.getByRole('button',{name:'清空服务周期',exact:true}).click();
  await expect(range.getByLabel('开始日期',{exact:true})).toHaveValue('');
  await expect(range.getByLabel('结束日期',{exact:true})).toHaveValue('');
  await expect(page.getByText('请填写客户名称',{exact:true})).toHaveCount(0);
});

test('multi selection handles unavailable options, loading, disabled and readonly states',async({page},info)=>{
  await page.goto('/tests/fixtures/component-gallery.html');
  await expect(page.getByRole('combobox',{name:'禁用多选',exact:true})).toBeDisabled();
  const readonly=page.getByRole('combobox',{name:'只读多选',exact:true});await readonly.click();await expect(readonly).toHaveAttribute('aria-expanded','false');
  await page.getByRole('combobox',{name:'加载多选',exact:true}).click();await expect(page.locator('.ui-multi-select').getByRole('status').filter({hasText:'正在加载'})).toBeVisible();await expect(page.getByRole('option',{name:'可选人员'})).toHaveCount(0);
  const failure=page.getByRole('combobox',{name:'失败多选',exact:true});await failure.click();await expect(failure).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('button',{name:'移除 旧人员（old）',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'重试失败多选',exact:true}).click();await expect(failure).not.toHaveAttribute('aria-invalid','true');
  await page.getByRole('option',{name:'可选人员',exact:true}).click();await expect(page.getByRole('button',{name:'移除 可选人员',exact:true})).toBeVisible();
  await failure.press('Tab');await expect(failure).toHaveAttribute('aria-expanded','false');
  await page.setViewportSize({width:390,height:844});await failure.click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('multi-select-mobile.png'),fullPage:true});
});

test('multi selection preserves exact and unknown values, skips disabled options and clears through keyboard',async({page})=>{
  await page.goto('/showcase.html#form');
  const input=page.getByRole('combobox',{name:'协作人员',exact:true});
  await input.fill('Cindy');await input.press('ArrowDown');await input.press('Enter');
  await expect(page.getByRole('button',{name:'移除 Cindy',exact:true})).toBeVisible();
  await input.fill('停用');await expect(page.getByRole('option',{name:'停用人员'})).toHaveAttribute('aria-disabled','true');
  await input.press('ArrowDown');await input.press('Enter');
  await expect(page.getByRole('button',{name:'移除 停用人员',exact:true})).toHaveCount(0);
  await input.fill('不存在');await expect(page.getByText('没有匹配项',{exact:true})).toBeVisible();
  await input.press('Escape');await expect(input).toBeFocused();
  await page.getByRole('button',{name:'移除 已分配人员（9007199254740993）',exact:true}).click();
  await page.getByRole('button',{name:'清空协作人员',exact:true}).click();
  await expect(page.getByRole('button',{name:'移除 Cindy',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await input.click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('role assignment uses shared multi selector and submits retained long IDs unchanged',async({page})=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'editor',displayName:'编辑'},roles:['editor'],permissions:['system:user:list','system:user:edit'],navigation:[{key:'users',type:'ROUTE',routeId:'system-users',label:'用户管理',order:0,children:[]}]}}));
  await page.route('**/api/v1/system/users/departments',route=>route.fulfill({json:[]}));
  await page.route('**/api/v1/system/users?*',route=>route.fulfill({json:{items:[{id:'3',username:'sample',displayName:'示例',status:'0'}],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/system/users/options',route=>route.fulfill({json:{departments:[],posts:[],roles:[{id:'2',name:'普通角色',status:'0'},{id:'4',name:'停用角色',status:'1'}]}}));
  let submitted:unknown;
  await page.route('**/api/v1/system/users/3/roles',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{roleIds:['2','9007199254740993']}});
    submitted=route.request().postDataJSON();return route.fulfill({status:204});
  });
  await page.goto('/user');await page.getByLabel('账号',{exact:true}).fill('editor');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('button',{name:'分配角色 sample',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'移除 当前已分配的角色（9007199254740993）',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'移除 普通角色',exact:true}).click();
  await dialog.getByRole('combobox',{name:'角色',exact:true}).fill('停用');
  await expect(dialog.getByRole('option',{name:'停用角色',exact:true})).toHaveAttribute('aria-disabled','true');
  await dialog.getByRole('button',{name:'确认保存',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(submitted).toEqual({roleIds:['9007199254740993']});
});

 test('tree selection searches ancestors, preserves unknown values and supports keyboard navigation',async({page},info)=>{
  await page.goto('/showcase.html#form');
  const trigger=page.getByRole('combobox',{name:/^负责部门 /});
  await expect(trigger).toContainText('9007199254740993');await trigger.click();
  const tree=page.getByRole('tree',{name:'负责部门选项'});
  await tree.getByRole('button',{name:'折叠总部',exact:true}).click();
  await expect(tree.getByRole('button',{name:'销售部',exact:true})).toHaveCount(0);
  const search=page.getByRole('searchbox',{name:'搜索负责部门'});await search.fill('销售');
  await expect(tree.getByRole('button',{name:'总部',exact:true})).toBeVisible();
  await expect(tree.getByRole('button',{name:'销售部',exact:true})).toBeVisible();
  await search.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await expect(trigger).toContainText('销售部');await expect(trigger).toBeFocused();
  await trigger.click();await search.fill('停用');await search.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(trigger).toContainText('销售部');await expect(tree).toBeVisible();
  await search.fill('不存在');await expect(page.getByText('没有匹配项',{exact:true})).toBeVisible();
  await search.press('Escape');await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'清空负责部门',exact:true}).click();await expect(trigger).toContainText('请选择');
  await page.setViewportSize({width:390,height:844});await trigger.click();await search.fill('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('tree-select-mobile.png'),fullPage:true});
 });

test('tree selector handles retry, scoped roots, readonly and loading',async({page})=>{
 await page.goto('/tests/fixtures/component-gallery.html');
 const readonly=page.getByRole('combobox',{name:/^只读树 /});await expect(readonly).not.toBeDisabled();await expect(readonly).toHaveAttribute('aria-readonly','true');await readonly.focus();await expect(readonly).toBeFocused();await readonly.press('Enter');await expect(readonly).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('combobox',{name:/^禁用树 /})).toBeDisabled();
 await page.getByRole('combobox',{name:/^加载树 /}).click();await expect(page.getByRole('button',{name:'不可提前选择',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:/^失败树 /}).click();await expect(page.getByRole('alert').filter({hasText:'树加载失败'})).toBeVisible();
 await page.getByRole('button',{name:'重试失败树',exact:true}).click();
 const root=page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'范围内部门',exact:true})});await expect(root).toHaveAttribute('aria-level','1');
 await root.getByRole('button',{name:'范围内部门',exact:true}).click();await expect(page.getByRole('combobox',{name:/^失败树 /})).toContainText('范围内部门');
});

test('user editor department tree submits scoped long IDs and excludes other inactive departments',async({page})=>{
 await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
 await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
 await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'editor',displayName:'编辑'},roles:['editor'],permissions:['system:user:list','system:user:edit'],navigation:[{key:'users',type:'ROUTE',routeId:'system-users',label:'用户管理',order:0,children:[]}]}}));
 await page.route('**/api/v1/system/users/departments',route=>route.fulfill({json:[]}));
 const user={id:'3',username:'sample',displayName:'示例',status:'0',departmentId:'101',roleIds:[],postIds:[]};
 await page.route('**/api/v1/system/users?*',route=>route.fulfill({json:{items:[user],total:1,page:1,pageSize:10}}));
 await page.route('**/api/v1/system/users/options',route=>route.fulfill({json:{departments:[{id:'101',name:'原停用部门',status:'1',sort:0},{id:'102',name:'其他停用部门',status:'1',sort:0},{id:'9007199254740993',parentId:'100',name:'范围内部门',status:'0',sort:1}],posts:[],roles:[]}}));
 let submitted:Record<string,unknown>|undefined;await page.route('**/api/v1/system/users/3',route=>{if(route.request().method()==='GET')return route.fulfill({json:{user,roleIds:[],postIds:[]}});submitted=route.request().postDataJSON();return route.fulfill({status:204});});
 await page.goto('/user');await page.getByLabel('账号',{exact:true}).fill('editor');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.getByRole('button',{name:'修改用户 sample',exact:true}).click();const dialog=page.getByRole('dialog');
 const picker=dialog.getByRole('combobox',{name:/^归属部门 /});await expect(picker).toContainText('原停用部门（停用）');await picker.click();
 await expect(dialog.getByRole('button',{name:'其他停用部门（停用）',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'范围内部门',exact:true}).click();
 await dialog.getByRole('button',{name:'保存用户',exact:true}).click();await expect(dialog).toHaveCount(0);expect(submitted?.departmentId).toBe('9007199254740993');
});

test('reference selection preserves unavailable records and searches labeled records',async({page})=>{
 await page.goto('/showcase.html#form');const picker=page.getByRole('button',{name:'关联客户',exact:true});
 await expect(picker).toContainText('原关联客户');await picker.click();await page.getByPlaceholder('搜索关联客户',{exact:true}).fill('KH001');
 await page.getByRole('option',{name:'星河科技 · KH001',exact:true}).click();await expect(picker).toContainText('星河科技');
 await picker.click();await page.getByPlaceholder('搜索关联客户',{exact:true}).fill('停用');await expect(page.getByRole('option',{name:'停用客户',exact:true})).toHaveAttribute('aria-disabled','true');
 await page.keyboard.press('Escape');await expect(picker).toBeFocused();
 await picker.click();await page.getByPlaceholder('搜索关联客户',{exact:true}).fill('不存在');await expect(page.getByRole('listbox',{name:'关联客户',exact:true}).getByText('没有匹配记录',{exact:true})).toBeVisible();
});

test('reference loading, retry and readonly keep the stored record',async({page},info)=>{
 await page.goto('/tests/fixtures/component-gallery.html');
 const failure=page.getByRole('button',{name:'失败关联',exact:true});await expect(failure).toBeDisabled();await expect(failure).toContainText('9007199254740993');
 await expect(page.getByRole('button',{name:'加载关联',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'禁用关联',exact:true})).toBeDisabled();
 const readonly=page.getByRole('combobox',{name:'只读关联',exact:true});await expect(readonly).toHaveAttribute('aria-readonly','true');await readonly.click();await expect(page.getByRole('listbox',{name:'只读关联',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'重试失败关联',exact:true}).click();await failure.click();await page.getByRole('option',{name:'恢复的记录',exact:true}).click();await expect(failure).toContainText('恢复的记录');
 await page.getByRole('button',{name:'Clear 失败关联',exact:true}).click();await expect(failure).toContainText('请选择');
 await page.setViewportSize({width:390,height:844});await failure.click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('reference-mobile.png'),fullPage:true});
});

test('user choice groups describe retained inactive assignments and keep other inactive options unavailable',async({page})=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'editor',displayName:'编辑'},roles:['editor'],permissions:['system:user:list','system:user:edit'],navigation:[{key:'users',type:'ROUTE',routeId:'system-users',label:'用户管理',order:0,children:[]}]}}));
  await page.route('**/api/v1/system/users/departments',route=>route.fulfill({json:[]}));
  const user={id:'3',username:'sample',displayName:'示例',status:'0'},role='9007199254740993',post='9007199254740995';
  await page.route('**/api/v1/system/users?*',route=>route.fulfill({json:{items:[user],total:1,page:1,pageSize:10}}));
  await page.route('**/api/v1/system/users/options',route=>route.fulfill({json:{departments:[],posts:[{id:post,name:'原岗位',status:'1'},{id:'4',name:'其他岗位',status:'1'}],roles:[{id:role,name:'原角色',status:'1'},{id:'5',name:'其他角色',status:'1'}]}}));
  let submitted:Record<string,unknown>|undefined;await page.route('**/api/v1/system/users/3',route=>{if(route.request().method()==='GET')return route.fulfill({json:{user,roleIds:[role],postIds:[post]}});submitted=route.request().postDataJSON();return route.fulfill({status:204});});
  await page.goto('/user');await page.getByLabel('账号',{exact:true}).fill('editor');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('button',{name:'修改用户 sample',exact:true}).click();
  const dialog=page.getByRole('dialog'),roles=dialog.getByRole('group',{name:'角色',exact:true}),posts=dialog.getByRole('group',{name:'岗位',exact:true});
  for(const group of [roles,posts])await expect(group).toHaveAccessibleDescription('已分配的停用项可保留或取消；未分配的停用项不可新增。');
  await expect(roles.getByRole('checkbox',{name:'原角色（停用）',exact:true})).toBeChecked();await expect(roles.getByRole('checkbox',{name:'其他角色（停用）',exact:true})).toBeDisabled();await expect(posts.getByRole('checkbox',{name:'其他岗位（停用）',exact:true})).toBeDisabled();
  await posts.getByRole('checkbox',{name:'原岗位（停用）',exact:true}).uncheck();await expect(posts.getByRole('checkbox',{name:'原岗位（停用）',exact:true})).toBeDisabled();await expect(posts).not.toHaveAttribute('aria-describedby');
  await dialog.getByRole('button',{name:'保存用户',exact:true}).click();await expect(dialog).toHaveCount(0);expect(submitted?.postIds).toEqual([]);expect(submitted?.roleIds).toEqual([role]);
});
