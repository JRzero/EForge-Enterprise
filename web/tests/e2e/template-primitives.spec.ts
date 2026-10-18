import {test,expect} from './fixtures';
test('public account template centers its panel and fits mobile without app CSS',async({page})=>{
  await page.goto('/tests/fixtures/template-primitives.html#account');
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:850});
    const panel=(await page.locator('.login-panel').boundingBox())!;
    expect(panel.width).toBeLessThanOrEqual(400);
    expect(panel.x+panel.width/2).toBeCloseTo(width/2,0);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.getByLabel('账号',{exact:true}).fill('sample');
  await expect(page.getByLabel('账号',{exact:true})).toHaveValue('sample');
});
test('public tree, icon picker, dictionary and pagination keep layout and original interaction',async({page})=>{
  await page.goto('/tests/fixtures/template-primitives.html');
  expect(await page.locator('.grant-toolbar').evaluate(node=>getComputedStyle(node).display)).toBe('flex');
  expect(await page.locator('.dictionary-tags').evaluate(node=>getComputedStyle(node).display)).toBe('inline-flex');
  expect(await page.locator('.post-pagination').evaluate(node=>getComputedStyle(node).display)).toBe('flex');
  await page.getByRole('button',{name:'展开全部菜单',exact:true}).click();
  await page.getByRole('checkbox',{name:'选择菜单 系统 / 用户',exact:true}).check();
  await expect(page.getByRole('checkbox',{name:'选择菜单 系统',exact:true})).toBeChecked();
  await page.locator('summary').click();
  expect(await page.locator('.menu-icon-options').evaluate(node=>getComputedStyle(node).display)).toBe('grid');
  await page.getByLabel('搜索图标',{exact:true}).fill('user');
  await page.locator('[data-icon-choice]').first().click();
  await page.getByLabel('每页条数',{exact:true}).selectOption('20');
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(page.locator('.post-pagination > span').first()).toContainText('第 2 页');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
