import {test,expect} from './fixtures';

test('form primitives preserve unknown selections and protect read-only and busy states',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/tests/fixtures/form-states.html');
  const code=page.getByRole('textbox',{name:'必填编码',exact:true});await expect(code).toHaveAttribute('aria-required','true');await expect(code).toHaveAttribute('aria-invalid','true');await expect(code).toHaveAccessibleDescription('请填写业务编码 编码已存在');
  await expect(page.getByLabel('只读编码',{exact:true})).not.toBeEditable();await expect(page.getByLabel('禁用编码',{exact:true})).toBeDisabled();
  const radio=page.getByRole('radiogroup',{name:'原值单选',exact:true});await expect(radio.getByRole('radio',{name:'旧选项 9007199254740993',exact:true})).toBeChecked();await expect(radio.getByRole('radio',{name:'停用项',exact:true})).toBeDisabled();
  await radio.getByRole('radio',{name:'有效项',exact:true}).check();await expect(radio.getByRole('radio',{name:'旧选项 9007199254740993',exact:true})).toHaveCount(0);
  await expect(page.getByRole('radiogroup',{name:'只读单选',exact:true}).getByRole('radio')).toBeDisabled();await expect(page.getByRole('radiogroup',{name:'空单选',exact:true})).toHaveText('空单选暂无选项');
  const checks=page.getByRole('group',{name:'原值多选',exact:true});await expect(checks.getByRole('checkbox',{name:'旧选项 missing',exact:true})).toBeChecked();await checks.getByRole('checkbox',{name:'旧选项 missing',exact:true}).click();await expect(checks.getByRole('checkbox',{name:'旧选项 missing',exact:true})).toHaveCount(0);
  for(const name of ['禁用多选','只读选项'])await expect(page.getByRole('group',{name,exact:true}).getByRole('checkbox')).toBeDisabled();
  await expect(page.getByRole('group',{name:'只读日期',exact:true}).getByLabel('开始日期')).not.toBeEditable();await expect(page.getByRole('group',{name:'只读日期',exact:true}).getByRole('button')).toHaveCount(0);await expect(page.getByRole('group',{name:'禁用日期',exact:true}).getByLabel('结束日期')).toBeDisabled();
  const detail=page.getByRole('region',{name:'保存中明细',exact:true});await expect(detail).toHaveAttribute('aria-busy','true');await expect(detail.getByRole('button',{name:'新增明细',exact:true})).toBeDisabled();await expect(detail.getByRole('button',{name:'删除明细',exact:true})).toBeDisabled();await expect(detail.getByLabel('明细编号')).toBeDisabled();await expect(detail.getByRole('alert')).toHaveText('请检查此行');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('form-states-mobile.png'),fullPage:true});expect(errors).toEqual([]);
});
