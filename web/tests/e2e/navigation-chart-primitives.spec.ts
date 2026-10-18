import {test,expect} from './fixtures';
test('public chart and tag controls work without application shell styles',async({page})=>{
  await page.goto('/tests/fixtures/navigation-chart-primitives.html');
  const chart=page.getByRole('img',{name:'数量趋势'}),strip=page.locator('.page-tags-strip');
  await expect(chart.locator('svg')).toBeVisible();
  expect((await chart.boundingBox())!.height).toBe(320);
  expect(await strip.evaluate(node=>getComputedStyle(node).scrollbarWidth)).toBe('none');
  expect(await page.locator('.dashboard-visually-hidden').evaluate(node=>getComputedStyle(node).position)).toBe('absolute');
  await page.getByRole('button',{name:'滚动到末个标签'}).click();
  await expect.poll(()=>strip.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('link',{name:'页面标签：页面29',exact:true}).click();
  await expect(page.getByRole('link',{name:'页面标签：页面29',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'标签操作',exact:true}).click();
  const menu=page.getByRole('menu'); await expect(menu).toBeVisible();
  expect(await menu.evaluate(node=>getComputedStyle(node).display)).toBe('grid');
  await page.getByRole('menuitem',{name:'关闭菜单'}).focus(); await page.keyboard.press('Escape'); await expect(menu).toBeHidden();
  await page.getByText('查看数量数据',{exact:true}).click(); await expect(page.getByRole('table',{name:'数量演示数据'})).toContainText('二月');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:900});
    await expect(chart.locator('svg')).toBeVisible();
    expect((await chart.boundingBox())!.height).toBe(320);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
