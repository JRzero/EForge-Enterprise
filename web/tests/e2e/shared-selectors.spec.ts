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
  await page.getByRole('combobox',{name:'加载多选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'正在加载'})).toBeVisible();await expect(page.getByRole('option',{name:'可选人员'})).toHaveCount(0);
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
