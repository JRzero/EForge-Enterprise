import {test,expect} from './fixtures';

test('shared component details retain focus, mixed grants, file ordering and image viewer at both sizes',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/tests/fixtures/component-gallery.html');
  await expect(page.getByRole('heading',{name:'共享组件样式验收'})).toBeVisible();
  const account=page.getByLabel('账号',{exact:true});await account.focus();
  expect(await account.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
  await expect(page.getByLabel('禁用账号')).toBeDisabled();
  const select=page.getByLabel('统一选择框'),textarea=page.getByLabel('统一文本域');
  for(const control of [select,textarea]){
    expect(await control.evaluate(element=>getComputedStyle(element).borderRadius)).toBe('4px');
    expect(await control.evaluate(element=>getComputedStyle(element).fontSize)).toBe('14px');
    await control.focus();
    expect(await control.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('solid');
  }
  await expect(page.getByLabel('禁用选择框')).toBeDisabled();
  expect(await page.getByLabel('错误文本域').evaluate(element=>getComputedStyle(element).borderTopColor)).toBe('rgb(220, 53, 69)');
  const invalidBox=await page.getByLabel('错误账号',{exact:true}).boundingBox(),messageBox=await page.locator('[data-type=error][data-variant=attached]').boundingBox();
  expect(messageBox!.y).toBeGreaterThanOrEqual(invalidBox!.y+invalidBox!.height);
  expect(await page.locator('[data-grant-key="system"]').evaluate((input:HTMLInputElement)=>input.indeterminate)).toBe(true);
  await page.locator('.menu-icon-picker summary').click();
  await page.getByText('显示列',{exact:true}).click();
  const columns=page.locator('.column-visibility-menu'),popover=columns.locator('.post-columns');
  expect((await popover.boundingBox())!.x).toBe((await columns.boundingBox())!.x);
  await page.screenshot({path:info.outputPath('expanded-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect((await popover.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  expect((await popover.boundingBox())!.x+(await popover.boundingBox())!.width).toBeLessThanOrEqual(390);
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

test('detail tabs and searchable selector expose clear states without nested borders at desktop and phone sizes',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/tests/fixtures/component-gallery.html');
  const first=page.getByRole('tab',{name:'基本信息',exact:true});
  await expect(first).toHaveAttribute('aria-selected','true');
  await expect(first).toHaveCSS('font-weight','600');
  await first.focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'费用明细',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('费用明细');
  await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'审批记录'})).toBeFocused();
  const trigger=page.getByRole('button',{name:'审批人员',exact:true});
  await trigger.click();
  const search=page.getByRole('combobox',{name:'Search options'});
  await expect(search).toHaveCSS('border-top-width','0px');
  await expect(search).toHaveCSS('outline-style','none');
  await expect(page.getByRole('option',{name:'Admin',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('option',{name:'停用人员'})).toHaveAttribute('aria-disabled','true');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    const option=page.getByRole('option',{name:'Cindy'});
    await expect(option).toHaveCSS('padding-left','12px');
    await expect.poll(async()=>(await option.boundingBox())!.height).toBeGreaterThanOrEqual(width===390?44:36);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('tabs-selector-'+width+'.png'),fullPage:true});
  }
  await search.fill('Cindy');await expect(page.locator('.astryx-selector-option-row')).toHaveCount(1);
  await search.press('ArrowDown');await search.press('Enter');
  await expect(trigger).toContainText('Cindy');
  await page.getByRole('button',{name:'Clear 审批人员',exact:true}).click();
  await expect(trigger).not.toContainText('Cindy');await expect(trigger).toBeFocused();
  await trigger.click();await page.getByRole('combobox',{name:'Search options'}).fill('不存在');
  await expect(page.locator('.astryx-selector-option-row')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
