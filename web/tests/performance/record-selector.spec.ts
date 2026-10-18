import {test,expect} from '@playwright/test';

test('real designer selector keeps ten DOM options for ten thousand remote records',async({page,context},info)=>{
  const unexpected:string[]=[],queries:{query:string;page:number;pageSize:number}[]=[];
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    if(url.origin!=='http://127.0.0.1:4187'){unexpected.push(url.origin+path);return route.abort();}
    if(path==='/captchaImage')return route.fulfill({json:{code:200,captchaEnabled:false}});
    if(path==='/api/v1/auth/registration')return route.fulfill({json:{enabled:false}});
    if(path==='/api/v1/auth/login')return route.fulfill({json:{accessToken:'selector-performance-fixture',tokenType:'Bearer'}});
    if(path==='/api/v1/app/bootstrap')return route.fulfill({json:{user:{id:'2',username:'reader',displayName:'规模验收'},roles:[],permissions:['workflow:definition:list','workflow:definition:edit','system:user:list'],navigation:[{key:'workflow-packages',type:'ROUTE',routeId:'workflow-packages',label:'流程管理',order:0,children:[]}]}});
    if(path==='/api/v1/system/notices/feed')return route.fulfill({json:{items:[],unreadCount:0}});
    if(path==='/api/v1/workflow/status')return route.fulfill({json:{enabled:true}});
    if(path==='/api/v1/workflow/packages'&&request.method()==='GET')return route.fulfill({json:{items:[],total:0,page:1,pageSize:10}});
    if(path==='/api/v1/system/users'&&request.method()==='GET'){
      const current={query:url.searchParams.get('username')||'',page:Number(url.searchParams.get('page')),pageSize:Number(url.searchParams.get('pageSize'))};queries.push(current);
      expect(url.searchParams.get('status')).toBe('0');expect(current.pageSize).toBe(10);
      const start=current.query==='exact'?9999:(current.page-1)*10;
      return route.fulfill({json:{items:Array.from({length:current.query?1:10},(_,i)=>({id:String(9007199254740993n+BigInt(start+i)),username:'record'+(start+i),displayName:'账号'+(start+i),status:'0'})),total:current.query?1:10000,page:current.page,pageSize:10}});
    }
    if(path.startsWith('/api/')||path==='/logout'){unexpected.push(request.method()+' '+path);return route.abort();}
    return route.continue();
  });
  await page.goto('/workflow/packages');await page.getByLabel('账号',{exact:true}).fill('reader');await page.getByLabel('密码',{exact:true}).fill('fixture');await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('button',{name:'新增流程包',exact:true}).click();const editor=page.getByRole('region',{name:'新增流程包',exact:true});
  await expect(editor.getByRole('button',{name:'添加人工审批',exact:true})).toBeEnabled();
  await editor.getByLabel('选择节点或连线').selectOption('review');await editor.getByLabel('审批方式').selectOption('assignee');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const picker=editor.getByRole('combobox',{name:'查找审批账号',exact:true});await picker.click();
  const popup=page.getByRole('dialog',{name:'选择查找审批账号',exact:true});
  await expect(popup.getByRole('option')).toHaveCount(10);await expect(popup).toContainText('共 10000 条');
  const samples:unknown[]=[];
  for(let i=1;i<=5;i++){
    await expect(popup.getByRole('option').first()).toHaveText(`账号${(i-1)*10}（record${(i-1)*10}）`);
    await expect(popup.getByRole('option')).toHaveCount(10);
    samples.push({page:i,...await cdp.send('Memory.getDOMCounters')});
    if(i<5)await popup.getByRole('button',{name:'下一页',exact:true}).click();
  }
  await popup.getByRole('searchbox').fill('exact');
  await expect(popup.getByRole('option')).toHaveCount(1);await popup.getByRole('option',{name:'账号9999（record9999）'}).click();
  await expect(editor.getByLabel('审批对象',{exact:true})).toHaveValue(String(9007199254740993n+9999n));
  await expect(picker).toBeFocused();await expect(popup).toHaveCount(0);
  expect(queries.map(item=>item.page)).toEqual([1,2,3,4,5,1]);expect(queries.at(-1)?.query).toBe('exact');expect(unexpected).toEqual([]);
  await info.attach('record-selector-scale.json',{body:JSON.stringify({scope:'dist designer, simulated 10000 total, real paged selector, no writes',queries,samples},null,2),contentType:'application/json'});
});
