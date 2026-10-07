import {expect, test} from '@playwright/test';

test('notice HTML preserves formatting without executing scripts in a real browser', async ({page}) => {
  await page.goto('/tests/fixtures/notice-rich-text.html');
  await expect(page.getByRole('textbox', {name: '公告内容'})).toBeVisible();
  const result = await page.evaluate(async () => {
    const modulePath = '/features/notices/rich-text.ts';
    const {sanitizeNoticeHtml} = await import(/* @vite-ignore */ modulePath);
    const host = document.createElement('div'); document.body.append(host);
    host.innerHTML = sanitizeNoticeHtml('<h2>安全公告</h2><ol><li class="ql-indent-2">列表</li></ol><p><span style="color:red;font-size:18px;position:fixed">彩色内容</span></p><img src="/missing-notice-image.png" onerror="document.body.dataset.noticeAttack=1"><script>document.body.dataset.noticeAttack=1</script><a href="java&#x09;script:document.body.dataset.noticeAttack=1">危险链接</a><iframe src="data:text/html,evil" srcdoc="<script>parent.document.body.dataset.noticeAttack=1</script>" sandbox="allow-same-origin"></iframe>');
    const link = host.querySelector('a'); link?.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    return {attack: document.body.dataset.noticeAttack, title: host.querySelector('h2')?.textContent,
      color: host.querySelector('span')?.style.color, position: host.querySelector('span')?.style.position,
      indent: host.querySelector('li')?.className, href: link?.getAttribute('href'),
      sandbox: host.querySelector('iframe')?.getAttribute('sandbox'), srcdoc: host.querySelector('iframe')?.hasAttribute('srcdoc')};
  });
  expect(result).toEqual({attack: undefined, title: '安全公告', color: 'red', position: '', indent: 'ql-indent-2', href: null, sandbox: 'allow-scripts allow-presentation', srcdoc: false});
});

test('complete notice editor formats, sanitizes paste, uploads images and cleans up StrictMode mounts', async ({page}) => {
  await page.goto('/tests/fixtures/notice-rich-text.html');
  const editor = page.getByRole('textbox', {name: '公告内容'});
  await expect(editor).toHaveCount(1); await expect(page.locator('.ql-toolbar')).toHaveCount(1);
  for (const format of ['粗体', '斜体', '下划线', '删除线', '引用', '代码块', '清除格式', '链接', '图片', '视频']) await expect(page.getByRole('button', {name: format, exact: true})).toBeVisible();
  await editor.fill('格式测试'); await editor.press('Control+a'); await page.getByRole('button', {name: '粗体', exact: true}).click();
  await expect(page.getByLabel('保存内容')).toContainText('<strong>格式测试</strong>');
  await editor.evaluate(element => {const clipboardData = new DataTransfer(); clipboardData.setData('text/html', '<p><em>粘贴内容</em><img src="/missing-paste.png" onerror="document.body.dataset.noticeAttack=1"></p>'); element.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true, cancelable: true}));});
  await expect(page.getByLabel('保存内容')).toContainText('<em>粘贴内容</em>');
  expect(await page.locator('body').getAttribute('data-notice-attack')).toBeNull();
  await page.getByRole('button', {name: '回填', exact: true}).click(); await expect(editor).toContainText('回填标题');
  await page.route('**/notice-video', route => route.fulfill({contentType: 'text/html', body: '<p>video fixture</p><script>try {parent.document.body.dataset.noticeAttack="1"} catch {document.body.dataset.isolated="1"}</script>'}));
  await editor.click(); await page.getByRole('button', {name: '视频', exact: true}).click();
  await page.locator('.ql-tooltip input').fill('http://127.0.0.1:4175/notice-video'); await page.locator('.ql-tooltip input').press('Enter');
  await expect(editor.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-presentation');
  await expect(page.getByLabel('保存内容')).toContainText('<iframe');
  await expect(page.getByRole('region', {name: '内容预览'}).locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-presentation');
  await expect(page.frameLocator('.ql-container iframe').locator('body')).toHaveAttribute('data-isolated', '1');
  expect(await page.locator('body').getAttribute('data-notice-attack')).toBeNull();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png');
  await expect(page.getByLabel('上传状态')).toHaveText('空闲'); await expect(editor.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.getByRole('button', {name: '切换只读'}).click(); await expect(editor).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', {name: '切换只读'}).click();
  await page.locator('input[type=file]').setInputFiles({name: 'evil.html', mimeType: 'text/html', buffer: Buffer.from('<script>evil</script>')}); await expect(page.getByRole('alert')).toContainText('小于 5 MB');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png'); await expect(page.getByLabel('上传状态')).toHaveText('正在上传');
  await page.getByRole('button', {name: '切换编辑器'}).click(); await expect(page.getByLabel('上传状态')).toHaveText('空闲');
  await page.getByRole('button', {name: '切换编辑器'}).click(); await expect(editor).toHaveCount(1); await expect(page.locator('.ql-toolbar')).toHaveCount(1);
});

test('hidden Activity retains one rich-text upload, queues its genuine result and recreates one toolbar', async ({page}) => {
  await page.goto('/tests/fixtures/notice-rich-text.html');
  await page.getByRole('button', {name:'阻塞上传',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png');
  await expect(page.getByLabel('开始上传')).toHaveText('1');
  await page.getByRole('button', {name:'切换可见',exact:true}).click();
  await expect(page.getByRole('textbox', {name:'公告内容'})).toBeHidden();
  await expect(page.getByLabel('上传状态')).toHaveText('正在上传');
  await expect(page.getByLabel('取消上传')).toHaveText('0');
  await page.getByRole('button', {name:'释放一次上传',exact:true}).click();
  await expect(page.getByLabel('完成上传')).toHaveText('1');
  await page.getByRole('button', {name:'切换可见',exact:true}).click();
  await expect(page.getByRole('textbox', {name:'公告内容'}).locator('img')).toHaveCount(1);
  await expect(page.getByLabel('保存内容')).toContainText('<img');
  await expect(page.locator('.ql-toolbar')).toHaveCount(1);
  await expect(page.getByLabel('上传状态')).toHaveText('空闲');
  await expect(page.getByLabel('开始上传')).toHaveText('1');
  await page.getByRole('button',{name:'阻塞上传',exact:true}).click();
  for(const width of [3,10]) {
    const payload=await page.evaluate(size=>{const canvas=document.createElement('canvas');canvas.width=size;canvas.height=2;return canvas.toDataURL('image/png').split(',')[1]!;},width);
    await page.locator('input[type=file]').setInputFiles({name:'next.png',mimeType:'image/png',buffer:Buffer.from(payload,'base64')});
    await expect(page.getByLabel('上传状态')).toHaveText('空闲');
    await expect(page.getByRole('textbox',{name:'公告内容'}).locator('img')).toHaveCount(width===3?2:3);
  }
  await expect.poll(()=>page.getByRole('textbox',{name:'公告内容'}).locator('img').evaluateAll(images=>images.map(image=>(image as HTMLImageElement).naturalWidth))).toEqual([4,3,10]);
});

test('a disposed rich-text editor cannot insert its old upload into a new form or unlock its pending upload', async ({page}) => {
  await page.goto('/tests/fixtures/notice-rich-text.html');
  await page.getByRole('button', {name:'阻塞上传',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png');
  await expect(page.getByLabel('开始上传')).toHaveText('1');
  await page.getByRole('button', {name:'切换编辑器',exact:true}).click();
  await page.getByRole('button', {name:'切换编辑器',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png');
  await expect(page.getByLabel('开始上传')).toHaveText('2');
  await page.getByRole('button', {name:'释放一次上传',exact:true}).click();
  await expect(page.getByLabel('完成上传')).toHaveText('1');
  await expect(page.getByRole('textbox', {name:'公告内容'}).locator('img')).toHaveCount(0);
  await expect(page.getByLabel('保存内容')).not.toContainText('<img');
  await expect(page.getByLabel('上传状态')).toHaveText('正在上传');
  await page.getByRole('button', {name:'释放一次上传',exact:true}).click();
  await expect(page.getByRole('textbox', {name:'公告内容'}).locator('img')).toHaveCount(1);
  await expect(page.getByLabel('完成上传')).toHaveText('2');
  await expect(page.getByLabel('上传状态')).toHaveText('空闲');
  await expect(page.getByLabel('取消上传')).toHaveText('0');
});