import {test,expect} from './fixtures';
const file=(name:string)=>({name,mimeType:'text/plain',buffer:Buffer.from('demo')});
test('file queue preserves prior and mixed successes, retries failures and cancels without late writes',async({page})=>{
  await page.goto('/showcase.html#files');const area=page.getByRole('region',{name:'文件队列示例'}),input=area.getByLabel('演示附件'),output=area.getByLabel('演示文件列表');
  await input.setInputFiles([file('ok.txt'),file('fail.txt')]);await expect(area.getByText('文件处理中',{exact:true})).toBeVisible();
  await expect(area.getByRole('button',{name:'重试 fail.txt'})).toBeEnabled();await expect(output).toHaveText('["原有文件.txt","ok.txt"]');
  await area.getByRole('button',{name:'重试 fail.txt'}).click();await expect(output).toHaveText('["原有文件.txt","ok.txt","fail.txt"]');
  await input.setInputFiles(file('cancel.txt'));await area.getByRole('button',{name:'取消上传'}).click();await expect(area.getByText('文件空闲',{exact:true})).toBeVisible();await expect(output).not.toContainText('cancel.txt');
  await area.getByRole('button',{name:'重试 cancel.txt'}).click();await expect(output).toContainText('cancel.txt');
  await area.getByRole('button',{name:'文件只读',exact:true}).click();await expect(input).toBeDisabled();for(const button of await area.getByRole('button',{name:'移除文件',exact:true}).all())await expect(button).toBeDisabled();
});
test('Activity hiding retains an upload and queue limits reject before changing prior files',async({page})=>{
  await page.goto('/showcase.html#files');const area=page.getByRole('region',{name:'文件队列示例'}),input=area.getByLabel('演示附件'),output=area.getByLabel('演示文件列表');
  await input.setInputFiles(file('hidden.txt'));await area.getByRole('button',{name:'隐藏文件示例'}).click();await expect(output).toHaveText('["原有文件.txt","hidden.txt"]');await expect(area.getByText('文件空闲',{exact:true})).toBeVisible();await area.getByRole('button',{name:'显示文件示例'}).click();
  await input.setInputFiles([file('1.txt'),file('2.txt'),file('3.txt'),file('4.txt')]);await expect(area.getByRole('alert')).toContainText('最多上传5个文件');await expect(output).toHaveText('["原有文件.txt","hidden.txt"]');
  await input.setInputFiles(file('bad.exe'));await expect(area.getByRole('alert')).toContainText('TXT');await expect(output).toHaveText('["原有文件.txt","hidden.txt"]');
});
