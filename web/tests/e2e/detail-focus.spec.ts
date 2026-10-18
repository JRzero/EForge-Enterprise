import {test,expect} from './fixtures';

test('async detail focus waits for busy controls to become available without losing its intent',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');
  await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-busy',{detail:true})));
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  const added=page.getByLabel('内容 新:行/中文');await expect(added).toBeDisabled();await expect(added).not.toBeFocused();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-busy',{detail:false})));
  await expect(added).toBeFocused();
});

test('leaving during busy work cancels delayed detail focus',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-busy',{detail:true})));
  await page.getByLabel('其他输入').fill('保持这里');
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-busy',{detail:false})));
  await expect(page.getByLabel('内容 新:行/中文')).toBeEnabled();await expect(page.getByLabel('其他输入')).toBeFocused();
});

test('readonly transitions cancel old focus even if editing resumes before the mutation completes',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-readonly',{detail:true})));
  await expect(page.getByRole('button',{name:'新增明细'})).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-readonly',{detail:false})));
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文')).toBeVisible();await expect(page.getByLabel('内容 新:行/中文')).not.toBeFocused();
});

test('unmounted detail completion cannot focus a replacement table',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/tests/fixtures/detail-focus.html');await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-mounted',{detail:false})));
  await expect(page.getByRole('region',{name:'异步明细',exact:true})).toHaveCount(0);
  await page.getByLabel('其他输入').fill('替换表格期间保留');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('detail-mounted',{detail:true})));
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文')).toBeVisible();await expect(page.getByLabel('其他输入')).toBeFocused();expect(errors).toEqual([]);
});

test('mounting a rich text detail cell preserves the requested first-field focus',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html?rich');
  await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文')).toBeFocused();
});

test('async detail addition focuses its returned key after unrelated row reordering',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');
  await page.getByRole('button',{name:'新增明细'}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-reverse')));
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文')).toBeFocused();
  await expect(page.getByLabel('内容 A')).toHaveValue('甲');
});
test('async detail completion does not steal focus after the user leaves',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');
  await page.getByRole('button',{name:'新增明细'}).click();
  await page.getByLabel('其他输入').fill('继续这里');
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文')).toBeVisible();
  await expect(page.getByLabel('其他输入')).toBeFocused();
});
test('async deletion follows the original neighbouring key after reordering',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');
  await page.getByRole('button',{name:'删除明细'}).first().click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-reverse')));
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 A')).toHaveCount(0);
  await expect(page.getByLabel('内容 B')).toBeFocused();
});
test('rejected detail mutations keep rows, report a safe failure and allow retry',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/tests/fixtures/detail-focus.html');
  await page.getByRole('button',{name:'删除明细'}).first().click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-reject')));
  await expect(page.getByRole('alert')).toHaveText('删除明细未完成，请重试。');
  await expect(page.getByLabel('内容 A')).toHaveValue('甲');
  await page.getByRole('button',{name:'删除明细'}).first().click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 A')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);expect(errors).toEqual([]);
});
test('last-row deletion returns focus to add and old async rejection cannot replace newer progress',async({page})=>{
  await page.goto('/tests/fixtures/detail-focus.html');
  for(let remaining=3;remaining>0;remaining--){
    await page.getByRole('button',{name:'删除明细'}).first().click();
    await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
    await expect(page.getByRole('button',{name:'删除明细'})).toHaveCount(remaining-1);
  }
  const add=page.getByRole('button',{name:'新增明细'});await expect(add).toBeFocused();
  await add.click();await add.click();
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-reject')));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
  await expect(page.getByLabel('内容 新:行/中文-1')).toBeFocused();
});

for (const unavailable of ['hidden','inert','disabled','nonfocusable'] as const) {
  test(`deletion skips a ${unavailable} stable field and focuses a usable control in the surviving row`,async({page})=>{
    await page.goto('/tests/fixtures/detail-focus.html');
    await page.getByLabel('内容 B').evaluate((element,mode)=>{
      if(mode==='hidden') (element as HTMLElement).style.display='none';
      else if(mode==='inert') element.setAttribute('inert','');
      else if(mode==='disabled') element.setAttribute('disabled','');
      else {const replacement=document.createElement('span');replacement.id=element.id;replacement.textContent='只读内容';element.replaceWith(replacement);}
    },unavailable);
    await page.getByRole('button',{name:'删除明细'}).first().click();
    await page.evaluate(()=>window.dispatchEvent(new Event('detail-resolve')));
    await expect(page.getByLabel('内容 A')).toHaveCount(0);
    await expect(page.locator('tr[data-detail-row="B"]').getByRole('button',{name:'删除明细'})).toBeFocused();
  });
}