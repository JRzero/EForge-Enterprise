import {test,expect} from './fixtures';

for(const key of ['Enter','Space'])test(`tree disclosure retains selection and only toggles after mouse focus then ${key}`,async({page},info)=>{
  await page.goto('/showcase.html#form');
  const trigger=page.getByRole('combobox',{name:/^负责部门 /});await trigger.click();
  const tree=page.getByRole('tree',{name:'负责部门选项'}),root=tree.locator('[data-value="root"]');
  const collapse=tree.getByRole('button',{name:'折叠总部',exact:true});await collapse.click();
  const expand=tree.getByRole('button',{name:'展开总部',exact:true});await expect(expand).toBeFocused();
  await expand.press(key);
  await expect(tree).toBeVisible();await expect(trigger).toHaveAttribute('data-value','9007199254740993');
  await expect(root).toHaveAttribute('aria-expanded','true');
  await expect(tree.getByRole('button',{name:'销售部',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath(`tree-disclosure-${key}.png`),fullPage:true});
  await tree.getByRole('button',{name:'折叠总部',exact:true}).press(key);
  await expect(root).toHaveAttribute('aria-expanded','false');await expect(trigger).toHaveAttribute('data-value','9007199254740993');
  await root.focus();await root.press('ArrowRight');
  await tree.getByRole('button',{name:'折叠总部',exact:true}).focus();await page.keyboard.press('ArrowDown');
  await expect(tree.locator('[data-value="sales"]')).toBeFocused();await page.keyboard.press(key);
  await expect(tree).toBeHidden();await expect(trigger).toHaveAttribute('data-value','sales');await expect(trigger).toBeFocused();
});

for(const target of ['input','arrow'])test(`multi selector Escape dismisses popup then dialog from ${target}`,async({page},info)=>{
  await page.goto('/tests/fixtures/nested-selectors.html');
  const opener=page.getByRole('button',{name:'打开人员设置',exact:true});await opener.click();
  const dialog=page.getByRole('dialog',{name:'人员设置',exact:true});
  const input=dialog.getByRole('combobox',{name:'参与人员',exact:true});await input.click();
  await input.press('ArrowDown');await input.press('Enter');
  await expect(dialog.getByRole('button',{name:'移除 林小禾',exact:true})).toBeVisible();
  if(target==='arrow')await dialog.getByRole('button',{name:'收起参与人员',exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();await expect(input).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`multi-escape-${target}.png`),fullPage:true});
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  await expect(page.getByText('已选人员：9007199254740993',{exact:true})).toBeVisible();
});

test('semantic tags preserve visible text with WCAG AA contrast',async({page},info)=>{
  await page.goto('/showcase.html#controls');
  const colors=await page.locator('.ui-tag[data-tone]').evaluateAll(tags=>tags.map(tag=>{
    const style=getComputedStyle(tag);
    function luminance(color:string){const channels=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});return .2126*channels[0]!+.7152*channels[1]!+.0722*channels[2]!;}
    const foreground=luminance(style.color),background=luminance(style.backgroundColor);
    return {tone:tag.getAttribute('data-tone'),text:tag.textContent,foreground:style.color,background:style.backgroundColor,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};
  }));
  await info.attach('tag-contrast',{body:JSON.stringify(colors,null,2),contentType:'application/json'});
  await page.locator('section').filter({has:page.getByRole('heading',{name:'标签、徽标与头像',exact:true})}).screenshot({path:info.outputPath('tag-contrast.png')});
  for(const color of colors)expect.soft(color.contrast,`${color.tone}: ${color.foreground} / ${color.background}`).toBeGreaterThanOrEqual(4.5);
  expect(new Set(colors.map(color=>color.tone))).toEqual(new Set(['primary','success','warning','danger','info']));
});

test('showcase pagination preserves all navigation without page overflow at 320px',async({page},info)=>{
  await page.setViewportSize({width:320,height:800});await page.goto('/showcase.html#advanced');
  const block=page.locator('section').filter({has:page.getByRole('heading',{name:'基础分页',exact:true})});
  await expect(block).toBeVisible();await page.screenshot({path:info.outputPath('pagination-320.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // Numeric page buttons and previous/next navigation remain usable, not hidden or clipped.
  const buttons=block.getByRole('button');expect(await buttons.count()).toBeGreaterThan(3);
  for(const button of await buttons.all()){
    const box=await button.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);
  }
  await block.getByRole('button',{name:'Go to page 12',exact:true}).click();await expect(block.getByText('当前第 12 页',{exact:true})).toBeVisible();
  await block.getByRole('button',{name:'Go to previous page',exact:true}).click();await expect(block.getByText('当前第 11 页',{exact:true})).toBeVisible();
  await block.getByRole('button',{name:'Go to next page',exact:true}).click();await expect(block.getByText('当前第 12 页',{exact:true})).toBeVisible();
  await block.getByRole('button',{name:'Go to page 1',exact:true}).click();await expect(block.getByText('当前第 1 页',{exact:true})).toBeVisible();
});
