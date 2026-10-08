import {test, expect} from './fixtures';
import type {Page} from '@playwright/test';

const role = {id: '2', name: '编辑角色', key: 'editor', sort: 1, status: '0', dataScope: '1', menuLinked: true, departmentLinked: true};
const department = {id: '103', parentId: '100', name: '研发', sort: 1, status: '0', leader: '', phone: '', email: ''};
const rootDepartment = {id: '100', parentId: '0', name: '总部', sort: 0, status: '0'};
const dictionary = {id: '2', name: '测试字典', code: 'test_dict', status: '0', remark: ''};
const post = {id: '2', name: '编辑岗位', code: 'editor', sort: 1, status: '0', remark: ''};
const user = {id: '8', username: 'member', displayName: '编辑用户', departmentId: '103', departmentName: '研发', sex: '2', status: '0'};

async function fixtures(page: Page) {
  await page.route('**/captchaImage', route => route.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/auth/login', route => route.fulfill({json: {accessToken: 'draft-fixture', tokenType: 'Bearer'}}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {
    user: {id: '7', username: 'editor', displayName: '编辑账号'}, roles: ['editor'], permissions: ['*:*:*'],
    navigation: [
      ['dashboard', '工作台'], ['system-users', '用户管理'], ['system-roles', '角色管理'], ['system-departments', '部门管理'],
      ['system-posts', '岗位管理'], ['system-configurations', '参数设置'], ['system-dictionaries', '字典管理']
    ].map(([routeId, label], order) => ({key: routeId, type: 'ROUTE', routeId, label, order, cached: true, children: []}))
  }}));
  await page.route('**/api/v1/system/users?*', route => route.fulfill({json: {items: [user], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/users/departments', route => route.fulfill({json: [rootDepartment, department]}));
  await page.route('**/api/v1/system/users/options', route => route.fulfill({json: {departments: [rootDepartment, department], roles: [], posts: [], initialPassword: 'Fixture123'}}));
  await page.route('**/api/v1/system/users/8', route => route.fulfill({json: {user, roleIds: [], postIds: []}}));
  await page.route('**/api/v1/system/roles?*', route => route.fulfill({json: {items: [role], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/roles/menus', route => route.fulfill({json: []}));
  await page.route('**/api/v1/system/roles/2', route => route.fulfill({json: {role, menuKeys: [], checkedMenuKeys: []}}));
  await page.route('**/api/v1/system/roles/2/data-scope', route => route.fulfill({json: {mode: '1', departmentLinked: true, departmentIds: [], checkedDepartmentIds: [], departments: [rootDepartment, department]}}));
  await page.route('**/api/v1/system/departments?*', route => route.fulfill({json: [rootDepartment, department]}));
  await page.route('**/api/v1/system/departments/103', route => route.fulfill({json: department}));
  await page.route('**/api/v1/system/posts?*', route => route.fulfill({json: {items: [post], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/posts/2', route => route.fulfill({json: post}));
  await page.route('**/api/v1/system/configurations?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/dictionaries?*', route => route.fulfill({json: {items: [dictionary], total: 1, page: 1, pageSize: 10}}));
  await page.route('**/api/v1/system/dictionaries/options', route => route.fulfill({json: [dictionary]}));
  await page.route('**/api/v1/system/dictionary-entries?*', route => route.fulfill({json: {items: [], total: 0, page: 1, pageSize: 10}}));
  await page.goto('/dashboard');
  await page.getByLabel('账号', {exact: true}).fill('editor');
  await page.getByLabel('密码', {exact: true}).fill('Fixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '你好，编辑账号'})).toBeVisible();
}
async function openPage(page: Page, label: string) {
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: label, exact: true}).click();
}
function tabs(page: Page) {return page.getByRole('navigation', {name: '页面标签'});}
async function unloadBlocked(page: Page) {
  return page.evaluate(() => {const event = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(event); return event.defaultPrevented;});
}

for (const scenario of [
  {page: '角色管理', open: '修改角色 编辑角色', title: '修改角色', field: '角色名称', initial: '编辑角色', changed: '角色草稿'},
  {page: '角色管理', open: '数据权限 编辑角色', title: '分配数据权限', field: '权限范围', initial: '1', changed: '3', select: true},
  {page: '部门管理', open: '修改部门 研发', title: '修改部门', field: '部门名称', initial: '研发', changed: '部门草稿'},
  {page: '岗位管理', open: '新增岗位', title: '新增岗位', field: '岗位名称', initial: '', changed: '岗位草稿'},
  {page: '参数设置', open: '新增参数', title: '新增参数', field: '参数名称', initial: '', changed: '参数草稿'},
  {page: '字典管理', open: '新增字典类型', title: '新增字典类型', field: '字典名称', initial: '', changed: '类型草稿'},
  {page: '字典管理', open: '新增字典数据', title: '新增字典数据', field: '数据标签', initial: '', changed: '条目草稿', entry: true}
]) {
  test(`${scenario.title}: clean cancel is immediate; Escape and cancel preserve the draft until explicit discard`, async ({page}) => {
    await fixtures(page); await openPage(page, scenario.page);
    if (scenario.entry) await page.getByRole('button', {name: '测试字典', exact: true}).click();
    const open = page.getByRole('button', {name: scenario.open, exact: true});
    const editor = page.getByRole('dialog', {name: scenario.title, exact: true});
    const field = editor.getByLabel(scenario.field, {exact: true});
    await open.click(); await expect(field).toHaveValue(scenario.initial);
    await editor.getByRole('button', {name: '取消', exact: true}).click();
    await expect(editor).toHaveCount(0); await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await open.click();
    if (scenario.select) await field.selectOption(scenario.changed); else await field.fill(scenario.changed);
    await page.keyboard.press('Escape');
    const warning = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
    await expect(warning).toBeVisible();
    await warning.getByRole('button', {name: '继续编辑', exact: true}).click();
    await expect(field).toHaveValue(scenario.changed);
    expect(await unloadBlocked(page)).toBe(true);
    await editor.getByRole('button', {name: '取消', exact: true}).click();
    await warning.getByRole('button', {name: '放弃修改', exact: true}).click();
    await expect(editor).toHaveCount(0); expect(await unloadBlocked(page)).toBe(false);
    await open.click();
    if (scenario.select) {await field.selectOption(scenario.changed); await field.selectOption(scenario.initial);}
    else {await field.fill(scenario.changed); await field.fill(scenario.initial);}
    await editor.getByRole('button', {name: '取消', exact: true}).click();
    await expect(editor).toHaveCount(0); await expect(warning).toHaveCount(0);
  });
}

test('role draft survives hidden Activity; a pending save blocks refresh, failure preserves it and success clears it', async ({page}) => {
  await fixtures(page); await openPage(page, '角色管理');
  let release!: () => void, writes = 0;
  await page.route('**/api/v1/system/roles/2', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json: {role, menuKeys: [], checkedMenuKeys: []}});
    writes++; const attempt = writes;
    await new Promise<void>(resolve => {release = resolve;});
    await route.fulfill(attempt === 1 ? {status: 503, json: {}} : {status: 204});
  });
  await page.getByRole('button', {name: '修改角色 编辑角色', exact: true}).click();
  const editor = page.getByRole('dialog', {name: '修改角色', exact: true});
  await editor.getByLabel('角色名称', {exact: true}).fill('隐藏角色草稿');
  await page.goBack(); await expect(editor).toBeHidden();
  await tabs(page).getByRole('button', {name: '关闭标签 角色管理', exact: true}).click();
  await page.getByRole('alertdialog').getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(editor.getByLabel('角色名称', {exact: true})).toHaveValue('隐藏角色草稿');
  await editor.getByRole('button', {name: '保存角色', exact: true}).click(); await expect.poll(() => writes).toBe(1);
  await page.keyboard.press('Escape'); await expect(editor).toBeVisible();
  await page.goBack();
  await tabs(page).getByRole('link', {name: '页面标签：角色管理', exact: true}).click({button: 'right'});
  await page.getByRole('menuitem', {name: '刷新页面', exact: true}).click();
  const waiting = page.getByRole('alertdialog', {name: '正在保存修改', exact: true});
  await expect(waiting).toBeVisible(); await expect(waiting.getByRole('button', {name: '放弃修改并刷新', exact: true})).toBeDisabled();
  expect(await unloadBlocked(page)).toBe(true);
  release();
  const dirty = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await expect(dirty).toBeVisible(); await dirty.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(editor.getByRole('alert')).toContainText('服务暂时不可用');
  await expect(editor.getByLabel('角色名称', {exact: true})).toHaveValue('隐藏角色草稿');
  await editor.getByRole('button', {name: '保存角色', exact: true}).click(); await expect.poll(() => writes).toBe(2);
  await page.goBack();
  await tabs(page).getByRole('button', {name: '关闭标签 角色管理', exact: true}).click();
  await expect(waiting).toBeVisible(); release();
  const saved = page.getByRole('alertdialog', {name: '修改已保存', exact: true});
  await expect(saved).toBeVisible(); expect(await unloadBlocked(page)).toBe(false);
  await saved.getByRole('button', {name: '继续关闭', exact: true}).click();
  await expect(tabs(page).getByRole('link', {name: '页面标签：角色管理', exact: true})).toHaveCount(0);
  expect(writes).toBe(2);
});

test('department sort draft survives tab switches and cancelled discard; save acknowledgement protects the whole close-all batch', async ({page}) => {
  await fixtures(page);
  let reads = 0, storedSort = 1, writes = 0, release!: () => void;
  await page.route('**/api/v1/system/departments?*', route => {reads++; return route.fulfill({json: [rootDepartment, {...department, sort: storedSort}]});});
  await page.route('**/api/v1/system/departments/sort', async route => {
    writes++; const attempt = writes; await new Promise<void>(resolve => {release = resolve;});
    if (attempt > 1) storedSort = 9;
    await route.fulfill(attempt === 1 ? {status: 503, json: {}} : {status: 204});
  });
  await openPage(page, '部门管理'); const sort = page.getByRole('spinbutton', {name: '排序 研发', exact: true});
  await sort.fill('8'); const initialReads = reads;
  await openPage(page, '岗位管理');
  await tabs(page).getByRole('link', {name: '页面标签：部门管理', exact: true}).click();
  await expect(sort).toHaveValue('8'); expect(reads).toBe(initialReads);
  await page.getByRole('button', {name: '刷新列表', exact: true}).click();
  const discard = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await discard.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(sort).toHaveValue('8'); expect(reads).toBe(initialReads);
  await page.getByRole('button', {name: '刷新列表', exact: true}).click();
  await discard.getByRole('button', {name: '放弃修改', exact: true}).click();
  await expect(sort).toHaveValue('1'); expect(await unloadBlocked(page)).toBe(false);
  await sort.fill('9'); await page.getByRole('button', {name: '保存部门排序', exact: true}).click(); await expect.poll(() => writes).toBe(1);
  await openPage(page, '岗位管理');
  await tabs(page).getByRole('button', {name: '关闭标签 部门管理', exact: true}).click();
  const waiting = page.getByRole('alertdialog', {name: '正在保存修改', exact: true});
  await expect(waiting.getByRole('button', {name: '放弃修改并关闭', exact: true})).toBeDisabled();
  release(); await expect(discard).toBeVisible();
  await discard.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(sort).toHaveValue('9'); await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  await page.getByRole('button', {name: '保存部门排序', exact: true}).click(); await expect.poll(() => writes).toBe(2);
  await openPage(page, '岗位管理');
  await tabs(page).getByRole('button', {name: '标签操作', exact: true}).click();
  await page.getByRole('menuitem', {name: '全部关闭', exact: true}).click();
  await expect(waiting).toBeVisible();
  await expect(tabs(page).getByRole('link', {name: '页面标签：岗位管理', exact: true})).toHaveCount(1);
  await expect(tabs(page).getByRole('link', {name: '页面标签：部门管理', exact: true})).toHaveCount(1);
  await expect(waiting.getByRole('button', {name: '放弃修改并关闭', exact: true})).toBeDisabled();
  release(); const saved = page.getByRole('alertdialog', {name: '修改已保存', exact: true});
  await expect(saved).toBeVisible(); expect(await unloadBlocked(page)).toBe(false);
  await saved.getByRole('button', {name: '继续关闭', exact: true}).click();
  await expect(page).toHaveURL(/\/dashboard$/); await expect(tabs(page).getByRole('link')).toHaveCount(1);
  expect(writes).toBe(2);
});

test('a department detail read cancelled while hidden cannot reopen a stale editor or keep editing locked', async ({page}) => {
  await fixtures(page); await openPage(page, '部门管理');
  let release!: () => void; const gate = new Promise<void>(resolve => {release = resolve;});
  let first = true;
  await page.route('**/api/v1/system/departments/103', async route => {
    if (first) {first = false; await gate;}
    await route.fulfill({json: department}).catch(() => {});
  });
  const requested = page.waitForRequest(request => new URL(request.url()).pathname === '/api/v1/system/departments/103');
  await page.getByRole('button', {name: '修改部门 研发', exact: true}).click(); const request = await requested;
  const aborted = page.waitForEvent('requestfailed', candidate => candidate === request);
  await openPage(page, '岗位管理');
  expect((await aborted).failure()?.errorText).toMatch(/abort|cancel/i); release();
  await tabs(page).getByRole('link', {name: '页面标签：部门管理', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const modify = page.getByRole('button', {name: '修改部门 研发', exact: true}); await expect(modify).toBeEnabled();
  await modify.click(); await expect(page.getByRole('dialog').getByLabel('部门名称', {exact: true})).toHaveValue('研发');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('user pending save prevents tag close; failure retains the editor and success clears its guard while hidden', async ({page}) => {
  await fixtures(page); await openPage(page, '用户管理');
  let release!: () => void, writes = 0;
  await page.route('**/api/v1/system/users/8', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json: {user, roleIds: [], postIds: []}});
    writes++; const attempt = writes;
    await new Promise<void>(resolve => {release = resolve;});
    await route.fulfill(attempt === 1 ? {status: 503, json: {}} : {status: 204});
  });
  await page.getByRole('button', {name: '修改用户 member', exact: true}).click();
  const editor = page.getByRole('dialog', {name: '修改用户', exact: true});
  await editor.getByLabel('用户昵称', {exact: true}).fill('等待保存的用户');
  await editor.getByRole('button', {name: '保存用户', exact: true}).click(); await expect.poll(() => writes).toBe(1);
  await page.keyboard.press('Escape'); await expect(editor).toBeVisible();
  await page.goBack(); await tabs(page).getByRole('button', {name: '关闭标签 用户管理', exact: true}).click();
  const waiting = page.getByRole('alertdialog', {name: '正在保存修改', exact: true});
  await expect(waiting).toBeVisible(); await expect(waiting.getByRole('button', {name: '放弃修改并关闭', exact: true})).toBeDisabled();
  expect(await unloadBlocked(page)).toBe(true); release();
  const dirty = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await expect(dirty).toBeVisible(); await dirty.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(editor.getByLabel('用户昵称', {exact: true})).toHaveValue('等待保存的用户');
  await expect(editor.getByRole('alert')).toContainText('服务暂时不可用');
  await editor.getByRole('button', {name: '保存用户', exact: true}).click(); await expect.poll(() => writes).toBe(2);
  await page.goBack(); await tabs(page).getByRole('button', {name: '关闭标签 用户管理', exact: true}).click();
  await expect(waiting).toBeVisible(); release();
  const saved = page.getByRole('alertdialog', {name: '修改已保存', exact: true});
  await expect(saved).toBeVisible(); expect(await unloadBlocked(page)).toBe(false);
  await saved.getByRole('button', {name: '继续关闭', exact: true}).click();
  await expect(tabs(page).getByRole('link', {name: '页面标签：用户管理', exact: true})).toHaveCount(0);
  expect(writes).toBe(2);
});

test('screen lock preserves native unload protection for dirty drafts and pending writes through failure, unlock and acknowledgement', async ({page}) => {
  await fixtures(page); await openPage(page, '部门管理');
  await page.route('**/api/v1/auth/unlock-screen', route => route.fulfill({status: 204}));
  let release!: () => void, writes = 0;
  await page.route('**/api/v1/system/departments/sort', async route => {
    writes++; const attempt = writes;
    await new Promise<void>(resolve => {release = resolve;});
    await route.fulfill(attempt === 1 ? {status: 503, json: {}} : {status: 204});
  });
  async function lock() {
    await page.getByRole('button', {name: '锁定屏幕', exact: true}).click();
    await expect(page.getByLabel('解锁密码')).toBeVisible();
  }
  async function unlock() {
    await page.getByLabel('解锁密码').fill('Fixture123');
    await page.getByRole('button', {name: '解锁', exact: true}).click();
    await expect(page.getByLabel('解锁密码')).toHaveCount(0);
  }
  const sort = page.getByRole('spinbutton', {name: '排序 研发', exact: true});
  await sort.fill('9'); await lock(); expect(await unloadBlocked(page)).toBe(true);
  await unlock(); await expect(sort).toHaveValue('9'); expect(await unloadBlocked(page)).toBe(true);
  await page.getByRole('button', {name: '保存部门排序', exact: true}).click(); await expect.poll(() => writes).toBe(1);
  await lock(); expect(await unloadBlocked(page)).toBe(true);
  const failed = page.waitForResponse(response => response.url().endsWith('/departments/sort') && response.status() === 503);
  release(); await failed; expect(await unloadBlocked(page)).toBe(true);
  await unlock(); await expect(sort).toHaveValue('9'); await expect(page.getByRole('alert')).toContainText('服务暂时不可用');
  await page.getByRole('button', {name: '保存部门排序', exact: true}).click(); await expect.poll(() => writes).toBe(2);
  await lock(); expect(await unloadBlocked(page)).toBe(true); release();
  await expect.poll(() => unloadBlocked(page)).toBe(false);
  await unlock(); expect(await unloadBlocked(page)).toBe(false); expect(writes).toBe(2);
});

test('a replacement owner does not inherit the locked workspace guard or a late pending-write failure', async ({page}) => {
  await fixtures(page); await openPage(page, '部门管理');
  let release!: () => void, requested = false;
  await page.route('**/api/v1/system/departments/sort', async route => {
    requested = true; await new Promise<void>(resolve => {release = resolve;});
    await route.fulfill({status: 503, json: {}});
  });
  await page.getByRole('spinbutton', {name: '排序 研发', exact: true}).fill('9');
  await page.getByRole('button', {name: '保存部门排序', exact: true}).click(); await expect.poll(() => requested).toBe(true);
  await page.getByRole('button', {name: '锁定屏幕', exact: true}).click(); await expect(page.getByLabel('解锁密码')).toBeVisible();
  expect(await unloadBlocked(page)).toBe(true);
  await page.route('**/api/v1/auth/unlock-screen', route => route.fulfill({status: 204}));
  await page.route('**/api/v1/app/bootstrap', route => route.fulfill({json: {user: {id: '9', username: 'replacement', displayName: '替换账号'}, roles: [], permissions: [], navigation: []}}));
  await page.getByLabel('解锁密码').fill('Fixture123'); await page.getByRole('button', {name: '解锁', exact: true}).click();
  await expect(page.getByRole('heading', {name: '替换账号', exact: true})).toBeVisible();
  expect(await unloadBlocked(page)).toBe(false);
  const failed = page.waitForResponse(response => response.url().endsWith('/departments/sort') && response.status() === 503);
  release(); await failed;
  await expect(page.getByLabel('解锁密码')).toBeVisible(); expect(await unloadBlocked(page)).toBe(false);
  await expect(page.locator('[data-page-path="/dept"]')).toHaveCount(0);
});
