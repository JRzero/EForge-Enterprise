import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {userWorkbook, workbookXml} from '../helpers/user-workbook';
import type {PageResponseUserResponse} from '../../generated/api';

async function login(page: Page) {
  await page.goto('/user'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click(); await expect(page.getByRole('heading', {name: '用户管理', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: 'admin', exact: true})).toBeVisible();
}
async function query(page: Page, username: string) {
  await page.getByLabel('登录账号筛选', {exact: true}).fill(username); await page.getByRole('button', {name: '查询', exact: true}).click();
}
async function create(page: Page, username: string) {
  await page.getByRole('button', {name: '新增用户', exact: true}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('登录账号', {exact: true}).fill(username); await dialog.getByLabel('用户昵称', {exact: true}).fill('浏览器用户');
  await dialog.getByLabel('用户密码', {exact: true}).fill('Browser123');
  await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','password');
  await dialog.getByRole('button',{name:'显示用户密码',exact:true}).click();await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','text');await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveValue('Browser123');await expect(dialog.getByLabel('用户密码',{exact:true})).toBeFocused();
  await dialog.getByRole('button',{name:'隐藏用户密码',exact:true}).focus();await page.keyboard.press('Space');await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','password');await expect(dialog.getByRole('button',{name:'显示用户密码',exact:true})).toBeFocused(); await dialog.getByLabel('归属部门', {exact: true}).selectOption('103');
  await dialog.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(dialog).toHaveCount(0);
}
async function authenticate(page: Page, username: string, password: string) {
  return page.evaluate(async ({username, password}) => (await fetch('/api/v1/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password})})).status, {username, password});
}

test('real user CRUD, uniqueness, departments, contact clearing, role allocation, password and status, columns and export', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', cause => errors.push(cause.message)); await login(page);
  await page.getByRole('button', {name: '折叠筛选部门 若依科技', exact: true}).click(); await expect(page.getByRole('button', {name: '筛选部门 若依科技 / 深圳总公司 / 研发部门', exact: true})).toHaveCount(0); await page.getByRole('button', {name: '展开筛选部门 若依科技', exact: true}).click();
  await page.getByLabel('选择用户 admin', {exact: true}).check(); await page.getByRole('button', {name: '删除所选用户', exact: true}).click();
  await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('不能删除当前登录用户');
  await page.getByRole('button', {name: '取消', exact: true}).click(); await page.getByLabel('选择用户 admin', {exact: true}).uncheck();
  const username = `b${Date.now()}`; await query(page, username);
  await page.getByLabel('开始日期', {exact: true}).fill('2000-01-01'); await page.getByLabel('结束日期', {exact: true}).fill('2099-12-31'); await page.getByRole('button', {name: '查询', exact: true}).click();
  await page.getByRole('button', {name: '新增用户', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('请检查账号');
  await dialog.getByLabel('登录账号', {exact: true}).fill(username); await dialog.getByLabel('用户昵称', {exact: true}).fill('浏览器用户');
  await dialog.getByLabel('用户密码', {exact: true}).fill('Browser123');
  await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','password');
  await dialog.getByRole('button',{name:'显示用户密码',exact:true}).click();await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','text');await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveValue('Browser123');await expect(dialog.getByLabel('用户密码',{exact:true})).toBeFocused();
  await dialog.getByRole('button',{name:'隐藏用户密码',exact:true}).focus();await page.keyboard.press('Space');await expect(dialog.getByLabel('用户密码',{exact:true})).toHaveAttribute('type','password');await expect(dialog.getByRole('button',{name:'显示用户密码',exact:true})).toBeFocused(); await dialog.getByLabel('归属部门', {exact: true}).selectOption('103');
  await dialog.getByLabel('手机号码', {exact: true}).fill('13900000005'); await dialog.getByLabel('邮箱', {exact: true}).fill(`${username}@example.com`);
  await dialog.getByLabel('备注', {exact: true}).fill('待清空'); await dialog.getByRole('group', {name: '角色', exact: true}).getByLabel('普通角色', {exact: true}).check();
  await dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('项目经理', {exact: true}).check();
  await expect(dialog.getByLabel('超级管理员', {exact: true})).toHaveCount(0); await dialog.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('cell', {name: username, exact: true})).toBeVisible();
  await page.getByLabel('手机号码筛选', {exact: true}).fill('13900000005'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: username, exact: true})).toBeVisible(); await page.getByLabel('手机号码筛选', {exact: true}).fill(''); await page.getByRole('button', {name: '查询', exact: true}).click();
  await createDuplicate();
  async function createDuplicate() {
    await page.getByRole('button', {name: '新增用户', exact: true}).click(); const form = page.getByRole('dialog');
    await form.getByLabel('登录账号', {exact: true}).fill(username); await form.getByLabel('用户昵称', {exact: true}).fill('重复用户'); await form.getByLabel('用户密码', {exact: true}).fill('Browser123');
    await form.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(form.getByRole('alert')).toContainText('登录账号已存在'); await page.keyboard.press('Escape'); await expect(form).toHaveCount(0);
  }
  await page.getByLabel('选择用户 ' + username, {exact: true}).check(); await page.getByRole('button', {name: '修改所选用户', exact: true}).click(); dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('登录账号', {exact: true})).toBeDisabled(); await expect(dialog.getByLabel('用户密码', {exact: true})).toHaveCount(0);
  await expect(dialog.getByRole('group', {name: '角色', exact: true}).getByLabel('普通角色', {exact: true})).toBeChecked();
  await dialog.getByLabel('归属部门', {exact: true}).selectOption('105'); await dialog.getByLabel('用户昵称', {exact: true}).fill('已修改浏览器用户');
  await dialog.getByLabel('手机号码', {exact: true}).fill(''); await dialog.getByLabel('邮箱', {exact: true}).fill(''); await dialog.getByLabel('备注', {exact: true}).fill('');
  await dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('项目经理', {exact: true}).uncheck(); await dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('普通员工', {exact: true}).check();
  await dialog.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(dialog).toHaveCount(0); await page.reload();
  await query(page, username); await page.getByRole('button', {name: `修改用户 ${username}`, exact: true}).click(); dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('归属部门', {exact: true})).toHaveValue('105'); await expect(dialog.getByLabel('手机号码', {exact: true})).toHaveValue(''); await expect(dialog.getByLabel('邮箱', {exact: true})).toHaveValue(''); await expect(dialog.getByLabel('备注', {exact: true})).toHaveValue('');
  await expect(dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('普通员工', {exact: true})).toBeChecked(); await page.keyboard.press('Escape');
  await page.getByLabel('搜索部门', {exact: true}).fill('研发部门'); await page.getByRole('button', {name: '筛选部门 若依科技 / 深圳总公司 / 研发部门', exact: true}).click();
  await expect(page.getByText('暂无用户', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '全部部门', exact: true}).click(); await expect(page.getByRole('cell', {name: username, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `分配角色 ${username}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('普通角色', {exact: true}).uncheck(); await dialog.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: `分配角色 ${username}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('普通角色', {exact: true})).not.toBeChecked(); await dialog.getByLabel('普通角色', {exact: true}).check(); await dialog.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: `停用用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await expect(page.getByRole('button', {name: `停用用户 ${username}`, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `停用用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(page.getByRole('button', {name: `启用用户 ${username}`, exact: true})).toBeVisible(); expect(await authenticate(page, username, 'Browser123')).not.toBe(200);
  await page.getByRole('button', {name: `启用用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(page.getByRole('button', {name: `停用用户 ${username}`, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `重置密码 ${username}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('新密码', {exact: true}).fill('bad'); await dialog.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('5–20'); await dialog.getByLabel('新密码', {exact: true}).fill('Reset12345'); await dialog.getByRole('button', {name: '确认保存', exact: true}).click(); await expect(dialog).toHaveCount(0);
  expect(await authenticate(page, username, 'Browser123')).not.toBe(200); expect(await authenticate(page, username, 'Reset12345')).toBe(200);
  await page.getByLabel('用户状态筛选', {exact: true}).selectOption('1'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible(); await page.getByLabel('用户状态筛选', {exact: true}).selectOption('0'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: username, exact: true})).toBeVisible();
  await page.getByText('显示列', {exact: true}).click(); await page.getByLabel('用户昵称', {exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '用户昵称', exact: true})).toHaveCount(0); await page.getByLabel('用户昵称', {exact: true}).check();
  const download = page.waitForEvent('download'); await page.getByRole('button', {name: '导出用户', exact: true}).click(); const file = await download; const xml = workbookXml(await readFile((await file.path())!)); expect(xml).toContain(username); expect(xml).not.toContain('Reset12345');
  await page.getByRole('button', {name: '隐藏筛选', exact: true}).click(); await expect(page.getByLabel('登录账号筛选', {exact: true})).toBeHidden(); await page.getByRole('button', {name: '显示筛选', exact: true}).click();
  await page.screenshot({path: 'test-results/live-users.png', fullPage: true}); await page.getByRole('button', {name: `删除用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '取消', exact: true}).click(); await page.getByRole('button', {name: `删除用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible(); expect(errors).toEqual([]);
});

test('real user pagination, page size and batch deletion', async ({page}) => {
  await login(page); const prefix = `g${Date.now()}`; await query(page, prefix);
  for (let index = 0; index < 12; index++) await create(page, `${prefix}-${index}`);
  await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible(); await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
  await page.getByLabel('每页条数', {exact: true}).selectOption('20'); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
  const selections = page.getByRole('checkbox', {name: /^选择用户 g/}); await expect(selections).toHaveCount(12);
  await selections.first().check(); await expect(page.getByLabel('选择当前页全部用户', {exact: true})).toBeChecked({indeterminate: true});
  await page.getByLabel('选择当前页全部用户', {exact: true}).check(); for (const checkbox of await selections.all()) await expect(checkbox).toBeChecked();
  await page.getByRole('button', {name: '清空选择', exact: true}).click(); await expect(page.getByRole('button', {name: '删除所选用户', exact: true})).toBeDisabled();
  await page.getByLabel('选择当前页全部用户', {exact: true}).check(); await page.getByLabel('选择当前页全部用户', {exact: true}).uncheck(); await expect(page.getByRole('button', {name: '删除所选用户', exact: true})).toBeDisabled(); await page.getByLabel('选择当前页全部用户', {exact: true}).check();
  await expect(page.getByRole('button', {name: '修改所选用户', exact: true})).toBeDisabled(); await page.getByRole('button', {name: '删除所选用户', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible();
});

test('real user template, XLSX import, partial outcomes, opt-in updates and preserved assignments', async ({page}) => {
  await login(page); const username = `i${Date.now()}`; await query(page, username); await create(page, username);
  await page.getByRole('button', {name: `修改用户 ${username}`, exact: true}).click(); let dialog = page.getByRole('dialog'); await dialog.getByLabel('归属部门', {exact: true}).selectOption('105'); await dialog.getByRole('group', {name: '角色', exact: true}).getByLabel('普通角色', {exact: true}).check(); await dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('普通员工', {exact: true}).check(); await dialog.getByRole('button', {name: '保存用户', exact: true}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: '导入用户', exact: true}).click(); dialog = page.getByRole('dialog');
  const download = page.waitForEvent('download'); await dialog.getByRole('button', {name: '下载导入模板', exact: true}).click(); const template = await download; const xml = workbookXml(await readFile((await template.path())!)); expect(xml).toContain('登录名称'); expect(xml).toContain('部门编号'); expect(xml).not.toContain('password');
  await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('请选择');
  await dialog.getByLabel('导入文件', {exact: true}).setInputFiles({name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid')}); await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('alert')).toContainText('有效的 XLS');
  const created = `${username}-n`, invalid = `${username}-x`; const workbook = userWorkbook([['103', username, '导入更新昵称', '', '', '女', '正常'], ['103', created, '新导入用户', '', '', '未知', '正常'], ['103', invalid, '无效手机号', '', 'bad', '未知', '正常']]);
  await dialog.getByLabel('导入文件', {exact: true}).setInputFiles({name: 'users.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbook}); await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('region', {name: '导入结果'}).getByRole('status')).toContainText('新增 1，更新 0，失败 2'); await expect(dialog.getByText('登录账号已存在', {exact: false})).toBeVisible();
  await dialog.getByLabel('更新已存在的用户', {exact: true}).check(); await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('region', {name: '导入结果'}).getByRole('status')).toContainText('新增 0，更新 2，失败 1'); await dialog.getByRole('button', {name: '关闭', exact: true}).click();
  await page.getByRole('button', {name: `修改用户 ${username}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('用户昵称', {exact: true})).toHaveValue('导入更新昵称'); await expect(dialog.getByLabel('归属部门', {exact: true})).toHaveValue('105'); await expect(dialog.getByRole('group', {name: '岗位', exact: true}).getByLabel('普通员工', {exact: true})).toBeChecked(); await expect(dialog.getByRole('group', {name: '角色', exact: true}).getByLabel('普通角色', {exact: true})).toBeChecked(); await page.keyboard.press('Escape'); expect(await authenticate(page, username, 'Browser123')).toBe(200);
  await expect(page.getByRole('cell', {name: created, exact: true})).toBeVisible(); await expect(page.getByRole('cell', {name: invalid, exact: true})).toHaveCount(0);
  for (const account of [username, created]) await page.getByLabel(`选择用户 ${account}`, {exact: true}).check(); await page.getByRole('button', {name: '删除所选用户', exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible();
});

test('real legacy XLS upload and configured initial password', async ({page}) => {
  await login(page); const username = 'legacy_xls_fixture'; await query(page, username);
  await page.getByRole('button', {name: '新增用户', exact: true}).click(); const initialPassword = await page.getByRole('dialog').getByLabel('用户密码', {exact: true}).inputValue(); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '导入用户', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('导入文件', {exact: true}).setInputFiles('tests/fixtures/users.xls'); await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('region', {name: '导入结果'}).getByRole('status')).toContainText('新增 1，更新 0，失败 0'); await dialog.getByRole('button', {name: '关闭', exact: true}).click();
  await expect(page.getByRole('cell', {name: '旧版Excel用户', exact: true})).toBeVisible(); expect(await authenticate(page, username, initialPassword)).toBe(200);
  await page.getByRole('button', {name: `删除用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible();
});

test('large real import reports every committed user and supports drag-drop upload', async ({page}) => {
  test.setTimeout(120000); await login(page); const prefix = `l${Date.now()}`; await query(page, prefix);
  const rows = Array.from({length: 220}, (_, index) => ['103', `${prefix}-${index}`, '批量导入用户', '', '', '未知', '正常']);
  await page.getByRole('button', {name: '导入用户', exact: true}).click(); const dialog = page.getByRole('dialog');
  const transfer = await page.evaluateHandle(buffer => { const value = new DataTransfer(); value.items.add(new File([new Uint8Array(buffer)], 'large-users.xlsx', {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); return value; }, Array.from(userWorkbook(rows)));
  await dialog.locator('.user-dropzone').dispatchEvent('drop', {dataTransfer: transfer}); await transfer.dispose(); await expect(dialog.getByText('large-users.xlsx', {exact: true})).toBeVisible();
  await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('region', {name: '导入结果'}).getByRole('status')).toContainText('新增 220，更新 0，失败 0', {timeout: 100000}); await expect(dialog.getByText('新增成功', {exact: true})).toHaveCount(220); await dialog.getByRole('button', {name: '关闭', exact: true}).click(); await expect(page.getByText('共 220 条，第 1 页', {exact: true})).toBeVisible();
  const cleanup = await page.evaluate(async prefix => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string;
    const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
    for (let batch = 0; batch < 4; batch++) {
      const response = await fetch(`/api/v1/system/users?username=${encodeURIComponent(prefix)}&pageSize=100`, {headers}); if (!response.ok) return response.status;
      const data: PageResponseUserResponse = await response.json(); if (!data.items.length) return 204;
      const removed = await fetch('/api/v1/system/users', {method: 'DELETE', headers, body: JSON.stringify({ids: data.items.map(row => row.id)})}); if (removed.status !== 204) return removed.status;
    }
    return 500;
  }, prefix);
  expect(cleanup).toBe(204); await page.getByRole('button', {name: '刷新列表', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible();
});

test('slow real import response keeps the result visible after the ordinary request deadline', async ({page}) => {
  test.setTimeout(45000); await login(page); const username = `t${Date.now()}`; await query(page, username);
  await page.route('**/api/v1/system/users/import?*', async route => {
    const response = await route.fetch();
    // The real backend commits first; delay only delivery to exercise the browser
    // timeout boundary and prove it does not lose the committed import result.
    await new Promise(resolve => setTimeout(resolve, 16000)); await route.fulfill({response});
  });
  await page.getByRole('button', {name: '导入用户', exact: true}).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('导入文件', {exact: true}).setInputFiles({name: 'slow-users.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: userWorkbook([['103', username, '慢响应用户', '', '', '未知', '正常']])});
  await dialog.getByRole('button', {name: '开始导入', exact: true}).click(); await expect(dialog.getByRole('region', {name: '导入结果'}).getByRole('status')).toContainText('新增 1，更新 0，失败 0', {timeout: 25000}); await dialog.getByRole('button', {name: '关闭', exact: true}).click();
  await expect(page.getByRole('cell', {name: username, exact: true})).toBeVisible(); await page.getByRole('button', {name: `删除用户 ${username}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除', exact: true}).click(); await expect(page.getByText('暂无用户', {exact: true})).toBeVisible();
});
