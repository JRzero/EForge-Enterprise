import {test, expect, type Page} from '@playwright/test';
async function login(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('/notice'); await page.getByLabel('账号', {exact: true}).fill(username); await page.getByLabel('密码', {exact: true}).fill(password); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: username === 'admin' ? '通知公告' : '暂无访问权限', exact: true})).toBeVisible();
}
async function logout(page: Page) {await page.getByRole('button', {name: '退出登录', exact: true}).click(); await expect(page.getByLabel('账号', {exact: true})).toBeVisible();}
async function filter(page: Page, title: string) {await page.locator('.list-filters').getByLabel('公告标题', {exact: true}).fill(title); await page.getByRole('button', {name: '查询', exact: true}).click();}

test('real notice editor uploads PNG/JPG/SVG, retains rich text, reads, clears and deletes', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await login(page);
  await page.getByRole('link', {name:'个人中心',exact:true}).click();
  await expect(page.getByRole('heading', {name:'个人中心',exact:true})).toBeVisible();
  await page.locator('.ef-app-shell__nav').getByRole('link', {name:'通知公告',exact:true}).click();
  const title = `浏览器公告${Date.now()}`;
  await page.getByRole('button', {name: '新增公告', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog.getByRole('alert')).toContainText('请填写');
  await dialog.getByLabel('公告标题', {exact: true}).fill(title); await dialog.getByLabel('公告类型', {exact: true}).selectOption('2');
  const editor = dialog.getByRole('textbox', {name: '公告内容'}); await editor.fill('中文富文本'); await editor.press('Control+a'); await dialog.getByRole('button', {name: '粗体', exact: true}).click(); await editor.press('ArrowRight');
  const imagePath='/api/v1/system/notices/images';let release!:()=>void;let uploads=0;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**'+imagePath,async route=>{uploads++;await gate;await route.continue().catch(()=>{});});
  const requested=page.waitForRequest(request=>new URL(request.url()).pathname===imagePath&&request.method()==='POST');
  const acknowledged=page.waitForResponse(response=>new URL(response.url()).pathname===imagePath&&response.status()===201).catch(cause=>({error:cause}));
  await dialog.locator('input[type=file]').setInputFiles('tests/fixtures/avatar.png');const request=await requested;
  try {
    await page.goBack();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
    await page.locator('.ef-app-shell__nav').getByRole('link',{name:'通知公告',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'图片上传中…',exact:true})).toBeDisabled();
    expect(request.failure()).toBeNull();expect(uploads).toBe(1);
    await page.goBack();await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
  } finally {release();}
  const response=await acknowledged;if('error' in response)throw response.error;
  await expect(page.getByRole('heading',{name:'个人中心',exact:true})).toBeVisible();
  await page.locator('.ef-app-shell__nav').getByRole('link',{name:'通知公告',exact:true}).click();
  await expect(editor.locator('img')).toHaveCount(1);await expect(dialog.getByRole('button',{name:'保存公告',exact:true})).toBeEnabled();expect(uploads).toBe(1);
  await page.unroute('**'+imagePath);
  const jpeg = await page.evaluate(() => {const canvas = document.createElement('canvas'); canvas.width = 3; canvas.height = 2; canvas.getContext('2d')!.fillRect(0, 0, 3, 2); return canvas.toDataURL('image/jpeg').split(',')[1]!;});
  await dialog.locator('input[type=file]').setInputFiles({name: '真实.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64')}); await expect(editor.locator('img')).toHaveCount(2);
  await dialog.locator('input[type=file]').setInputFiles({name: '安全图.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" onload="document.body.dataset.noticeAttack=1"><defs><linearGradient id="paint"><stop stop-color="red" offset="0%"/></linearGradient></defs><style>.shape{fill:url(#paint);background:url(https://external.invalid)}</style><rect class="shape" width="10" height="10"/><script>document.body.dataset.noticeAttack=1</script></svg>')}); await expect(editor.locator('img')).toHaveCount(3);
  await expect.poll(() => editor.locator('img').last().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(10);
  const pixel = await editor.locator('img').last().evaluate(image => {const canvas = document.createElement('canvas'); canvas.width = 10; canvas.height = 10; const context = canvas.getContext('2d')!; context.drawImage(image as HTMLImageElement, 0, 0); return [...context.getImageData(5, 5, 1, 1).data];}); expect(pixel).toEqual([255, 0, 0, 255]);
  const urls = await editor.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')!)); expect(urls[0]).toMatch(/\/profile\/upload\/notices\/[0-9a-f-]+\.png$/); expect(urls[1]).toMatch(/\.png$/); expect(urls[2]).toMatch(/\.svg$/);
  const svg = await page.evaluate(async url => (await fetch(url)).text(), urls[2]!); expect(svg).toContain('linearGradient'); expect(svg).not.toMatch(/script|onload/);
  await dialog.getByLabel('备注', {exact: true}).fill('待清空');
  const noticeCreated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/system/notices' && response.request().method() === 'POST');
  await dialog.getByRole('button', {name: '保存公告', exact: true}).click();
  const creation = await noticeCreated; expect(creation.status()).toBe(201);
  const noticeId: string = (await creation.json()).id;
  await expect(dialog).toHaveCount(0);
  await filter(page, title); await expect(page.getByRole('cell', {name: title, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `预览 ${title}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.locator('strong')).toHaveText('中文富文本'); await expect(dialog.locator('img')).toHaveCount(3); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: /^通知公告（/}).click();
  // Detail rendering precedes the separate read transaction. Escape may close
  // the preview while that write is pending; query readers only after its ack.
  const [readResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/system/notices/read' && response.request().method() === 'POST' && response.request().postDataJSON()?.ids?.includes(noticeId)),
    (async () => {
      await page.getByRole('region', {name: '顶部公告列表'}).getByRole('button', {name: `阅读 ${title}（未读）`, exact: true}).click();
      await expect(page.getByRole('dialog').locator('strong')).toHaveText('中文富文本');
      await page.keyboard.press('Escape');
    })(),
  ]);
  expect(readResponse.status()).toBe(204);
  await page.getByRole('button', {name: `已读用户 ${title}`, exact: true}).click(); await expect(page.getByRole('dialog').getByRole('cell', {name: 'admin', exact: true})).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('checkbox', {name: `选择公告 ${title}`, exact: true}).check(); await page.getByRole('button', {name: '修改所选公告'}).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('textbox', {name: '公告内容'}).fill(''); await dialog.getByLabel('备注', {exact: true}).fill(''); await dialog.getByLabel('公告类型', {exact: true}).selectOption('1'); await dialog.getByRole('radio', {name: '关闭', exact: true}).check(); await dialog.getByRole('button', {name: '保存公告'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: `修改 ${title}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('备注', {exact: true})).toHaveValue(''); await expect(dialog.getByRole('textbox', {name: '公告内容'})).toHaveText(''); await page.keyboard.press('Escape');
  await page.locator('.list-filters').getByLabel('操作人员', {exact: true}).fill('admin'); await page.locator('.list-filters').getByLabel('公告类型', {exact: true}).selectOption('1'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: title, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `删除 ${title}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无公告', {exact: true})).toBeVisible(); expect(errors).toEqual([]);
});

test('real newest-five read state is session-owned, persistent and visible to authorized readers', async ({page}) => {
  await login(page); const prefix = `notice-feed-${Date.now()}`;
  const apiLogin = await page.request.post('/api/v1/auth/login', {data: {username: 'admin', password: 'admin123'}}); expect(apiLogin.status()).toBe(200);
  const adminHeaders = {Authorization: `Bearer ${(await apiLogin.json()).accessToken}`}, username = `nr${Date.now()}`;
  const created = await page.request.post('/api/v1/system/users', {headers: adminHeaders, data: {user: {username, displayName: '无权限公告读者', departmentId: '103', email: '', phone: '', sex: '2', status: '0', roleIds: [], postIds: []}, password: 'User12345'}}); expect(created.status()).toBe(201); const account = await created.json();
  const rows = await page.evaluate(async prefix => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken, rows: {id: string; title: string}[] = [];
    for (let index = 0; index < 6; index++) {const response = await fetch('/api/v1/system/notices', {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({title: `${prefix}-${index}`, type: '2', status: '0', content: '<p>每用户内容</p>'})}); if (response.status !== 201) throw new Error('Notice fixture failed'); rows.push(await response.json());} return rows;
  }, prefix);
  await page.reload(); await expect(page.getByRole('button', {name: '通知公告（5 条未读）'})).toBeVisible(); await page.getByRole('button', {name: /^通知公告（/}).click(); let panel = page.getByRole('region', {name: '顶部公告列表'}); await expect(panel.getByRole('button', {name: /^阅读 /})).toHaveCount(5); await expect(panel.getByRole('button', {name: `阅读 ${prefix}-0（未读）`, exact: true})).toHaveCount(0);
  await panel.getByRole('button', {name: '全部已读', exact: true}).click(); await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible(); await logout(page);
  await login(page, username, 'User12345'); await expect(page.getByRole('button', {name: '通知公告（5 条未读）'})).toBeVisible(); await page.getByRole('button', {name: /^通知公告（/}).click(); panel = page.getByRole('region', {name: '顶部公告列表'}); await panel.getByRole('button', {name: `阅读 ${prefix}-5（未读）`, exact: true}).click(); await expect(page.getByRole('dialog').getByText('每用户内容', {exact: true})).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', {name: '通知公告（4 条未读）'})).toBeVisible(); await page.reload(); await expect(page.getByRole('button', {name: '通知公告（4 条未读）'})).toBeVisible();
  await page.getByRole('button', {name: /^通知公告（/}).click(); panel = page.getByRole('region', {name: '顶部公告列表'}); await panel.getByRole('button', {name: '全部已读', exact: true}).click(); await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible(); await logout(page);
  await login(page); await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible(); await filter(page, `${prefix}-5`); await page.getByRole('button', {name: `已读用户 ${prefix}-5`, exact: true}).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('cell', {name: 'admin', exact: true})).toBeVisible(); await expect(dialog.getByRole('cell', {name: username, exact: true})).toBeVisible(); await expect(dialog.getByText('共 2 位读者，第 1 页', {exact: true})).toBeVisible(); await dialog.getByLabel('读者账号或姓名').fill(username); await dialog.getByRole('button', {name: '搜索读者'}).click(); await expect(dialog.getByText('共 1 位读者，第 1 页', {exact: true})).toBeVisible(); await page.keyboard.press('Escape');
  await page.evaluate(async ids => {const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; const response = await fetch('/api/v1/system/notices', {method: 'DELETE', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ids})}); if (response.status !== 204) throw new Error('Notice fixture cleanup failed');}, rows.map(row => row.id));
  expect((await page.request.delete('/api/v1/system/users', {headers: adminHeaders, data: {ids: [account.id]}})).status()).toBe(204);
});

test('real notice paging, last-page recovery, column visibility and batch deletion', async ({page}) => {
  await login(page); const prefix = `notice-page-${Date.now()}`;
  await page.evaluate(async prefix => {const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; for (let index = 0; index < 12; index++) {const response = await fetch('/api/v1/system/notices', {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({title: `${prefix}-${index}`, type: '1', status: '0', content: ''})}); if (response.status !== 201) throw new Error('Notice paging fixture failed');}}, prefix);
  await filter(page, prefix); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
  for (const index of [0, 1]) await page.getByRole('checkbox', {name: `选择公告 ${prefix}-${index}`, exact: true}).check(); await page.getByRole('button', {name: '删除所选公告'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByText('显示列', {exact: true}).click(); await page.getByRole('checkbox', {name: '创建者', exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '创建者', exact: true})).toHaveCount(0); await page.getByText('显示列', {exact: true}).click();
  await page.getByLabel('每页条数', {exact: true}).selectOption('20'); for (let index = 2; index < 12; index++) await page.getByRole('checkbox', {name: `选择公告 ${prefix}-${index}`, exact: true}).check(); await page.getByRole('button', {name: '删除所选公告'}).click(); await expect(page.getByRole('alertdialog')).toContainText('10 个公告'); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无公告', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '隐藏筛选'}).click(); await expect(page.locator('.list-filters').getByLabel('公告标题')).toBeHidden(); await page.getByRole('button', {name: '显示筛选'}).click(); await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.locator('.list-filters').getByLabel('公告标题')).toHaveValue('');
});
