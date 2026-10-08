import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';

async function setup(page: Page, path = '/dashboard') {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture-token', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '2', username: 'editor', displayName: '编辑人员'}, roles: ['editor'],
    permissions: ['app:dashboard:view', 'system:user:list', 'system:user:add'],
    navigation: [{key: 'group', type: 'GROUP', label: '应用', order: 0, children: [
      {key: 'home', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []},
      {key: 'users', type: 'ROUTE', routeId: 'system-users', label: '用户管理', order: 1, children: []},
      {key: 'docs', type: 'EXTERNAL', externalUrl: 'https://example.com/', label: '帮助', order: 2, children: []}
    ]}]
  }}));
  await page.route('**/api/v1/system/users/departments', route => route.fulfill({json: []}));
  await page.route('**/api/v1/system/users/options', route => route.fulfill({json: {departments: [], roles: [], posts: [], initialPassword: 'Valid12345'}}));
  await page.route('**/api/v1/system/users?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
  await page.goto(path);
  await page.getByLabel('账号', {exact: true}).fill('editor');
  await page.getByLabel('密码', {exact: true}).fill('password');
  await page.getByRole('button', {name: '登录', exact: true}).click();
}

test('workbench counts actual nested links rather than one top-level group', async ({page}) => {
  await setup(page);
  await expect(page.locator('.summary-card').filter({has: page.getByText('工作入口', {exact: true})}).locator('strong')).toHaveText('3');
});

test('user editor identifies fields, focuses the first error, preserves failed drafts and asks before discarding', async ({page}) => {
  let saves = 0;
  await page.route('**/api/v1/system/users', route => { saves++; return route.fulfill({status: 503, json: {}}); });
  await setup(page, '/user');
  await page.getByRole('button', {name: '新增用户', exact: true}).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', {name: '保存用户', exact: true}).click();
  await expect(form.getByLabel('登录账号', {exact: true})).toBeFocused();
  await expect(form.getByLabel('登录账号', {exact: true})).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByLabel('登录账号', {exact: true})).toHaveAccessibleDescription('账号须为 2–20 个字符。');
  await expect(form.getByText('账号须为 2–20 个字符。', {exact: true})).toBeVisible();
  await expect(form.getByLabel('登录账号', {exact: true})).toHaveAttribute('aria-required', 'true');
  await form.getByLabel('登录账号', {exact: true}).fill('new-editor');
  await form.getByLabel('用户昵称', {exact: true}).fill('保留的草稿');
  await expect(form.getByLabel('登录账号', {exact: true})).not.toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('手机号码', {exact: true}).fill('bad');
  await form.getByRole('button', {name: '保存用户', exact: true}).click();
  await expect(form.getByLabel('手机号码', {exact: true})).toBeFocused();
  await expect(form.getByLabel('手机号码', {exact: true})).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByLabel('手机号码', {exact: true})).toHaveAccessibleDescription('请填写有效的 11 位手机号码。');
  expect(saves).toBe(0);
  await page.screenshot({path: 'test-results/ui-hardening-desktop.png', fullPage: true});
  await form.getByLabel('手机号码', {exact: true}).fill('');
  await form.getByRole('button', {name: '保存用户', exact: true}).click();
  await expect(form.getByRole('alert')).toContainText('服务暂时不可用');
  expect(saves).toBe(1);
  page.once('dialog', async dialog => { expect(dialog.type()).toBe('confirm'); await dialog.dismiss(); });
  await form.getByRole('button', {name: '取消', exact: true}).click();
  await expect(form.getByLabel('用户昵称', {exact: true})).toHaveValue('保留的草稿');
  await page.setViewportSize({width: 390, height: 844});
  await expect(form.getByRole('button', {name: '取消', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: 'test-results/ui-hardening-mobile.png', fullPage: true});
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('未保存'); await dialog.accept(); });
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  expect(saves).toBe(1);
});

test('a failed lazy route leaves navigation and the workbench usable', async ({page}) => {
  await setup(page);
  await expect(page.getByRole('heading', {name: '你好，编辑人员'})).toBeVisible();
  await page.route('**/features/users/UsersPage.tsx*', route => route.abort());
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '用户管理', exact: true}).click();
  await expect(page.getByRole('heading', {name: '用户管理暂时无法显示'})).toBeVisible();
  await expect(page.getByRole('button', {name: '重试当前页', exact: true})).toBeVisible();
  await page.getByRole('link', {name: '页面标签：工作台', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，编辑人员'})).toBeVisible();
});

test('login help text meets the normal-text contrast target', async ({page}) => {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.goto('/login');
  const ratio = await page.locator('.login-help').evaluate(element => {
    const luminance = (color: string) => {
      const channels = (color.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(value => {
        const channel = Number(value) / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      return .2126 * channels[0]! + .7152 * channels[1]! + .0722 * channels[2]!;
    };
    const text = luminance(window.getComputedStyle(element).color);
    const background = luminance(window.getComputedStyle(element.closest('.login-panel')!).backgroundColor);
    return (Math.max(text, background) + .05) / (Math.min(text, background) + .05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
