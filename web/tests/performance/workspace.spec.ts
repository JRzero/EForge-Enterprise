import {test,expect} from '@playwright/test';

test('measure 20 and 30 retained resource pages without losing independent drafts',async({page,context},info)=>{
  const unexpected:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    if(url.origin!=='http://127.0.0.1:4187'){unexpected.push(url.origin+path);return route.abort();}
    if(path==='/captchaImage')return route.fulfill({json:{code:200,captchaEnabled:false}});
    if(path==='/api/v1/auth/registration')return route.fulfill({json:{enabled:false}});
    if(path==='/api/v1/auth/login')return route.fulfill({json:{accessToken:'isolated-performance-fixture',tokenType:'Bearer'}});
    if(path==='/api/v1/app/bootstrap')return route.fulfill({json:{user:{id:'1',username:'admin',displayName:'规模验收'},roles:[],permissions:['app:dashboard:view','system:role:list'],navigation:[
      {key:'home',type:'ROUTE',routeId:'dashboard',label:'工作台',order:0,children:[]},
      {key:'roles',type:'ROUTE',routeId:'system-roles',label:'角色管理',cached:true,order:1,children:[]}
    ]}});
    if(path==='/api/v1/system/notices/feed')return route.fulfill({json:{items:[],unreadCount:0}});
    if(path.startsWith('/api/v1/system/dictionaries/lookup/'))return route.fulfill({json:[{value:'0',label:'正常',style:'DEFAULT',defaultEntry:true}]});
    if(/^\/api\/v1\/system\/roles\/\d+\/users$/.test(path)){
      const pageSize=Number(url.searchParams.get('pageSize')||10),currentPage=Number(url.searchParams.get('page')||1);
      expect(pageSize).toBeLessThanOrEqual(100);
      const rows=Array.from({length:pageSize},(_,i)=>{const index=(currentPage-1)*pageSize+i;return {id:String(100+index),username:'sample'+index,nickname:'示例'+index,status:'0',phone:'',email:''};});
      return route.fulfill({json:{items:rows,total:10000,page:currentPage,pageSize}});
    }
    if(path.startsWith('/api/')||path==='/logout'){unexpected.push(path);return route.abort();}
    return route.continue();
  });
  await page.goto('/dashboard');await page.getByLabel('账号',{exact:true}).fill('admin');await page.getByLabel('密码',{exact:true}).fill('fixture');
  await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'你好，规模验收'})).toBeVisible();
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const samples:{label:string;documents:number;nodes:number;jsEventListeners:number;heapBytes:number;retainedPages:number}[]=[];
  async function sample(label:string){
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics=await cdp.send('Performance.getMetrics');
    const heapBytes=metrics.metrics.find(item=>item.name==='JSHeapUsedSize')?.value;expect(heapBytes).toBeGreaterThan(0);
    samples.push({label,...await cdp.send('Memory.getDOMCounters'),heapBytes:heapBytes!,retainedPages:await page.locator('[data-page-path]').count()});
  }
  await sample('baseline');
  const navigationMs:number[]=[];
  for(let i=1;i<=30;i++){
    const path='/role/users/'+(1000+i),start=Date.now();
    await page.evaluate(path=>{history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'));},path);
    const view=page.locator(`[data-page-path="${path}"]`);
    await expect(view.getByRole('cell',{name:'sample0',exact:true})).toBeVisible();
    await view.getByLabel('用户账号',{exact:true}).fill('草稿'+i);
    navigationMs.push(Date.now()-start);
    if(i===20||i===30)await sample('pages-'+i);
  }
  await expect(page.getByRole('navigation',{name:'页面标签'}).getByRole('link')).toHaveCount(31);
  for(const i of [1,20,30]){
    const path='/role/users/'+(1000+i);
    await page.evaluate(path=>{history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'));},path);
    await expect(page.locator(`[data-page-path="${path}"]`).getByLabel('用户账号',{exact:true})).toHaveValue('草稿'+i);
  }
  const large=page.locator('[data-page-path="/role/users/1030"]');
  await large.getByRole('combobox',{name:'用户每页条数',exact:true}).selectOption('100');
  await expect(large.getByRole('cell',{name:'sample99',exact:true})).toBeVisible();
  await expect(large.getByRole('row')).toHaveCount(101);await sample('10000-total-100-visible');
  await large.getByRole('button',{name:'用户下一页',exact:true}).click();
  await expect(large.getByRole('cell',{name:'sample100',exact:true})).toBeVisible();
  await expect(large.getByRole('row')).toHaveCount(101);
  await page.getByRole('button',{name:'标签操作',exact:true}).click();await page.getByRole('menuitem',{name:'全部关闭',exact:true}).click();
  await expect(page.locator('[data-page-path]')).toHaveCount(1);await sample('closed');
  // Coarse regression ceilings from the measured baseline, not user-experience SLAs.
  expect(samples.find(item=>item.label==='pages-30')!.heapBytes).toBeLessThan(64*1024*1024);
  expect(samples.find(item=>item.label==='pages-30')!.nodes).toBeLessThan(50000);
  const baseline=samples[0],closed=samples.at(-1);
  if(!baseline||!closed)throw new Error('Missing measured workspace samples');
  expect(closed.heapBytes-baseline.heapBytes).toBeLessThan(12*1024*1024);
  expect(closed.nodes-baseline.nodes).toBeLessThan(1000);
  expect(errors).toEqual([]);expect(unexpected).toEqual([]);
  await info.attach('workspace-scale.json',{body:JSON.stringify({scope:'Chromium dist; mocked API; forced-GC heap; navigation timings include Playwright and draft entry, not INP',samples,navigationMs},null,2),contentType:'application/json'});
  console.log('WORKSPACE_SCALE '+JSON.stringify({samples,navigationMs}));
});
