import {test,expect} from './fixtures';

const fixture='/tests/fixtures/group-field-contracts.html';

test('checkbox required describes the group without requiring every option and correction preserves exact IDs',async({page})=>{
  await page.goto(fixture);const group=page.getByRole('group',{name:'通知渠道',exact:true});
  await expect(group).toHaveAttribute('id','contract-checks');await expect(group).not.toHaveAttribute('aria-required');
  await expect(group).toHaveAttribute('aria-invalid','true');await expect(group).toHaveAccessibleDescription('必填 至少保留一个通知渠道 请核对通知渠道');
  await expect(group.locator('input[required]')).toHaveCount(0);
  const old=group.getByRole('checkbox',{name:'原渠道 9007199254740993',exact:true});await expect(old).toBeChecked();
  await expect(old).toHaveAccessibleDescription('必填 至少保留一个通知渠道 请核对通知渠道');
  await group.getByRole('checkbox',{name:'可用项',exact:true}).check();
  expect(JSON.parse(await page.getByLabel('当前草稿').innerText()).checks).toEqual(['9007199254740993','new']);
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByLabel('保存次数')).toHaveText('1');
  await page.getByRole('button',{name:'切换错误',exact:true}).click();await expect(group).not.toHaveAttribute('aria-invalid','true');
  await expect(group).toHaveAccessibleDescription('必填 至少保留一个通知渠道');await expect(old).toBeChecked();
});

test('radio groups expose required and help without sharing names or losing unknown values',async({page})=>{
  await page.goto(fixture);const group=page.getByRole('radiogroup',{name:'服务等级',exact:true}),other=page.getByRole('radiogroup',{name:'第二服务等级',exact:true});
  await expect(group).toHaveAttribute('id','contract-radio');await expect(group).toHaveAttribute('aria-required','true');
  await expect(group).toHaveAccessibleDescription('请选择服务等级 请核对服务等级');
  await expect(group.getByRole('radio',{name:'原等级 9007199254740993',exact:true})).toBeChecked();
  expect(await group.getByRole('radio').first().getAttribute('name')).not.toBe(await other.getByRole('radio').first().getAttribute('name'));
  await group.getByRole('radio',{name:'可用项',exact:true}).check();await other.getByRole('radio',{name:'另一等级',exact:true}).check();
  await expect(group.getByRole('radio',{name:'可用项',exact:true})).toBeChecked();await expect(group.getByRole('radio',{name:'停用项',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'切换错误',exact:true}).click();await expect(group).not.toHaveAttribute('aria-invalid','true');await expect(group).toHaveAccessibleDescription('请选择服务等级');
});

test('date required and errors attach to both exact inputs without duplicate error announcements',async({page})=>{
  await page.goto(fixture);const group=page.getByRole('group',{name:'服务周期',exact:true}),from=group.getByLabel('开始日期',{exact:true}),to=group.getByLabel('结束日期',{exact:true});
  await expect(from).toHaveAttribute('id','contract-period-from');await expect(to).toHaveAttribute('id','contract-period-to');
  for(const input of [from,to]){await expect(input).toHaveAttribute('aria-required','true');await expect(input).toHaveAccessibleDescription('按日期保存，不转换时区 请核对日期');}
  await expect(group.getByRole('alert')).toHaveCount(1);
  await to.fill('2026-10-15');await page.getByRole('button',{name:'定位结束日期',exact:true}).click();await expect(to).toBeFocused();
  expect(JSON.parse(await page.getByLabel('当前草稿').innerText()).dates).toEqual({from:'2026-10-01',to:'2026-10-15'});
  await page.getByRole('button',{name:'切换错误',exact:true}).click();await expect(to).not.toHaveAttribute('aria-invalid','true');await expect(to).toHaveAccessibleDescription('按日期保存，不转换时区');
  await group.getByRole('button',{name:'清空服务周期',exact:true}).click();await expect(from).toHaveValue('');await expect(to).toHaveValue('');
});

test('focus handles select a real option, retain readonly group focus and do nothing while disabled',async({page})=>{
  await page.goto(fixture);const checks=page.getByRole('group',{name:'通知渠道',exact:true}),radio=page.getByRole('radiogroup',{name:'服务等级',exact:true});
  await page.getByRole('button',{name:'定位多选',exact:true}).click();await expect(checks.getByRole('checkbox',{name:'原渠道 9007199254740993',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'定位单选',exact:true}).click();await expect(radio.getByRole('radio',{name:'原等级 9007199254740993',exact:true})).toBeFocused();
  const before=await page.getByLabel('当前草稿').innerText();await page.getByRole('button',{name:'只读',exact:true}).click();
  for(const [label,group] of [['定位多选',checks],['定位单选',radio]] as const){await page.getByRole('button',{name:label,exact:true}).click();await expect(group).toBeFocused();await page.keyboard.press('Space');}
  await page.getByRole('button',{name:'定位空组',exact:true}).click();await expect(page.getByRole('group',{name:'空的渠道',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'定位结束日期',exact:true}).click();await expect(page.locator('#contract-period-to')).toBeFocused();await expect(page.locator('#contract-period-to')).not.toBeEditable();
  await page.getByRole('button',{name:'禁用',exact:true}).click();
  for(const name of ['定位多选','定位单选','定位结束日期','定位空组']){const action=page.getByRole('button',{name,exact:true});await action.click();await expect(action).toBeFocused();}
  await expect(page.getByLabel('当前草稿')).toHaveText(before);await page.getByRole('button',{name:'编辑',exact:true}).click();await checks.getByRole('checkbox',{name:'可用项',exact:true}).check();
});

test('group labels, descriptions and unique IDs stay within a 320px viewport',async({page},info)=>{
  await page.setViewportSize({width:320,height:900});await page.goto(fixture);
  await expect(page.getByRole('radiogroup',{name:'服务等级',exact:true})).toBeVisible();
  const duplicates=await page.locator('[id]').evaluateAll(elements=>{const seen=new Set<string>();return elements.filter(element=>{const duplicate=seen.has(element.id);seen.add(element.id);return duplicate;}).map(element=>element.id);});expect(duplicates).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({path:info.outputPath('group-field-contracts-320.png'),fullPage:true});
});
