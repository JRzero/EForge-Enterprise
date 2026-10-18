import {test, expect} from './fixtures';
import type {Locator, Page} from '@playwright/test';

type Kind = 'multi' | 'tree' | 'reference';
const names = {multi:'参与人员', tree:'负责部门', reference:'关联客户'};
const oldId = '9007199254740993', nextId = '9007199254740995';
const fixture = '/tests/fixtures/field-contracts.html';
function control(page: Page, kind: Kind, prefix='contract') {return page.locator(`#${prefix}-${kind}`);}
function popup(page: Page, kind: Kind) {return page.getByRole(kind === 'tree' ? 'tree' : 'listbox', {name:kind === 'reference' ? `${names[kind]} Required` : `${names[kind]}选项`,exact:true});}
async function open(page: Page, kind: Kind, prefix='contract') {await control(page,kind,prefix).click();await expect(popup(page,kind)).toBeVisible();}
async function assertLinkedDescriptions(target: Locator) {
  const result = await target.evaluate(element => (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map(id=>({id, count:document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length})));
  expect(result.length).toBeGreaterThan(0);
  for (const item of result) expect(item.count, item.id).toBe(1);
}

test('FormField associates one exact label with native and composite controls and keeps explicit identity', async ({page}) => {
  await page.goto(fixture);
  const code = page.locator('#contract-code');
  await expect(code).toHaveAccessibleName('业务编码');
  await expect(code).toHaveAttribute('aria-required','true');
  await expect(code).toHaveAttribute('aria-invalid','true');
  await expect(code).toHaveAccessibleDescription('编码用于识别业务 业务编码已存在');
  await page.locator('label[for="contract-code"]').click();await expect(code).toBeFocused();
  await code.fill('B002');
  await expect(page.locator('#contract-note')).toHaveAccessibleName('补充说明');
  const automatic = [await page.getByLabel('自动编号字段甲',{exact:true}).getAttribute('id'),await page.getByLabel('自动编号字段乙',{exact:true}).getAttribute('id')];
  expect(automatic.every(Boolean)).toBe(true);expect(new Set(automatic).size).toBe(2);
  await page.getByRole('button',{name:'切换字段错误',exact:true}).click();
  await expect(code).not.toHaveAttribute('aria-invalid','true');await expect(code).toHaveAccessibleDescription('编码用于识别业务');await expect(code).toHaveValue('B002');
});

for (const kind of ['multi','tree','reference'] as const) {
  test(`${kind} connects required, help and field errors without blocking correction or losing exact IDs`, async ({page}) => {
    await page.goto(fixture);
    const target = control(page,kind);
    await expect(target).toHaveAttribute('aria-required','true');await expect(target).toHaveAttribute('aria-invalid','true');
    await expect(target).toHaveAccessibleDescription(`请选择当前业务的${names[kind]} 请核对${names[kind]}`);
    await assertLinkedDescriptions(target);
    await expect(page.locator(`label[for="contract-${kind}"]`)).toHaveCount(1);
    await open(page,kind);
    if (kind === 'multi') {await target.fill('新人员');await target.press('ArrowDown');await target.press('Enter');}
    else if (kind === 'tree') await popup(page,kind).getByRole('button',{name:'新部门',exact:true}).click();
    else await popup(page,kind).getByRole('option',{name:'新客户',exact:true}).click();
    const selected = JSON.parse(await page.getByLabel('当前选择').innerText()) as {people:string[];department:string;customer:string};
    expect(kind==='multi'?selected.people:kind==='tree'?selected.department:selected.customer).toEqual(kind==='multi'?[oldId,nextId]:nextId);
    await page.getByRole('button',{name:'切换字段错误',exact:true}).click();
    await expect(target).not.toHaveAttribute('aria-invalid','true');await expect(target).toHaveAccessibleDescription(`请选择当前业务的${names[kind]}`);
    if(kind==='multi')await expect(target).toHaveValue('新人员');
    await expect(page.getByLabel('已保存次数')).toHaveText('0');
  });

  test(`${kind} separates option failure from field validation and preserves the old record on retry`, async ({page}) => {
    await page.goto(fixture);await page.getByRole('button',{name:'选项失败',exact:true}).click();
    const section = page.getByRole('region',{name:`${names[kind]}测试`,exact:true});
    if(kind==='tree')await control(page,kind).click();
    await expect(section.getByText('请核对'+names[kind],{exact:true})).toBeVisible();
    await expect(section.getByRole('alert').filter({hasText:'选项加载失败'})).toBeVisible();
    await section.getByRole('button',{name:'重试'+names[kind],exact:true}).click();
    await expect(control(page,kind)).toHaveAttribute('aria-invalid','true');
    if(kind==='tree'){await expect(control(page,kind)).toHaveAttribute('aria-expanded','true');await expect(control(page,kind)).toBeFocused();}
    await expect(section.getByRole('alert').filter({hasText:'选项加载失败'})).toHaveCount(0);
    await expect(page.getByLabel('当前选择')).toHaveText(JSON.stringify({people:[oldId],department:oldId,customer:oldId}));
    await expect(page.getByLabel('已保存次数')).toHaveText('0');
  });

  for (const mode of ['readonly','disabled'] as const) test(`${kind} does not reopen an old popup after ${mode} changes`, async ({page}) => {
    await page.goto(fixture);await open(page,kind);
    await page.keyboard.press(mode==='readonly'?'F6':'F7');await expect(popup(page,kind)).toHaveCount(0);
    if(mode==='readonly'){
      await expect(control(page,kind)).not.toBeDisabled();await expect(control(page,kind)).toHaveAttribute('aria-readonly','true');
      await control(page,kind).focus();await expect(control(page,kind)).toBeFocused();await control(page,kind).press('Enter');await expect(popup(page,kind)).toHaveCount(0);
    }else await expect(control(page,kind)).toBeDisabled();
    await page.keyboard.press('F8');await expect(control(page,kind)).toHaveAttribute('aria-expanded','false');await expect(popup(page,kind)).toHaveCount(0);
    await expect(page.getByLabel('当前选择')).toHaveText(JSON.stringify({people:[oldId],department:oldId,customer:oldId}));
    await open(page,kind);
  });

  test(`${kind} consumes only the popup Escape and the dialog closes on the next Escape`, async ({page}) => {
    await page.goto(fixture);const opener=page.getByRole('button',{name:`打开${names[kind]}弹窗`,exact:true});await opener.click();
    const dialog=page.getByRole('dialog',{name:`${names[kind]}设置`,exact:true});await open(page,kind,'dialog');
    if(kind==='tree')await dialog.getByRole('searchbox',{name:`搜索${names[kind]}`,exact:true}).focus();
    await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(popup(page,kind)).toHaveCount(0);await expect(control(page,kind,'dialog')).toBeFocused();
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  });

  test(`${kind} outside click reaches the dialog save action without submitting during selection`, async ({page}) => {
    await page.goto(fixture);await page.getByRole('button',{name:`打开${names[kind]}弹窗`,exact:true}).click();await open(page,kind,'dialog');
    // The pinned ReferenceSelect is an overlay: use the visible header action,
    // not the footer geometrically underneath its option panel.
    await page.getByRole('button',{name:kind==='reference'?'保存并关闭':'保存弹窗',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('已保存次数')).toHaveText('1');
  });
}

test('tree focus moves inside its panel and closes only when focus leaves the whole control', async ({page}) => {
  await page.goto(fixture);await open(page,'tree');
  const search=page.getByRole('searchbox',{name:'搜索负责部门',exact:true});await search.focus();await search.press('ArrowDown');
  await expect(popup(page,'tree').getByRole('treeitem').first()).toBeFocused();await expect(popup(page,'tree')).toBeVisible();
  await page.getByRole('button',{name:'保存当前值',exact:true}).focus();await expect(popup(page,'tree')).toHaveCount(0);await expect(page.getByRole('button',{name:'保存当前值',exact:true})).toBeFocused();
});

test('multi active descendant never points to an option removed by loading or an error', async ({page}) => {
  await page.goto(fixture);const input=control(page,'multi');await input.fill('新人员');await input.press('ArrowDown');await expect(input).toHaveAttribute('aria-activedescendant',/.+/);
  await page.keyboard.press('F9');await expect(input).not.toHaveAttribute('aria-activedescendant',/.+/);await expect(popup(page,'multi').getByRole('option')).toHaveCount(0);
  await page.keyboard.press('F8');await input.press('ArrowDown');await page.keyboard.press('F10');await expect(input).not.toHaveAttribute('aria-activedescendant',/.+/);
  await expect(page.getByLabel('当前选择')).toHaveText(JSON.stringify({people:[oldId],department:oldId,customer:oldId}));
});

for(const mode of ['loading','failed'] as const)test(`reference closes pending options when ${mode} changes and restores a closed editor`,async({page})=>{
  await page.goto(fixture);await open(page,'reference');
  await page.keyboard.press(mode==='loading'?'F9':'F10');await expect(popup(page,'reference')).toHaveCount(0);await expect(control(page,'reference')).toBeDisabled();
  await expect(control(page,'reference')).toContainText('原客户');await expect(page.getByLabel('当前选择')).toHaveText(JSON.stringify({people:[oldId],department:oldId,customer:oldId}));
  await page.keyboard.press('F8');await expect(control(page,'reference')).toHaveAttribute('aria-expanded','false');await open(page,'reference');
  await popup(page,'reference').getByRole('option',{name:'新客户',exact:true}).click();await expect(control(page,'reference')).toContainText('新客户');
});

test('multi Escape returns arrow focus to the primary control and outside focus is retained',async({page})=>{
  await page.goto(fixture);await open(page,'multi');await page.getByRole('button',{name:'收起参与人员',exact:true}).focus();
  await page.keyboard.press('Escape');await expect(control(page,'multi')).toBeFocused();await expect(control(page,'multi')).toHaveAttribute('aria-expanded','false');
  await open(page,'multi');const save=page.getByRole('button',{name:'保存当前值',exact:true});await save.focus();await expect(popup(page,'multi')).toHaveCount(0);await expect(save).toBeFocused();
});

test('field errors and help stay within a 320px viewport', async ({page},info) => {
  await page.setViewportSize({width:320,height:800});await page.goto(fixture);
  await expect(control(page,'multi')).toHaveAccessibleDescription('请选择当前业务的参与人员 请核对参与人员');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({path:info.outputPath('field-contracts-320.png'),fullPage:true});
});

test('reference keeps its generated field identity across availability changes',async({page})=>{
  await page.goto(fixture);
  const target=page.getByLabel('自动关联客户',{exact:true}), id=await target.getAttribute('id');
  expect(id).toBeTruthy();
  for(const key of ['F9','F8','F10','F8','F7','F8']){
    await page.keyboard.press(key);await expect(target).toHaveAttribute('id',id!);
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
  }
  await expect(target).toHaveAttribute('aria-expanded','false');
  await expect(target).toContainText('原客户');
});

for(const origin of ['search','treeitem'] as const)test(`tree readonly returns focus from its ${origin} without reopening`,async({page})=>{
  await page.goto(fixture);await open(page,'tree');
  const search=page.getByRole('searchbox',{name:'搜索负责部门',exact:true});await search.focus();
  if(origin==='treeitem')await search.press('ArrowDown');
  await page.keyboard.press('F6');
  await expect(popup(page,'tree')).toHaveCount(0);await expect(control(page,'tree')).toBeFocused();
  await expect(control(page,'tree')).toHaveAttribute('aria-readonly','true');
  await page.keyboard.press('F8');await expect(control(page,'tree')).toBeFocused();
  await expect(control(page,'tree')).toHaveAttribute('aria-expanded','false');
});

test('tree readonly triggered by an outside action keeps that action focused',async({page})=>{
  await page.goto(fixture);await open(page,'tree');await page.getByRole('searchbox',{name:'搜索负责部门',exact:true}).focus();
  const action=page.getByRole('button',{name:'切换只读',exact:true});await action.click();
  await expect(popup(page,'tree')).toHaveCount(0);await expect(control(page,'tree')).toHaveAttribute('aria-readonly','true');await expect(action).toBeFocused();
});

test('reference short dialog footer remains reachable after dismissing its overlay',async({page})=>{
  await page.goto(fixture);const opener=page.getByRole('button',{name:'打开关联客户弹窗',exact:true});await opener.click();await open(page,'reference','dialog');
  // This layer can cover the footer while open. Prove the normal dismissal and
  // footer path separately, rather than substituting a header action for it.
  await page.keyboard.press('Escape');await expect(control(page,'reference','dialog')).toBeFocused();
  await page.getByRole('button',{name:'保存弹窗',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('已保存次数')).toHaveText('1');await expect(opener).toBeFocused();
});
