import {test,expect} from './fixtures';
const key='eforge:list-views:'+JSON.stringify(['showcase-demo','sample-customers',1]);
const entry={id:'saved',name:'已有视图',state:{filters:{name:'星河'},columns:{email:false}}};

test('showcase views restore columns and applied conditions with page-scoped selection on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/showcase.html#list');
  await page.getByRole('checkbox',{name:'选择客户 星河科技 1',exact:true}).check();const batch=page.getByRole('region',{name:'已选记录操作'});await expect(batch).toContainText('当前页已选 1 条');
  await batch.getByRole('button',{name:'模拟批量操作'}).click();await expect(page.getByText('已模拟处理 1 条，仅演示，不修改真实数据。')).toBeVisible();
  await batch.getByRole('button',{name:'清除选择'}).click();await expect(batch).toHaveCount(0);
  await page.locator('.list-filters').getByLabel('客户名称').fill('星河');await page.getByRole('button',{name:'查询',exact:true}).click();await expect(page.getByRole('region',{name:'已生效筛选'})).toContainText('星河');
  await page.evaluate(({key,entry})=>{localStorage.setItem(key,JSON.stringify([entry]));window.dispatchEvent(new StorageEvent('storage',{key}));},{key,entry});
  await page.locator('.ui-saved-views summary').click();await page.getByLabel('已保存视图').selectOption('saved');await page.getByRole('button',{name:'应用视图',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'邮箱',exact:true})).toHaveCount(0);await expect(page.getByRole('cell',{name:'星河科技 1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'移除客户名称条件'}).click();await expect(page.getByRole('region',{name:'已生效筛选'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/list-views-mobile.png',fullPage:true});
});

test('route and schema version keys never import another view or auto-apply stored conditions',async({page})=>{
  await page.addInitScript(({key,entry})=>{
    localStorage.setItem(key,JSON.stringify([entry]));
    for(const [user,route,version] of [['showcase-demo','other-route',1],['showcase-demo','sample-customers',2],['another-user','sample-customers',1]])localStorage.setItem('eforge:list-views:'+JSON.stringify([user,route,version]),JSON.stringify([{...entry,name:'不可混入'}]));
  },{key,entry});
  await page.goto('/showcase.html#list');await page.locator('.ui-saved-views summary').click();
  await expect(page.getByLabel('已保存视图').locator('option')).toHaveText(['请选择','已有视图']);await expect(page.getByRole('region',{name:'已生效筛选'})).toHaveCount(0);
  await expect(page.getByRole('columnheader',{name:'邮箱',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'应用视图'})).toBeDisabled();
});

for(const mode of ['damaged','read-denied','write-denied'])test(`saved views recover from ${mode} without changing the current list`,async({page})=>{
  await page.addInitScript(({key,entry,mode})=>{
    localStorage.setItem(key,mode==='damaged'?'{broken':JSON.stringify([entry]));
    if(mode==='read-denied'){const original=Storage.prototype.getItem;Storage.prototype.getItem=function(name){if(name===key)throw Error('private storage fault');return original.call(this,name);};}
    if(mode==='write-denied'){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw Error('private storage fault');return original.call(this,name,value);};}
  },{key,entry,mode});
  await page.goto('/showcase.html#list');await page.locator('.ui-saved-views summary').click();
  if(mode==='write-denied'){
    await page.getByLabel('已保存视图').selectOption('saved');await page.getByLabel('视图名称',{exact:true}).fill('新视图');await page.getByRole('button',{name:'保存当前视图'}).click();
    await expect(page.getByRole('alert')).toContainText('无法保存视图');await expect(page.getByLabel('已保存视图').locator('option')).toHaveText(['请选择','已有视图']);
    await page.getByRole('button',{name:'删除视图'}).click();await expect(page.getByRole('button',{name:'应用视图'})).toBeEnabled();
  }else await expect(page.getByRole('alert')).toContainText('无法读取本页保存视图');
  await expect(page.getByRole('alert')).not.toContainText('private');await expect(page.getByRole('region',{name:'已生效筛选'})).toHaveCount(0);await expect(page.getByRole('cell',{name:'远山设计 2',exact:true})).toBeVisible();
});
