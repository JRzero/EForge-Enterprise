import {test,expect} from './fixtures';
test('exact fields preserve digits, zero and empty, reject invalid values and keep readonly drafts',async({page})=>{
  await page.goto('/showcase.html#form');const area=page.getByRole('region',{name:'精确数值示例'}),amount=area.getByLabel('精确金额',{exact:true}),percent=area.getByLabel('百分比',{exact:true});
  await area.getByRole('button',{name:'保存数值示例'}).click();await expect(area.getByLabel('已保存精确数值')).toHaveText('{"amount":"9007199254740993.0100","percent":"0"}');
  await percent.fill('100.0001');await percent.blur();await expect(area.getByRole('alert')).toBeVisible();await area.getByRole('button',{name:'保存数值示例'}).click();await expect(area.getByLabel('已保存精确数值')).toContainText('"percent":"0"');
  await percent.fill('');await area.getByRole('button',{name:'保存数值示例'}).click();await expect(area.getByLabel('已保存精确数值')).toContainText('"percent":""');
  await amount.fill('-');await amount.blur();await expect(area.getByRole('alert')).toContainText('有效');await expect(amount).toHaveValue('-');
  await amount.fill('1.2300');await area.getByRole('button',{name:'数值只读'}).click();await expect(amount).toHaveAttribute('readonly','');await expect(amount).toBeEnabled();await expect(amount).toHaveValue('1.2300');
});
test('grouped paste is exact and ambiguous separators are not silently changed',async({page})=>{
  await page.goto('/showcase.html#form');const area=page.getByRole('region',{name:'精确数值示例'}),amount=area.getByLabel('精确金额',{exact:true});
  await amount.fill('');await amount.focus();
  await amount.evaluate(node=>{const data=new DataTransfer();data.setData('text',' 9,007,199,254,740,993.0100 ');node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  await expect(amount).toHaveValue('9007199254740993.0100');
  await amount.fill('1,23');await amount.blur();await expect(amount).toHaveValue('1,23');await expect(area.getByRole('alert')).toBeVisible();
});
