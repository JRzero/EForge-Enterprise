import {test,expect} from './fixtures';
test('standalone modal owns sizing, geometry handles and focus recovery',async({page})=>{
  await page.goto('/tests/fixtures/dialog-primitives.html');
  const opener=page.getByRole('button',{name:'打开编辑'});
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'独立编辑弹窗'});
  const initial=(await dialog.boundingBox())!;
  expect(initial.width).toBe(520);
  expect(await dialog.evaluate(node=>getComputedStyle(node).padding)).toBe('20px');
  const caption=dialog.locator('label').filter({hasText:'名称'});
  const captionBox=(await caption.boundingBox())!,inputBox=(await dialog.getByLabel('名称',{exact:true}).boundingBox())!;
  expect(captionBox.width).toBe(110);
  expect(inputBox.x).toBeGreaterThan(captionBox.x+captionBox.width);
  const handle=dialog.getByRole('button',{name:'移动弹窗',exact:true});
  expect(await handle.evaluate(node=>getComputedStyle(node).position)).toBe('absolute');
  expect(await handle.evaluate(node=>getComputedStyle(node).touchAction)).toBe('none');
  await handle.focus(); await handle.press('ArrowRight');
  expect((await dialog.boundingBox())!.x).toBeGreaterThan(initial.x);
  await handle.press('Home');
  expect((await dialog.boundingBox())!.x).toBeCloseTo(initial.x,0);
  await dialog.getByLabel('说明').fill('调整后仍保留');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:700});
    const box=(await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width);
    await expect(dialog.getByLabel('说明')).toHaveValue('调整后仍保留');
  }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
});
