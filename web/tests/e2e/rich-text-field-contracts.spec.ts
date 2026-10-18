import {expect, test} from './fixtures';

test('standalone rich editor keeps its full content inside the field before following controls',async({page})=>{
  await page.goto('/tests/fixtures/rich-text-field-contracts.html');
  const editor=page.getByRole('textbox',{name:'业务正文',exact:true});
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await editor.fill(Array.from({length:20},(_,index)=>`正文第${index+1}行`).join('\n'));
    expect(await editor.evaluate(element=>parseFloat(getComputedStyle(element).minHeight))).toBeGreaterThanOrEqual(180);
    const field=await page.locator('.rich-text-editor').first().boundingBox();
    const content=await editor.boundingBox();
    const next=await page.getByRole('button',{name:'后续操作',exact:true}).boundingBox();
    expect(content!.y+content!.height).toBeLessThanOrEqual(field!.y+field!.height);
    expect(field!.y+field!.height).toBeLessThanOrEqual(next!.y+1);
  }
});

test('rich text associates stable ids, visible labels, required, hint and caller error with a focusable root', async ({page})=>{
  await page.goto('/tests/fixtures/rich-text-field-contracts.html');
  const editor=page.getByRole('textbox',{name:'业务正文',exact:true});
  await expect(editor).toHaveAttribute('id','contract-content');
  await expect(editor).toHaveAttribute('aria-labelledby','contract-content-label');
  await expect(editor).toHaveAttribute('aria-required','true');
  await expect(editor).toHaveAttribute('aria-invalid','true');
  await expect(editor).toHaveAccessibleDescription('支持格式与图片，请填写完整内容。 正文需要核对');
  await page.locator('label[for="contract-content"]').click(); await expect(editor).toBeFocused();
  await editor.fill('修改正文'); await expect(page.getByLabel('正文值')).toContainText('修改正文');
  await page.getByRole('button',{name:'切换校验'}).click();
  await expect(editor).not.toHaveAttribute('aria-invalid','true');
  await expect(editor).toHaveAccessibleDescription('支持格式与图片，请填写完整内容。');
  await page.getByRole('button',{name:'聚焦正文'}).click(); await expect(editor).toBeFocused();
  const other=page.getByRole('textbox',{name:'补充正文',exact:true}), id=await other.getAttribute('id');
  expect(id).toBeTruthy(); expect(id).not.toBe('contract-content');
  await page.getByRole('button',{name:'切换校验'}).click(); await expect(other).toHaveAttribute('id',id!);
});

test('readonly keeps copy and focus while disabled blocks focus, uploads and formatting; reopening restores editing', async ({page},testInfo)=>{
  await page.goto('/tests/fixtures/rich-text-field-contracts.html');
  const editor=page.getByRole('textbox',{name:'业务正文',exact:true}), field=page.locator('.rich-text-editor').first();
  await editor.fill('保留内容'); await editor.press('Control+a');
  await field.getByRole('button',{name:'链接',exact:true}).click(); await expect(field.locator('.ql-tooltip')).toBeVisible();
  await page.keyboard.press('F6');
  await expect(editor).toHaveAttribute('aria-readonly','true'); await expect(editor).toHaveAttribute('contenteditable','false');
  await expect(field.locator('.ql-tooltip')).toBeHidden();
  await expect(field.locator('.ql-toolbar')).toHaveAttribute('inert','');
  await page.getByRole('button',{name:'聚焦正文'}).click(); await expect(editor).toBeFocused();
  await editor.press('Control+a'); expect((await page.evaluate(()=>window.getSelection()?.toString()))?.trim()).toBe('保留内容');
  await page.keyboard.type('不得写入'); await expect(page.getByLabel('正文值')).toHaveText('<p>保留内容</p>');
  await page.keyboard.press('F7'); await expect(editor).toHaveAttribute('aria-disabled','true'); await expect(editor).toHaveAttribute('tabindex','-1');
  await page.getByRole('button',{name:'聚焦正文'}).click(); await expect(editor).not.toBeFocused();
  const bounds=(await editor.boundingBox())!; await page.mouse.click(bounds.x+20,bounds.y+20); await expect(editor).not.toBeFocused();
  await expect(field.locator('input[type=file]')).toBeDisabled();
  await page.keyboard.press('F8'); await expect(editor).toHaveAttribute('aria-readonly','false'); await expect(editor).toHaveAttribute('aria-disabled','false');
  await expect(field.getByRole('button',{name:'粗体',exact:true})).toBeEnabled();
  await editor.fill('恢复编辑'); await expect(page.getByLabel('正文值')).toContainText('恢复编辑');
  await page.setViewportSize({width:320,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({path:testInfo.outputPath('rich-text-contract-320.png'),fullPage:true});
});

test('showcase uses the shared rich-text field contract on desktop and mobile',async({page},testInfo)=>{
  await page.goto('/showcase.html#editors');
  const editor=page.getByRole('textbox',{name:'公告内容',exact:true});
  await expect(editor).toHaveAttribute('id','showcase-notice-content'); await expect(editor).toHaveAttribute('aria-required','true');
  await page.getByRole('switch',{name:'显示正文错误'}).click(); await expect(editor).toHaveAccessibleDescription('支持排版和图片；只读时仍可聚焦、选择和复制。 请核对正文内容（校验状态演示）');
  await page.getByRole('switch',{name:'只读正文'}).click(); await expect(editor).toHaveAttribute('aria-readonly','true');
  await page.locator('label[for="showcase-notice-content"]').click(); await expect(editor).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('rich-text-showcase-desktop.png'),fullPage:true});
  await page.setViewportSize({width:320,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await editor.scrollIntoViewIfNeeded(); await page.screenshot({path:testInfo.outputPath('rich-text-showcase-mobile.png'),fullPage:true});
});

test('notice editor uses a labelled optional content field and keeps the upload help inside its dialog',async({page},testInfo)=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'writer',displayName:'作者'},roles:[],permissions:['system:notice:list','system:notice:add'],navigation:[{key:'system-notices',type:'ROUTE',routeId:'system-notices',label:'通知公告',order:0,children:[]}]}}));
  await page.route('**/api/v1/system/notices?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.goto('/notice'); await page.getByLabel('账号',{exact:true}).fill('writer'); await page.getByLabel('密码',{exact:true}).fill('password'); await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('button',{name:'新增公告',exact:true}).click();
  const dialog=page.getByRole('dialog'),editor=dialog.getByRole('textbox',{name:'公告内容',exact:true});
  await expect(editor).toHaveAttribute('id','notice-content'); await expect(editor).toHaveAttribute('aria-required','false');
  await expect(editor).toHaveAccessibleDescription('支持文字排版、链接、视频及小于 5 MB 的 JPG、PNG、SVG 图片。');
  await dialog.locator('label[for="notice-content"]').click(); await expect(editor).toBeFocused();
  await editor.fill('真实公告编辑器契约');
  await dialog.screenshot({path:testInfo.outputPath('rich-text-notice-dialog.png')});
});

test('an in-flight image stays queued during readonly and is inserted once after unlocking',async({page})=>{
  await page.goto('/tests/fixtures/rich-text-field-contracts.html');
  const editor=page.getByRole('textbox',{name:'业务正文',exact:true}), field=page.locator('.rich-text-editor').first();
  await field.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png'); await expect(page.getByLabel('上传状态')).toHaveText('上传中');
  await page.keyboard.press('F6'); await page.getByRole('button',{name:'完成上传'}).click(); await expect(page.getByLabel('上传状态')).toHaveText('空闲');
  await expect(editor.locator('img')).toHaveCount(0); await expect(page.getByLabel('上传次数')).toHaveText('1');
  await page.keyboard.press('F8'); await expect(editor.locator('img')).toHaveCount(1);
  await expect(editor.locator('img')).toHaveAttribute('src','/eforge-mark.svg');
  await page.keyboard.press('F6'); await page.keyboard.press('F8'); await expect(editor.locator('img')).toHaveCount(1);
});

test('upload failures remain distinct from field validation and both are described by the editor',async({page})=>{
  await page.goto('/tests/fixtures/rich-text-field-contracts.html');
  const field=page.locator('.rich-text-editor').first(), editor=page.getByRole('textbox',{name:'业务正文',exact:true});
  await field.locator('input[type=file]').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(field.getByRole('alert')).toHaveCount(2);
  await expect(editor).toHaveAccessibleDescription('支持格式与图片，请填写完整内容。 正文需要核对 请选择小于 5 MB 的 JPG、PNG 或 SVG 图片。');
  await page.getByRole('button',{name:'切换校验'}).click(); await expect(field.getByRole('alert')).toHaveCount(1);
  await expect(editor).toHaveAttribute('aria-invalid','true');
  await expect(editor).toHaveAccessibleDescription('支持格式与图片，请填写完整内容。 请选择小于 5 MB 的 JPG、PNG 或 SVG 图片。');
});

test('notice picker consumes Escape only while open and the next Escape closes the dialog',async({page})=>{
  await page.route('**/captchaImage',route=>route.fulfill({json:{code:200,captchaEnabled:false}}));
  await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{accessToken:'fixture-token',tokenType:'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap',route=>route.fulfill({json:{user:{id:'2',username:'writer',displayName:'作者'},roles:[],permissions:['system:notice:list','system:notice:add'],navigation:[{key:'system-notices',type:'ROUTE',routeId:'system-notices',label:'通知公告',order:0,children:[]}]}}));
  await page.route('**/api/v1/system/notices?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:10}}));
  await page.goto('/notice');await page.getByLabel('账号',{exact:true}).fill('writer');await page.getByLabel('密码',{exact:true}).fill('password');await page.getByRole('button',{name:'登录',exact:true}).click();
  const opener=page.getByRole('button',{name:'新增公告',exact:true});await opener.click();
  const dialog=page.getByRole('dialog'),picker=dialog.locator('.ql-size .ql-picker-label');
  await picker.focus();await picker.press('Enter');await expect(picker).toHaveAttribute('aria-expanded','true');
  await picker.press('Escape');await expect(dialog).toBeVisible();await expect(picker).toHaveAttribute('aria-expanded','false');await expect(picker).toBeFocused();
  await picker.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});
