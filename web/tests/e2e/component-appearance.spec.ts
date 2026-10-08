import {test,expect} from './fixtures';

test('shared component details retain focus, mixed grants, file ordering and image viewer at both sizes',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/tests/fixtures/component-gallery.html');
  await expect(page.getByRole('heading',{name:'共享组件样式验收'})).toBeVisible();
  const account=page.getByLabel('账号',{exact:true});await account.focus();
  expect(await account.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
  await expect(page.getByLabel('禁用账号')).toBeDisabled();
  const invalidBox=await page.getByLabel('错误账号',{exact:true}).boundingBox(),messageBox=await page.locator('[data-type=error][data-variant=attached]').boundingBox();
  expect(messageBox!.y).toBeGreaterThanOrEqual(invalidBox!.y+invalidBox!.height);
  expect(await page.locator('[data-grant-key="system"]').evaluate((input:HTMLInputElement)=>input.indeterminate)).toBe(true);
  await page.locator('.menu-icon-picker summary').click();
  await page.getByText('显示列',{exact:true}).click();
  await page.screenshot({path:info.outputPath('expanded-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('expanded-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'拖动文件 2 排序',exact:true}).focus();await page.keyboard.press('ArrowUp');
  await expect(page.locator('.generated-upload-entry').first()).toContainText('需求文档.docx');
  await page.getByRole('button',{name:'预览图片 样式示例',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.locator('.image-preview-stage img')).toBeVisible();
  expect(await dialog.getByRole('heading').evaluate(element=>getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
  await page.screenshot({path:info.outputPath('viewer-mobile.png')});
  await page.getByRole('button',{name:'下一张图片',exact:true}).click();
  await expect(dialog.getByText('第 2 / 2 张')).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'预览图片 样式示例',exact:true})).toBeFocused();
});
