import {test,expect} from './fixtures';

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
