import {test,expect} from './fixtures';

test('public list primitives carry desktop and mobile layout without application styles',async({page})=>{
  await page.goto('/tests/fixtures/list-primitives.html');
  await page.setViewportSize({width:1440,height:900});
  expect((await page.locator('.brand-mark').boundingBox())!.width).toBe(28);
  expect((await page.locator('.header-account-avatar').boundingBox())!.height).toBe(28);
  expect(await page.locator('.password-field').evaluate(node=>getComputedStyle(node).display)).toBe('grid');
  await page.getByRole('button',{name:'显示示例密码'}).click();
  await expect(page.getByLabel('示例密码',{exact:true})).toHaveAttribute('type','text');
  const sidebar=page.getByRole('complementary',{name:'部门树'}), content=page.locator('.tree-list-content');
  const sideBox=(await sidebar.boundingBox())!, bodyBox=(await content.boundingBox())!;
  expect(sideBox.width).toBe(200);
  expect(bodyBox.x).toBeGreaterThanOrEqual(sideBox.x+sideBox.width+19);
  const nav=page.getByRole('navigation',{name:'分页导航'});
  expect(await nav.evaluate(node=>getComputedStyle(node).display)).toBe('flex');
  await nav.getByRole('button',{name:'第 3 页',exact:true}).click();
  await expect(page.getByLabel('当前页')).toHaveText('3');
  await nav.getByLabel('跳至页码').fill('1000');
  await nav.getByRole('button',{name:'跳转',exact:true}).click();
  await expect(nav.getByRole('button',{name:'第 1000 页',exact:true})).toHaveAttribute('aria-current','page');
  for(const width of [1050,390,320]){
    await page.setViewportSize({width,height:900});
    const toggle=page.getByRole('button',{name:'收起部门树',exact:true});
    await expect(toggle).toBeVisible();
    expect((await content.boundingBox())!.y).toBeGreaterThan((await sidebar.boundingBox())!.y);
    await toggle.click(); await expect(sidebar).toBeHidden();
    await page.getByRole('button',{name:'展开部门树',exact:true}).click(); await expect(sidebar).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
