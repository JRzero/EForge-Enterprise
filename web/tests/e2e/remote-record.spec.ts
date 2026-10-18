import {test,expect} from './fixtures';

for(const mode of ['readonly','disabled','unmount'])test(`remote ${mode} transition cancels pending work without changing the selected record`,async({page})=>{
  let pending=false,aborted=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  page.on('requestfailed',request=>{if(request.url().includes('/fixture-records?'))aborted=true;});
  await page.route('**/fixture-records?*',async route=>{pending=true;await gate;await route.fulfill({json:{total:1,items:[{value:'2',label:'晚到结果'}]}}).catch(()=>{});});
  await page.goto('/tests/fixtures/remote-record.html');await page.getByRole('combobox').click();await expect.poll(()=>pending).toBe(true);
  await page.evaluate(mode=>window.dispatchEvent(new CustomEvent('record-state',{detail:mode})),mode);await expect.poll(()=>aborted).toBe(true);release();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('已选编号')).toHaveText('9007199254740993');
  if(mode==='readonly')await expect(page.getByRole('combobox')).toBeFocused();if(mode==='disabled')await expect(page.getByRole('combobox')).toBeDisabled();
});

test('a loader ignoring abort cannot overwrite the latest result',async({page})=>{
  let pending=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/fixture-records?*',async route=>{const slow=new URL(route.request().url()).searchParams.get('query')==='slow';if(slow){pending=true;await gate;}
    await route.fulfill({json:{total:1,items:[{value:slow?'1':'2',label:slow?'旧响应':'新响应'}]}});});
  await page.goto('/tests/fixtures/remote-record.html?ignoreAbort');await page.getByRole('combobox').click();const search=page.getByRole('searchbox');
  await search.fill('slow');await expect.poll(()=>pending).toBe(true);await search.fill('new');await expect(page.getByRole('option')).toHaveText('新响应');
  const completed=page.waitForResponse(response=>response.url().includes('query=slow'));release();await completed;
  await expect(page.getByRole('option')).toHaveText('新响应');await expect(page.getByLabel('已选编号')).toHaveText('9007199254740993');
});

test('remote records debounce, page and preserve exact old/current values with keyboard selection',async({page})=>{
  const requests:URLSearchParams[]=[];
  await page.route('**/fixture-records?*',route=>{const q=new URL(route.request().url()).searchParams;requests.push(q);return route.fulfill({json:{total:11,items:[{value:q.get('page')==='2'?'9007199254740995':'9007199254740994',label:q.get('page')==='2'?'第二页审批人':'第一位审批人'}]}});});
  await page.goto('/tests/fixtures/remote-record.html');const trigger=page.getByRole('combobox',{name:'审批人',exact:true});
  await expect(trigger).toHaveText(/旧审批人/);expect(requests).toHaveLength(0);await trigger.click();
  const search=page.getByRole('searchbox',{name:'搜索审批人'});await expect(search).toBeFocused();
  await search.fill('ab');await search.fill('最终');await expect(page.getByRole('option')).toHaveText('第一位审批人');
  expect(requests.every(q=>q.get('query')==='最终')).toBe(true);await expect(page.getByRole('dialog').getByRole('status')).toHaveCount(0);
  await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.getByRole('option')).toHaveText('第二页审批人');
  expect(requests.at(-1)?.get('page')).toBe('2');await search.focus();await search.press('ArrowDown');await expect(page.getByRole('option')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.getByLabel('已选编号')).toHaveText('9007199254740995');await expect(trigger).toBeFocused();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('remote failures preserve selection, retry safely, cancel on close and retain narrow-screen bounds',async({page})=>{
  let fail=true;await page.route('**/fixture-records?*',route=>route.fulfill(fail?{status:503,body:'secret SQL'}:{json:{total:0,items:[]}}));
  await page.setViewportSize({width:320,height:740});await page.goto('/tests/fixtures/remote-record.html');const trigger=page.getByRole('combobox',{name:'审批人',exact:true});await trigger.click();
  await expect(page.getByRole('alert')).toContainText('加载失败');await expect(page.getByRole('alert')).not.toContainText('SQL');await expect(page.getByLabel('已选编号')).toHaveText('9007199254740993');
  fail=false;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toHaveText('没有匹配记录');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/remote-record-mobile.png'});await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'切换只读'}).click();await trigger.click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'清空审批人'})).toHaveCount(0);
});

test('closing a pending search aborts it and disabled options are skipped by keyboard',async({page})=>{
  let pending=false,release!:()=>void,aborted=false;const gate=new Promise<void>(resolve=>{release=resolve;});
  page.on('requestfailed',request=>{if(request.url().includes('query=pending'))aborted=true;});
  await page.route('**/fixture-records?*',async route=>{
    if(new URL(route.request().url()).searchParams.get('query')==='pending'){pending=true;await gate;}
    await route.fulfill({json:{total:2,items:[{value:'1',label:'停用账号',disabled:true},{value:'9007199254740999',label:'可选账号'}]}}).catch(()=>{});
  });
  await page.goto('/tests/fixtures/remote-record.html');const trigger=page.getByRole('combobox',{name:'审批人',exact:true});await trigger.click();
  const search=page.getByRole('searchbox');await expect(page.getByRole('option',{name:'停用账号'})).toBeDisabled();await search.press('ArrowDown');await expect(page.getByRole('option',{name:'可选账号'})).toBeFocused();
  await search.fill('pending');await expect.poll(()=>pending).toBe(true);await search.press('Escape');await expect.poll(()=>aborted).toBe(true);release();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByLabel('已选编号')).toHaveText('9007199254740993');
});

test('new searches and closing abort pending requests and cannot display stale results',async({page})=>{
  let release!:()=>void,started=false;const gate=new Promise<void>(resolve=>{release=resolve;});const aborted:string[]=[];
  page.on('requestfailed',request=>{if(request.url().includes('/fixture-records?'))aborted.push(request.url());});
  await page.route('**/fixture-records?*',async route=>{
    const query=new URL(route.request().url()).searchParams.get('query');if(query==='慢'){started=true;await gate;}
    await route.fulfill({json:{total:1,items:[{value:'9007199254740997',label:query==='慢'?'过期记录':'最新记录'}]}}).catch(()=>{});
  });
  await page.goto('/tests/fixtures/remote-record.html');await page.getByRole('combobox',{name:'审批人',exact:true}).click();const search=page.getByRole('searchbox');
  await search.fill('慢');await expect.poll(()=>started).toBe(true);await search.fill('快');await expect(page.getByRole('option')).toHaveText('最新记录');
  await expect.poll(()=>aborted.length).toBeGreaterThan(0);release();await expect(page.getByRole('option')).toHaveText('最新记录');
  await search.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('已选编号')).toHaveText('9007199254740993');
});
