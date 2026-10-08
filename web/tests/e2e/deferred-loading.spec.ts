import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';

async function fixtures(page: Page) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'deferred-fixture', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '2', username: 'reader', displayName: '加载测试'}, roles: [],
    permissions: ['app:dashboard:view', 'system:post:list'], navigation: [
      {key: 'home', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []},
      {key: 'posts', type: 'ROUTE', routeId: 'system-posts', label: '岗位管理', order: 1, children: []}
    ]
  }}));
  await page.route('**/api/v1/system/posts?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
}
async function login(page: Page) {
  await page.goto('/dashboard');
  await page.getByLabel('账号', {exact: true}).fill('reader');
  await page.getByLabel('密码', {exact: true}).fill('Fixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('login defers the workspace and dashboard defers search and sanitized notice content until requested', async ({page}) => {
  await fixtures(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
  expect(requests.some(path => path.endsWith('/AuthenticatedApplication.tsx'))).toBe(false);
  await page.getByLabel('账号', {exact: true}).fill('reader');
  await page.getByLabel('密码', {exact: true}).fill('Fixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，加载测试'})).toBeVisible();
  await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible();
  expect(requests.some(path => path.endsWith('/NavigationSearchContent.tsx'))).toBe(false);
  expect(requests.some(path => path.endsWith('/NoticeRichContent.tsx'))).toBe(false);
  expect(requests.some(path => path.endsWith('/NoticeDialogs.tsx'))).toBe(false);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/app/components/NavigationSearchContent.tsx*', async route => {await gate; await route.continue();});
  try {
    await page.getByRole('button', {name: '导航搜索', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: '导航搜索'});
    await expect(dialog.getByRole('status').filter({hasText: '正在加载搜索…'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', {name: '导航搜索', exact: true})).toBeFocused();
  } finally {release();}
  await page.getByRole('button', {name: '导航搜索', exact: true}).click();
  await page.getByRole('combobox', {name: '菜单搜索'}).fill('岗位');
  await page.getByRole('combobox', {name: '菜单搜索'}).press('ArrowDown');
  await page.getByRole('combobox', {name: '菜单搜索'}).press('Enter');
  await expect(page.getByRole('heading', {name: '岗位管理', exact: true})).toBeVisible();
});

test('a failed authenticated chunk exposes manual recovery without a reload loop', async ({page}) => {
  await fixtures(page);
  const url = '**/app/AuthenticatedApplication.tsx*';
  let attempts = 0, documents = 0;
  page.on('request', request => {if (request.isNavigationRequest()) documents++;});
  await page.route(url, route => {attempts++; return route.abort();});
  await login(page);
  const failure = page.getByRole('alert').filter({hasText: '工作空间暂时无法打开'});
  await expect(failure).toBeVisible();
  expect(attempts).toBe(1);
  expect(documents).toBe(1);
  await page.getByRole('button', {name: '重试加载', exact: true}).click();
  await expect(failure).toBeVisible();
  expect(documents).toBe(1);
  await page.unroute(url);
  // Browsers may retain an ESM fetch failure. Reload is an explicit final recovery path.
  await page.getByRole('button', {name: '重新加载应用', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，加载测试'})).toBeVisible();
  expect(documents).toBe(2);
});

test('an unavailable header feature preserves workspace navigation', async ({page}) => {
  await fixtures(page);
  await page.route('**/features/notices/HeaderNotices.tsx*', route => route.abort());
  await login(page);
  await expect(page.getByRole('heading', {name: '你好，加载测试'})).toBeVisible();
  await expect(page.getByRole('button', {name: '重试通知公告'})).toBeVisible();
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '岗位管理', exact: true}).click();
  await expect(page.getByRole('heading', {name: '岗位管理', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '重试通知公告'})).toBeVisible();
});

test('closing a notice while its body module is pending does not mark unseen content as read', async ({page}) => {
  await fixtures(page);
  let read = false, marks = 0;
  const row = {id: '15', title: '延迟正文', type: '2', content: '<p>正文已安全显示</p>', status: '0'};
  await page.route('**/api/v1/system/notices/feed', route => route.fulfill({json: {
    items: [{id: row.id, title: row.title, type: row.type, read}], unreadCount: read ? 0 : 1
  }}));
  await page.route('**/api/v1/system/notices/15', route => route.fulfill({json: row}));
  await page.route('**/api/v1/system/notices/read', route => {
    expect(route.request().postDataJSON()).toEqual({ids: [row.id]});
    marks++; read = true;
    return route.fulfill({status: 204});
  });
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/features/notices/NoticeRichContent.tsx*', async route => {await gate; await route.continue();});
  await login(page);
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/NoticeRichContent.tsx'));
  try {
    await page.getByRole('button', {name: '通知公告（1 条未读）'}).click();
    await page.getByRole('button', {name: '阅读 延迟正文（未读）'}).click();
    const dialog = page.getByRole('dialog', {name: row.title, exact: true});
    await expect(dialog.getByText('正在加载公告正文…', {exact: true})).toBeVisible();
    expect(marks).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } finally {release();}
  await loaded;
  expect(marks).toBe(0);
  await page.getByRole('button', {name: '通知公告（1 条未读）'}).click();
  await page.getByRole('button', {name: '阅读 延迟正文（未读）'}).click();
  await expect(page.getByRole('dialog').getByText('正文已安全显示', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '通知公告（0 条未读）'})).toBeVisible();
  expect(marks).toBe(1);
});
