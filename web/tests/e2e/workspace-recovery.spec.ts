import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';

async function fixtures(page: Page, nested = false) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'workspace-fixture', tokenType: 'Bearer'}}));
  const users = {key: 'users', type: 'ROUTE', routeId: 'system-users', label: '用户管理', order: 1, children: nested ? [
    {key: 'help', type: 'EXTERNAL', externalUrl: 'https://example.com/help', label: '帮助', order: 0, children: []}
  ] : []};
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '7', username: 'editor', displayName: '编辑账号'}, roles: ['editor'],
    permissions: ['app:dashboard:view', 'system:user:list', 'system:user:add'],
    navigation: [
      {key: 'home', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []},
      ...(nested ? [{key: 'group', type: 'GROUP', label: '系统管理', order: 1, children: [users,
        {key: 'roles', type: 'ROUTE', routeId: 'system-roles', label: '不可访问角色', order: 2, children: []},
        {key: 'unknown', type: 'ROUTE', routeId: 'unknown', label: '未注册页面', order: 3, children: []}]}] : [users])
    ]
  }}));
  await page.route('**/api/v1/system/users/departments', route => route.fulfill({json: []}));
  await page.route('**/api/v1/system/users/options', route => route.fulfill({json: {departments: [], roles: [], posts: [], initialPassword: 'Fixture123'}}));
  await page.route('**/api/v1/system/users?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
}
async function login(page: Page) {
  await page.goto('/dashboard');
  await page.getByLabel('账号', {exact: true}).fill('editor');
  await page.getByLabel('密码', {exact: true}).fill('Fixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，编辑账号'})).toBeVisible();
}
async function openUsers(page: Page) {
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '用户管理', exact: true}).click();
  await expect(page.getByRole('heading', {name: '用户管理', exact: true})).toBeVisible();
}

test('work entry count includes nested actionable entries after permission and route projection', async ({page}) => {
  await fixtures(page, true);
  await login(page);
  await expect(page.locator('.summary-card').filter({has: page.getByText('工作入口', {exact: true})}).locator('strong')).toHaveText('3');
});

test('a failed lazy page keeps shell navigation usable and a manual application reload recovers', async ({page},info) => {
  await fixtures(page);
  let failedLoads = 0;
  const moduleUrl = '**/features/users/UsersPage.tsx*';
  await page.route(moduleUrl, route => {failedLoads++; return route.abort();});
  await login(page);
  await openUsersPageExpectingFailure();
  const failed = page.getByRole('alert').filter({hasText: '用户管理暂时无法打开'});
  await expect(failed).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:info.outputPath('failure-desktop.png')});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('failure-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '工作台', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，编辑账号'})).toBeVisible();
  await page.getByRole('link', {name: '页面标签：用户管理', exact: true}).click();
  await expect(failed).toBeVisible();
  await page.unroute(moduleUrl);
  const attempted = failedLoads;
  await page.getByRole('button', {name: '重试此页面', exact: true}).click();
  await expect(failed).toBeVisible();
  expect(failedLoads).toBe(attempted);
  await page.getByRole('button', {name: '重新加载应用', exact: true}).click();
  await expect(page.getByRole('heading', {name: '用户管理', exact: true})).toBeVisible();
  await expect(failed).toHaveCount(0);
  async function openUsersPageExpectingFailure() {
    await page.locator('.ef-app-shell__nav').getByRole('link', {name: '用户管理', exact: true}).click();
  }
});

test('user editor escape and cancel preserve changes until explicit discard; clean cancellation stays immediate', async ({page}) => {
  await fixtures(page);
  await login(page);
  await openUsers(page);
  await page.getByRole('button', {name: '新增用户', exact: true}).click();
  const editor = page.getByRole('dialog', {name: '新增用户', exact: true});
  await editor.getByLabel('用户昵称', {exact: true}).fill('未保存用户');
  await page.keyboard.press('Escape');
  await expect(editor.getByText('有未保存的修改，是否放弃？')).toBeVisible();
  await editor.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(editor.getByLabel('用户昵称', {exact: true})).toHaveValue('未保存用户');
  await editor.getByRole('button', {name: '取消', exact: true}).click();
  await editor.getByRole('button', {name: '放弃修改', exact: true}).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', {name: '新增用户', exact: true}).click();
  await editor.getByLabel('用户昵称', {exact: true}).fill('又一次修改');
  await editor.getByLabel('用户昵称', {exact: true}).fill('');
  await editor.getByRole('button', {name: '取消', exact: true}).click();
  await expect(editor).toHaveCount(0);
});

test('a hidden user editor remains protected from tag close and refresh, then saved changes clear the guard', async ({page}) => {
  await fixtures(page);
  let writes = 0;
  await page.route('**/api/v1/system/users', route => {writes++; return route.fulfill({status: 201, json: {id: '8', username: 'newuser', displayName: '保存用户', status: '0'}});});
  await login(page);
  await openUsers(page);
  await page.getByRole('button', {name: '新增用户', exact: true}).click();
  const editor = page.getByRole('dialog', {name: '新增用户', exact: true});
  await editor.getByLabel('登录账号', {exact: true}).fill('newuser');
  await editor.getByLabel('用户昵称', {exact: true}).fill('保存用户');
  await page.goBack();
  await expect(editor).toBeHidden();
  const tabs = page.getByRole('navigation', {name: '页面标签'});
  await tabs.getByRole('button', {name: '关闭标签 用户管理', exact: true}).click();
  const warning = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await expect(warning).toBeVisible();
  await warning.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(editor.getByLabel('用户昵称', {exact: true})).toHaveValue('保存用户');
  await page.goBack();
  await tabs.getByRole('link', {name: '页面标签：用户管理', exact: true}).click({button: 'right'});
  await page.getByRole('menuitem', {name: '刷新页面', exact: true}).click();
  await expect(warning).toBeVisible();
  await warning.getByRole('button', {name: '继续编辑', exact: true}).click();
  await editor.getByRole('button', {name: '保存用户', exact: true}).click();
  await expect(editor).toHaveCount(0);
  expect(writes).toBe(1);
  await tabs.getByRole('button', {name: '关闭标签 用户管理', exact: true}).click();
  await expect(warning).toHaveCount(0);
  await expect(tabs.getByRole('link', {name: '页面标签：用户管理', exact: true})).toHaveCount(0);
});

test('login help text meets normal text contrast against the rendered panel background', async ({page}) => {
  await fixtures(page);
  await page.goto('/login');
  const colors = await page.locator('.login-help').evaluate(element => ({
    text: getComputedStyle(element).color,
    background: getComputedStyle(element.closest('.login-panel')!).backgroundColor
  }));
  function luminance(color: string) {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(value => {
      const normalized = Number(value) / 255;
      return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
  }
  const values = [luminance(colors.text), luminance(colors.background)].sort((a, b) => a - b);
  expect((values[1]! + .05) / (values[0]! + .05)).toBeGreaterThanOrEqual(4.5);
});

test('confirming application reload covers hidden user drafts without a second browser confirmation', async ({page}) => {
  await fixtures(page);
  await page.route('**/features/dashboard/DemoDashboard.tsx*', route => route.abort());
  await login(page);
  await openUsers(page);
  await page.getByRole('button', {name: '新增用户', exact: true}).click();
  await page.getByRole('dialog', {name: '新增用户', exact: true}).getByLabel('用户昵称', {exact: true}).fill('重载前草稿');
  await page.goBack();
  await page.getByRole('button', {name: '图表演示', exact: true}).click();
  await expect(page.getByRole('heading', {name: '工作台暂时无法打开'})).toBeVisible();
  await page.getByRole('button', {name: '重新加载应用', exact: true}).click();
  const warning = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await expect(warning).toBeVisible();
  let browserConfirmations = 0;
  page.on('dialog', async dialog => {if (dialog.type() === 'beforeunload') browserConfirmations++; await dialog.accept();});
  await warning.getByRole('button', {name: '放弃修改并重新加载应用', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，编辑账号'})).toBeVisible();
  expect(browserConfirmations).toBe(0);
  await expect(page.getByRole('link', {name: '页面标签：用户管理', exact: true})).toHaveCount(0);
});
