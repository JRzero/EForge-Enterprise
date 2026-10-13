import {test,expect} from './fixtures';

const sections=['overview','list','tree-list','master-detail','form','detail','approval','account','controls','feedback','workspace','shell','advanced','editors','charts','files'];

test('workflow local approval template keeps actions and history consistent across tabs',async({page})=>{
  await page.goto('/showcase.html#approval');
  await page.getByRole('tab',{name:'处理记录',exact:true}).click();
  await expect(page.getByText('林小禾提交申请',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'模拟批准',exact:true}).click();
  await expect(page.getByText('主管批准申请',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'申请与任务',exact:true}).click();
  await expect(page.getByText('已批准',{exact:true})).toBeVisible();
  await expect(page.getByText('流程已结束',{exact:true})).toBeVisible();
});

test('shared async states and confirmation keep retry, busy protection and return focus',async({page})=>{
  await page.goto('/showcase.html#feedback');
  const block=page.locator('section').filter({has:page.getByRole('heading',{name:'异步内容与操作确认',exact:true})});
  await block.getByRole('button',{name:'演示加载',exact:true}).click();
  await expect(block.locator('.ui-feedback[role=status]')).toHaveText('正在加载…');
  await block.getByRole('button',{name:'演示空数据',exact:true}).click();
  await expect(block.locator('.ui-feedback[role=status]')).toHaveText('暂无数据');
  await block.getByRole('button',{name:'演示失败',exact:true}).click();
  await expect(block.getByRole('alert')).toContainText('示例加载失败');
  await block.getByRole('button',{name:'重试',exact:true}).click();
  const trigger=block.getByRole('button',{name:'打开操作确认',exact:true});await trigger.click();
  const dialog=page.getByRole('alertdialog',{name:'确认示例操作',exact:true});
  await dialog.getByRole('button',{name:'确认操作',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText('示例操作失败，请重试');
  await dialog.getByRole('button',{name:'确认操作',exact:true}).click();
  await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
});

test('tree list template preserves selection while the phone sidebar is collapsed',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/showcase.html#tree-list');
  await page.getByRole('button',{name:'停用',exact:true}).click();
  await expect(page.getByRole('row')).toHaveCount(9);
  await page.getByRole('button',{name:'收起客户分类 · 停用',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'客户分类',exact:true})).toBeHidden();
  await expect(page.getByRole('row')).toHaveCount(9);
  await page.setViewportSize({width:1440,height:900});
  await expect(page.getByRole('complementary',{name:'客户分类',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'停用',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('shared form field and choice groups keep labels, keyboard and disabled choices',async({page})=>{
  await page.goto('/showcase.html#form');
  await expect(page.getByLabel('客户编码',{exact:true})).toHaveAccessibleDescription('用于内部识别客户');
  const channels=page.getByRole('group',{name:'通知渠道',exact:true});
  await expect(channels.getByRole('checkbox',{name:'邮件',exact:true})).toBeChecked();
  await channels.getByRole('checkbox',{name:'短信',exact:true}).check();
  await expect(channels.getByRole('checkbox',{name:'邮件',exact:true})).toBeChecked();
  await expect(channels.getByRole('checkbox',{name:'传真（停用）',exact:true})).toBeDisabled();
  const normal=page.getByRole('radio',{name:'标准',exact:true});
  await normal.focus();await normal.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'优先',exact:true})).toBeChecked();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
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
      for(const name of ['基本信息','业务与记录']) { await page.getByRole('tab',{name,exact:true}).click();for(const label of await page.locator('.detail-field dt:visible').all())expect((await label.boundingBox())!.width).toBe(100); }
      await page.getByRole('tab',{name:'基本信息',exact:true}).click();
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

test('detail template links tabs and preserves mounted panel contents',async({page})=>{
 await page.goto('/showcase.html#detail');const first=page.getByRole('tab',{name:'基本信息',exact:true});await first.focus();await first.press('End');
 const history=page.getByRole('tab',{name:'业务与记录',exact:true});await expect(history).toBeFocused();await expect(page.getByRole('tabpanel',{name:'业务与记录',exact:true})).toBeVisible();await expect(page.getByText('2026-10-09 · 界面验收中',{exact:true})).toBeVisible();
 await history.press('Home');await expect(first).toBeFocused();await expect(page.getByRole('tabpanel',{name:'基本信息',exact:true})).toContainText('EF-2026-001');await expect(page.locator('.detail-tab-panel')).toHaveCount(2);
});

test('master detail template keeps row identity when deleting, validates and supports readonly',async({page},info)=>{
 await page.goto('/showcase.html#master-detail');await expect(page.getByText('暂无明细',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'保存采购单',exact:true}).click();await expect(page.locator('.enterprise-form > p[role=status]')).toHaveText('请填写采购单名称及有效明细。');
 await page.getByRole('button',{name:'新增明细',exact:true}).click();await expect(page.getByLabel('商品名称 1',{exact:true})).toBeFocused();await page.getByLabel('商品名称 1',{exact:true}).fill('产品甲');
 await page.getByRole('button',{name:'新增明细',exact:true}).click();await page.getByLabel('商品名称 2',{exact:true}).fill('产品乙');await page.getByLabel('数量 2',{exact:true}).fill('3');await page.getByLabel('单价 2',{exact:true}).fill('12.50');
 const key=await page.locator('tr[data-detail-row]').nth(1).getAttribute('data-detail-row');await page.getByRole('button',{name:'删除明细',exact:true}).first().click();await expect(page.locator('tr[data-detail-row]').first()).toHaveAttribute('data-detail-row',key!);await expect(page.getByLabel('商品名称 1',{exact:true})).toHaveValue('产品乙');await expect(page.getByLabel('商品名称 1',{exact:true})).toBeFocused();await expect(page.getByText('合计：37.50 元',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'保存采购单',exact:true}).click();await expect(page.locator('.enterprise-form > p[role=status]')).toContainText('已保存 1 行明细');
 await page.getByLabel('只读展示',{exact:true}).check();await expect(page.getByRole('button',{name:'新增明细',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'删除明细',exact:true})).toHaveCount(0);await expect(page.getByRole('cell',{name:'产品乙',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('master-detail-mobile.png'),fullPage:true});
});
