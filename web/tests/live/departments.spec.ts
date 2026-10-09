import {test, expect, type Page} from '@playwright/test';
import type {DepartmentResponse} from '../../generated/api';

async function login(page: Page) {
  await page.goto('/dept'); await page.getByLabel('账号', {exact: true}).fill('admin');
  await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '部门管理', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '修改部门 测试部门', exact: true})).toBeVisible();
}
async function create(page: Page, name: string) {
  const response = page.waitForResponse(response => response.url().endsWith('/api/v1/system/departments') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('dialog').getByLabel('部门名称', {exact: true}).fill(name);
  await page.getByRole('button', {name: '保存部门', exact: true}).click();
  const result: DepartmentResponse = await (await response).json();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', {name: `修改部门 ${name}`, exact: true})).toBeVisible();
  return result;
}

test('real department tree, CRUD, parent exclusion, reparenting, sort, filters and deletion protection', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', cause => errors.push(cause.message));
  await login(page);
  await page.getByRole('button', {name: '折叠全部', exact: true}).click();
  await expect(page.getByRole('button', {name: '修改部门 测试部门', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: '展开全部', exact: true}).click();
  await expect(page.getByRole('button', {name: '修改部门 测试部门', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '删除部门 研发部门', exact: true}).click();
  await page.getByRole('button', {name: '确认删除', exact: true}).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('仍有用户');
  await page.getByRole('button', {name: '取消', exact: true}).click();

  const prefix = `浏览器部门-${Date.now()}`;
  await page.getByRole('button', {name: '新增部门', exact: true}).click();
  await page.getByRole('button', {name: '保存部门', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('请检查上级部门');
  await page.getByRole('dialog').getByLabel('上级部门', {exact: true}).selectOption('100');
  await page.getByRole('dialog').getByLabel('查找上级部门', {exact: true}).fill('市场部门');
  await expect(page.getByRole('dialog').locator('option[value="104"]')).toContainText('深圳总公司 / 市场部门');
  await expect(page.getByRole('dialog').locator('option[value="108"]')).toContainText('长沙分公司 / 市场部门');
  await page.getByRole('dialog').getByLabel('查找上级部门', {exact: true}).fill('');
  await page.getByRole('dialog').getByLabel('负责人', {exact: true}).fill('验证负责人');
  await page.getByRole('dialog').getByLabel('联系电话', {exact: true}).fill('13812345678');
  await page.getByRole('dialog').getByLabel('邮箱', {exact: true}).fill('browser@example.test');
  const parent = await create(page, prefix);

  await page.getByRole('button', {name: '新增部门', exact: true}).click();
  await page.getByRole('dialog').getByLabel('上级部门', {exact: true}).selectOption('100');
  await page.getByRole('dialog').getByLabel('部门名称', {exact: true}).fill(prefix);
  await page.getByRole('button', {name: '保存部门', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('同名部门');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true});
  await expect(discard).toBeVisible();
  await discard.getByRole('button', {name: '继续编辑', exact: true}).click();
  await expect(page.getByRole('dialog').getByLabel('部门名称', {exact: true})).toHaveValue(prefix);
  await expect(page.getByRole('dialog').getByLabel('上级部门', {exact: true})).toHaveValue('100');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('同名部门');
  await page.keyboard.press('Escape');
  await discard.getByRole('button', {name: '放弃修改', exact: true}).click();
  await expect(discard).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', {name: `新增子部门 ${prefix}`, exact: true}).click();
  await expect(page.getByRole('dialog').getByLabel('上级部门', {exact: true})).toHaveValue(parent.id);
  const child = await create(page, `${prefix}-子`);
  await page.getByRole('button', {name: `折叠 ${prefix}`, exact: true}).click();
  await expect(page.getByRole('button', {name: `修改部门 ${child.name}`, exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: `展开 ${prefix}`, exact: true}).click();

  await page.getByRole('button', {name: `修改部门 ${prefix}`, exact: true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator(`option[value="${parent.id}"]`)).toHaveCount(0);
  await expect(dialog.locator(`option[value="${child.id}"]`)).toHaveCount(0);
  await dialog.getByLabel('部门状态', {exact: true}).selectOption('1');
  await page.getByRole('button', {name: '保存部门', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('正常状态的下级部门');
  await dialog.getByLabel('部门状态', {exact: true}).selectOption('0');
  await dialog.getByLabel('查找上级部门', {exact: true}).fill('深圳');
  await expect(dialog.locator('option[value="101"]')).toHaveCount(1);
  await expect(dialog.locator('option[value="102"]')).toHaveCount(0);
  await dialog.getByLabel('上级部门', {exact: true}).selectOption('101');
  await dialog.getByLabel('负责人', {exact: true}).fill('');
  await dialog.getByLabel('联系电话', {exact: true}).fill('');
  await dialog.getByLabel('邮箱', {exact: true}).fill('');
  await page.getByRole('button', {name: '保存部门', exact: true}).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel(`排序 ${parent.name}`, {exact: true}).fill('17');
  await page.getByLabel(`排序 ${child.name}`, {exact: true}).fill('18');
  await page.getByRole('button', {name: '保存部门排序', exact: true}).click();
  await expect(page.getByText('部门排序已保存。', {exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`排序 ${child.name}`, {exact: true})).toHaveValue('18');
  await page.getByRole('button', {name: `修改部门 ${prefix}`, exact: true}).click();
  await expect(dialog.getByLabel('上级部门', {exact: true})).toHaveValue('101');
  await expect(dialog.getByLabel('负责人', {exact: true})).toHaveValue('');
  await expect(dialog.getByLabel('邮箱', {exact: true})).toHaveValue('');
  await page.getByRole('button', {name: '取消', exact: true}).click();
  await page.getByRole('button', {name: '重置', exact: true}).click();
  await expect(page.getByRole('button', {name: '修改部门 测试部门', exact: true})).toBeVisible();
  await page.locator('.list-filters').getByLabel('部门名称', {exact: true}).fill(prefix);
  await page.locator('.list-filters').getByLabel('部门状态', {exact: true}).selectOption('1');
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByText('暂无部门', {exact: true})).toBeVisible();
  await page.locator('.list-filters').getByLabel('部门状态', {exact: true}).selectOption('0');
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByRole('button', {name: `修改部门 ${child.name}`, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '隐藏筛选', exact: true}).click();
  await expect(page.locator('.list-filters').getByLabel('部门名称', {exact: true})).toBeHidden();
  await page.getByRole('button', {name: '显示筛选', exact: true}).click();
  await page.screenshot({path: 'test-results/live-departments.png', fullPage: true});
  await page.getByRole('button', {name: `删除部门 ${parent.name}`, exact: true}).click();
  await page.getByRole('button', {name: '确认删除', exact: true}).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('仍有下级部门');
  await page.getByRole('button', {name: '取消', exact: true}).click();
  await page.getByRole('button', {name: `删除部门 ${child.name}`, exact: true}).click();
  await page.getByRole('button', {name: '取消', exact: true}).click();
  await expect(page.getByRole('button', {name: `修改部门 ${child.name}`, exact: true})).toBeVisible();
  for (const department of [child, parent]) {
    await page.getByRole('button', {name: `删除部门 ${department.name}`, exact: true}).click();
    await page.getByRole('button', {name: '确认删除', exact: true}).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('button', {name: `修改部门 ${department.name}`, exact: true})).toHaveCount(0);
  }
  await expect(page.getByText('暂无部门', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});
