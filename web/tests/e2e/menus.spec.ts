import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../../features/menus/icons.json', import.meta.url), 'utf8')) as {icons: {name: string}[]};
const id = '9007199254740993';
const menu = {id, parentId: '999', key: 'scoped-menu', name: '范围内菜单', sort: 1, type: 'GROUP', status: '0', visible: true, cached: true, groupPath: 'scoped-menu', icon: 'unknown-icon', remark: 'old'};
const owner = {id: '1', parentId: '0', key: 'owner', name: '可用目录', sort: 1, type: 'GROUP', status: '0', visible: true, cached: true, groupPath: 'owner'};
async function session(page: Page, permissions: string[]) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'fixture', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '7', username: 'reader', displayName: '验证账号'}, roles: ['reader'], permissions, navigation: [{key: 'system-menus', type: 'ROUTE', routeId: 'system-menus', label: '菜单管理', order: 0, children: []}]}}));
  await page.goto('/menu'); await page.getByLabel('账号', {exact: true}).fill('reader'); await page.getByLabel('密码', {exact: true}).fill('password'); await page.getByRole('button', {name: '登录', exact: true}).click();
}
async function options(page: Page) {
  await page.route('**/api/v1/system/menus/options*', route => route.fulfill({json: [owner, menu, {...owner, id: '3', parentId: id, name: '当前下级'}]}));
  await page.route('**/api/v1/system/menus/routes', route => route.fulfill({json: [{id: 'system-menus', path: '/menu', permission: 'system:menu:list'}]}));
}
test('read-only scoped menu tree preserves exact IDs, retry, filtered roots and mobile bounds', async ({page}) => {
  let fail = true; await page.route('**/api/v1/system/menus?*', route => route.fulfill(fail ? {status: 503, json: {}} : {json: [menu]}));
  await session(page, ['system:menu:list']); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); fail = false;
  await page.getByRole('button', {name: '重试列表', exact: true}).click(); await expect(page.getByRole('cell', {name: '范围内菜单', exact: true})).toBeVisible();
  for (const name of ['新增菜单', '保存菜单排序', '修改菜单 范围内菜单', '新增子菜单 范围内菜单', '删除菜单 范围内菜单']) await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
  await expect(page.getByLabel('排序菜单 范围内菜单', {exact: true})).toHaveCount(0); await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(page.getByRole('heading', {name: '菜单管理', exact: true})).toBeVisible();
});
test('menu editor retains scoped parent and unknown icon, excludes subtree, supports complete icon decoding and keyboard/mobile recovery', async ({page}) => {
  const writes: Record<string, unknown>[] = []; let fail = true;
  await page.route('**/api/v1/system/menus?*', route => route.fulfill({json: [menu]})); await options(page);
  await page.route(`**/api/v1/system/menus/${id}`, async route => {
    if (route.request().method() === 'GET') return route.fulfill({json: menu});
    writes.push(route.request().postDataJSON()); await route.fulfill(fail ? {status: 503, json: {}} : {status: 204});
  });
  await session(page, ['system:menu:list', 'system:menu:query', 'system:menu:edit']); await page.getByRole('button', {name: '修改菜单 范围内菜单', exact: true}).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('稳定标识', {exact: true})).toBeDisabled(); await expect(dialog.getByLabel('上级菜单', {exact: true})).toHaveValue('999');
  await expect(dialog.getByRole('option', {name: '当前上级菜单', exact: true})).toBeAttached(); await expect(dialog.getByRole('option', {name: '当前下级', exact: true})).toHaveCount(0); await expect(dialog.getByRole('option', {name: '范围内菜单', exact: true})).toHaveCount(0);
  await expect(dialog.getByLabel('图标名称', {exact: true})).toHaveValue('unknown-icon');
  const decoded = await page.evaluate(async icons => Promise.all(icons.map(async name => {
    const image = new Image(); image.src = `/ruoyi-icons/v3.9.2/${name}.svg`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 32, 32);
    return {name, painted: context.getImageData(0, 0, 32, 32).data.some((value, index) => index % 4 === 3 && value > 0)};
  })), manifest.icons.map(icon => icon.name)); expect(decoded.filter(icon => !icon.painted)).toEqual([]);
  await dialog.locator('summary').click(); await expect(dialog.getByText('共 88 个图标', {exact: true})).toBeVisible();
  await dialog.getByLabel('搜索图标', {exact: true}).fill('tree'); const choices = dialog.locator('[data-icon-choice]'); await choices.first().focus(); await page.keyboard.press('End'); await expect(choices.last()).toBeFocused(); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible(); await expect(dialog.locator('summary')).toBeFocused();
  await dialog.locator('summary').click(); await dialog.getByRole('button', {name: '选择图标 tree-table', exact: true}).click(); await expect(dialog.getByLabel('图标名称', {exact: true})).toHaveValue('tree-table');
  await dialog.getByLabel('备注', {exact: true}).fill(''); await page.setViewportSize({width: 390, height: 844}); const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('服务暂时不可用'); fail = false;
  await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog).toHaveCount(0); expect(writes[1]).toMatchObject({key: 'scoped-menu', parentId: '999', icon: 'tree-table', remark: ''});
});
test('create validation and committed refresh-only retry never repeat mutations; sorting preserves failed drafts', async ({page}) => {
  let mutations = 0, refreshFails = true, sortFails = true; const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/v1/system/menus?*', route => route.fulfill({json: [owner]})); await options(page);
  await page.route('**/api/v1/system/menus', async route => { mutations++; bodies.push(route.request().postDataJSON()); await route.fulfill({status: 201, json: {...owner, id: '9'}}); });
  await page.route('**/api/v1/system/menus/sort', route => route.fulfill(sortFails ? {status: 503, json: {}} : {status: 204}));
  await session(page, ['system:menu:list', 'system:menu:add', 'system:menu:edit']);
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill(mutations && refreshFails ? {status: 503, json: {}} : {json: {user: {id: '7', username: 'reader', displayName: '验证账号'}, roles: ['reader'], permissions: ['system:menu:list', 'system:menu:add', 'system:menu:edit'], navigation: [{key: 'system-menus', type: 'ROUTE', routeId: 'system-menus', label: '菜单管理', order: 0, children: []}]}}));
  await page.getByRole('button', {name: '新增菜单', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('菜单名称', {exact: true}).fill('外链'); await dialog.getByLabel('稳定标识', {exact: true}).fill('new-external'); await dialog.getByLabel('菜单类型', {exact: true}).selectOption('EXTERNAL'); await dialog.getByLabel('外链地址', {exact: true}).fill('javascript:alert(1)');
  await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('请检查'); expect(mutations).toBe(0);
  await dialog.getByLabel('外链地址', {exact: true}).fill('https://example.com'); await dialog.getByRole('button', {name: '保存菜单', exact: true}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('alert')).toContainText('已保存，权限信息刷新失败'); expect(bodies[0]).toMatchObject({type: 'EXTERNAL', externalUrl: 'https://example.com'}); expect(bodies[0]?.groupPath).toBeUndefined();
  refreshFails = false; await page.getByRole('button', {name: '重试权限刷新', exact: true}).click(); await expect(page.getByRole('alert')).toHaveCount(0); expect(mutations).toBe(1);
  const sort = page.getByLabel('排序菜单 可用目录', {exact: true}); await sort.fill('-1'); await page.getByRole('button', {name: '保存菜单排序', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('显示顺序');
  await sort.fill('7'); await page.getByRole('button', {name: '保存菜单排序', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('服务暂时不可用'); await expect(sort).toHaveValue('7'); sortFails = false;
  await page.getByRole('button', {name: '保存菜单排序', exact: true}).click(); await expect(page.getByText('菜单排序已保存。', {exact: true})).toBeVisible();
});

test('menu folding waits for loaded rows and restores children after expansion', async ({page}) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/system/menus?*', async route => {
    await ready;
    await route.fulfill({json: [owner, {...menu, parentId: owner.id}]});
  });
  await session(page, ['system:menu:list']);
  const fold = page.getByRole('button', {name: '折叠全部菜单', exact: true});
  await expect(fold).toBeDisabled();
  release();
  await expect(page.getByRole('cell', {name: '范围内菜单', exact: true})).toBeVisible();
  await fold.click();
  await expect(page.getByRole('cell', {name: '范围内菜单', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: '展开全部菜单', exact: true}).click();
  await expect(page.getByRole('cell', {name: '范围内菜单', exact: true})).toBeVisible();
});