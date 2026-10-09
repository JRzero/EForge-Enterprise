import {test,expect} from './fixtures';

const sections=['overview','list','form','detail','account','controls','feedback','workspace','shell','advanced','editors','charts','files'];
test('showcase sections render on desktop and mobile without business API calls',async({page},info)=>{
  const errors:string[]=[],api:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^\/(api\/|captchaImage|login)/.test(new URL(request.url()).pathname))api.push(request.url());});
  for(const section of sections){
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`/showcase.html#${section}`);
    await expect(page.locator('.showcase-heading h1')).toBeVisible();
    await expect(page.locator('.showcase-main')).not.toBeEmpty();
    if(section==='charts'){
      await expect(page.locator('.chart-surface svg').first()).toBeVisible();
      for(const chart of await page.locator('.chart-surface').all())expect((await chart.boundingBox())!.width).toBeGreaterThan(200);
    }
    if(section==='form'){
      const labels=page.locator('.form-section > div > label');
      for(const label of await labels.all())expect((await label.boundingBox())!.width).toBe(100);
      const field=await page.getByRole('textbox',{name:/^客户名称/}).boundingBox();
      const toggle=await page.locator('.form-control-offset').boundingBox();
      expect(Math.abs(field!.x-toggle!.x)).toBeLessThan(16);
      await expect(page.getByRole('textbox',{name:/^客户名称/})).toHaveAttribute('aria-required','true');
    }
    if(section==='detail'){
      await expect(page.locator('.detail-field')).toHaveCount(8);
      for(const label of await page.locator('.detail-field dt').all())expect((await label.boundingBox())!.width).toBe(100);
      await expect(page.locator('.detail-page aside')).toHaveCount(0);
    }
    await page.screenshot({path:info.outputPath(`${section}-desktop.png`),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),section).toBe(true);
    await page.screenshot({path:info.outputPath(`${section}-mobile.png`),fullPage:true});
  }
  expect(errors).toEqual([]);expect(api).toEqual([]);
});
test('showcase list, form, dialogs and navigation operate on local state',async({page})=>{
  await page.goto('/showcase.html#list');
  await page.getByRole('textbox',{name:'客户名称',exact:true}).fill('远山');
  await page.getByRole('button',{name:'查询',exact:true}).click();
  await expect(page.getByRole('cell',{name:'星河科技 1',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'查看详情'}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation',{name:'示例分类'}).getByRole('link',{name:'表单模板',exact:true}).click();
  await page.getByRole('textbox',{name:/^客户名称/}).fill('示例客户');
  await page.getByRole('button',{name:'保存客户',exact:true}).click();
  await expect(page.locator('.ui-feedback')).toContainText('已保存：示例客户');
  await page.goto('/showcase.html#feedback');
  await page.getByRole('button',{name:'打开示例弹窗',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'打开示例弹窗',exact:true})).toBeFocused();
  await page.goto('/showcase.html#files');
  await page.getByRole('button',{name:'预览图片 EForge 标志',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.goto('/showcase.html#workspace');
  await page.getByRole('button',{name:'关闭标签 业务页面 1',exact:true}).click();
  await expect(page.getByRole('link',{name:'页面标签：业务页面 1',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'标签操作',exact:true}).click();
  await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'标签操作',exact:true})).toBeFocused();
});
test('showcase editors, permissions and secondary interactions remain usable',async({page})=>{
  await page.goto('/showcase.html#editors');
  await page.getByRole('button',{name:'全选部门',exact:true}).click();
  await expect(page.getByText('已选：root、dev、design',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'清空部门',exact:true}).click();
  await expect(page.getByText('已选：无',{exact:true})).toBeVisible();
  await page.locator('.rich-text-editor .ql-editor').fill('富文本本地编辑');
  await expect(page.locator('.notice-content')).toContainText('富文本本地编辑');
  await page.goto('/showcase.html#shell');
  await page.getByRole('switch',{name:'允许查看示例内容',exact:true}).click();
  await expect(page.getByText('当前没有查看权限',{exact:true})).toBeVisible();
  await page.goto('/showcase.html#advanced');
  await page.getByRole('button',{name:'打开基础对话框',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'关闭基础对话框',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'显示消息',exact:true}).click();
  await expect(page.getByText('演示消息已显示',{exact:true})).toBeVisible();
  await page.goto('/showcase.html#files');
  await page.locator('input[type=file]').setInputFiles({name:'example.txt',mimeType:'text/plain',buffer:Buffer.from('local sample')});
  await expect(page.getByText('example.txt',{exact:true}).last()).toBeVisible();
  await page.goto('/showcase.html#list');
  await page.getByRole('navigation',{name:'示例分类'}).getByRole('link',{name:'图表看板',exact:true}).click();
  const legend=page.getByRole('group',{name:'月度业务图例'}).getByRole('button',{name:'业务',exact:true});
  await legend.click();await expect(legend).toHaveAttribute('aria-pressed','false');
  await legend.click();await expect(legend).toHaveAttribute('aria-pressed','true');
  await page.goBack();await expect(page).toHaveURL(/#list$/);
});
