import {fileURLToPath} from 'node:url';
import {test, expect, builtChunk, login, openPosts} from './fixtures';

test('release login contract rejects then recovers, preserves a deep link on refresh and logs out', async ({page, mock}) => {
  const path = '/post?entry=release-check#table';
  mock.rejectLogin = true;
  await login(page, path);
  await expect(page.getByRole('alert')).toContainText('账号或密码不正确');
  await expect(page.getByLabel('密码', {exact: true})).toHaveValue('');
  expect(mock.bootstrapCalls).toBe(0);
  mock.rejectLogin = false;
  await page.getByLabel('密码', {exact: true}).fill('DistFixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('cell', {name: '构建验收岗位', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: '9007199254740995', exact: true})).toBeVisible();
  await expect(page).toHaveURL(`http://127.0.0.1:4176${path}`);
  expect(mock.loginRequests).toEqual(Array.from({length: 2}, () => ({username: 'dist-reader', password: 'DistFixture123'})));
  const before = mock.bootstrapCalls;
  const document = await page.reload();
  expect(document?.status()).toBe(200);
  await expect(page.getByRole('cell', {name: '构建验收岗位', exact: true})).toBeVisible();
  await expect(page).toHaveURL(`http://127.0.0.1:4176${path}`);
  expect(mock.bootstrapCalls).toBe(before + 1);
  expect(mock.loginRequests).toHaveLength(2);
  await page.getByRole('button', {name: '退出登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '登录工作空间', exact: true})).toBeVisible();
  expect(mock.logoutCalls).toBe(1);
  expect(mock.pageErrors).toEqual([]);
});

test('release loads a real lazy page only on demand and its dialog submits through the canonical contract', async ({page, mock}, info) => {
  const postsChunk = builtChunk('PostsPage');
  await login(page);
  await expect(page.getByRole('heading', {name: '你好，构建验收账号', exact: true})).toBeVisible();
  expect(mock.assets).not.toContain(postsChunk);
  const script = page.waitForResponse(response => new URL(response.url()).pathname === postsChunk && response.status() === 200);
  await openPosts(page);
  expect((await script).headers()['content-type']).toMatch(/javascript/);
  await expect(page.getByRole('cell', {name: '构建验收岗位', exact: true})).toBeVisible();
  const opener = page.getByRole('button', {name: '新增岗位', exact: true});
  await opener.click();
  const dialog = page.getByRole('dialog', {name: '新增岗位', exact: true});
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('textbox', {name: '岗位编码', exact: true}).fill('dist-created');
  await dialog.getByRole('textbox', {name: '岗位名称', exact: true}).fill('发布产物新增岗位');
  await page.screenshot({path: info.outputPath('release-editor.png')});
  await dialog.getByRole('button', {name: '保存岗位', exact: true}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', {name: '发布产物新增岗位', exact: true})).toBeVisible();
  expect(mock.createdPosts).toEqual([{code: 'dist-created', name: '发布产物新增岗位', sort: 0, status: '0', remark: ''}]);
  expect(mock.pageErrors).toEqual([]);
});

test('a failed fingerprinted page chunk keeps navigation usable and recovers after restoring the resource and reloading', async ({page, mock}, info) => {
  const chunk = builtChunk('PostsPage'), chunkUrl = `http://127.0.0.1:4176${chunk}`;
  let failures = 0;
  await page.route(chunkUrl, route => {failures++; return route.abort('failed');});
  await login(page);
  await expect(page.getByRole('heading', {name: '你好，构建验收账号', exact: true})).toBeVisible();
  await openPosts(page);
  const failure = page.getByRole('alert').filter({hasText: '岗位管理暂时无法打开'});
  await expect(failure).toBeVisible();
  expect(failures).toBeGreaterThan(0);
  expect(mock.postQueries).toEqual([]);
  await page.screenshot({path: info.outputPath('release-chunk-failure.png')});
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '工作台', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，构建验收账号', exact: true})).toBeVisible();
  await openPosts(page);
  await expect(failure).toBeVisible();
  await page.unroute(chunkUrl);
  // Browsers cache a rejected dynamic import for this document. The supported
  // full reload must fetch the restored file and preserve the current route.
  const recovered = page.waitForResponse(response => response.url() === chunkUrl && response.status() === 200);
  const before = mock.bootstrapCalls;
  await failure.getByRole('button', {name: '重新加载应用', exact: true}).click();
  expect((await recovered).headers()['content-type']).toMatch(/javascript/);
  await expect(page).toHaveURL(/\/post$/);
  await expect(page.getByRole('cell', {name: '构建验收岗位', exact: true})).toBeVisible();
  await expect(failure).toHaveCount(0);
  expect(mock.bootstrapCalls).toBe(before + 1);
  expect(mock.loginRequests).toHaveLength(1);
  expect(mock.postQueries.length).toBeGreaterThan(0);
});

test('a failed workspace chunk displays recovery controls and restores the authenticated deep link', async ({page, mock}) => {
  const chunkUrl = `http://127.0.0.1:4176${builtChunk('AuthenticatedApplication')}`;
  let failures = 0;
  await page.route(chunkUrl, route => {failures++; return route.abort('failed');});
  await login(page, '/post');
  const failure = page.getByRole('alert').filter({hasText: '工作空间暂时无法打开'});
  await expect(failure).toBeVisible();
  expect(failures).toBeGreaterThan(0);
  await expect(failure.getByRole('button', {name: '重试加载', exact: true})).toBeVisible();
  await page.unroute(chunkUrl);
  const recovered = page.waitForResponse(response => response.url() === chunkUrl && response.status() === 200);
  await failure.getByRole('button', {name: '重新加载应用', exact: true}).click();
  await recovered;
  await expect(page.getByRole('cell', {name: '构建验收岗位', exact: true})).toBeVisible();
  await expect(page).toHaveURL(/\/post$/);
  expect(mock.loginRequests).toHaveLength(1);
  await expect(failure).toHaveCount(0);
});

test('all release HTML entries use fingerprinted assets and the showcase opens its built detail template', async ({page, request, mock}) => {
  for (const path of ['/', '/frontend-template.html', '/showcase.html', '/workflow/packages']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toMatch(/<script[^>]+src="\/assets\/[^"/]+-[^"/]+\.js"/);
    expect(html, path).not.toMatch(/\/@vite\/client|\/(app|templates)\/[^" ]+\.tsx/);
  }
  // A static preview must never expose workspace source through a dev endpoint
  // or encoded traversal; SPA fallback HTML is acceptable, source content is not.
  const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url)).replaceAll('\\', '/');
  for (const path of ['/app/main.tsx', `/@fs/${packagePath}`, '/%2e%2e%2fpackage.json']) {
    const response = await request.get(path);
    expect(await response.text(), path).not.toMatch(/createRoot\(|"eforge-enterprise-web"/);
  }
  await page.goto('/showcase.html#detail');
  await expect(page.locator('.showcase-heading h1')).toHaveText('详情模板');
  await page.getByRole('tab', {name: '业务与记录', exact: true}).click();
  await expect(page.getByRole('tab', {name: '业务与记录', exact: true})).toHaveAttribute('aria-selected', 'true');
  expect(mock.loginRequests).toEqual([]);
  expect(mock.bootstrapCalls).toBe(0);
  expect(mock.pageErrors).toEqual([]);
});
