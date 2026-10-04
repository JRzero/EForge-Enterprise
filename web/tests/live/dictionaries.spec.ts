import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';

test('real dictionary type/data CRUD, duplicate values, rename, styled comma keys, XLSX and deletion guards', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dict'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '字典管理', exact: true})).toBeVisible();
  const code = `browser_dict_${Date.now()}`, name = `浏览器字典${Date.now()}`;
  await page.getByRole('button', {name: '新增字典类型', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByLabel('字典名称', {exact: true}).fill(name); await dialog.getByLabel('字典类型标识').fill(code); await dialog.getByLabel('备注').fill('真实验证'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByLabel('字典类型筛选').fill(code); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('button', {name, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '新增字典类型', exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('字典名称', {exact: true}).fill('重复'); await dialog.getByLabel('字典类型标识').fill(code); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('button', {name, exact: true}).click(); await expect(page.getByRole('heading', {name: '字典数据', exact: true})).toBeVisible();
  const dictionaryId = new URL(page.url()).pathname.split('/').at(-1)!;
  for (const label of ['逗号标签', '重复键值标签']) {
    await page.getByRole('button', {name: '新增字典数据'}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('数据标签').fill(label); await dialog.getByLabel('数据键值').fill('a,b'); await dialog.getByLabel('回显样式').selectOption('WARNING'); await dialog.getByLabel('默认项').check(); await dialog.getByLabel('备注').fill('可清空备注'); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('cell', {name: label, exact: true})).toBeVisible();
  }
  await expect(page.getByRole('cell', {name: 'a,b', exact: true})).toHaveCount(2); await expect(page.locator('.tag-warning').filter({hasText: '逗号标签'})).toBeVisible();
  await page.getByRole('button', {name: '修改字典 逗号标签', exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('默认项')).toBeChecked(); await dialog.getByLabel('字典状态').selectOption('1'); await dialog.getByLabel('备注').fill(''); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByLabel('状态筛选').selectOption('1'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: '重复键值标签', exact: true})).toHaveCount(0);
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出字典'}).click(); const download = await pending; expect(download.suggestedFilename()).toBe('字典数据.xlsx'); const xml = workbookXml(await readFile((await download.path())!)); expect(xml).toContain('逗号标签'); expect(xml).toContain('a,b'); expect(xml).not.toContain('重复键值标签');
  await page.getByRole('button', {name: '关闭字典数据'}).click(); await page.getByLabel('字典类型筛选').fill(code); await page.getByRole('button', {name: '查询', exact: true}).click();
  await page.getByRole('button', {name: `删除字典 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible(); await page.getByRole('button', {name: '取消', exact: true}).click();
  await page.getByRole('button', {name: `修改字典 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('字典类型标识').fill(`${code}_renamed`); await dialog.getByLabel('备注').fill(''); await dialog.getByRole('button', {name: '保存字典'}).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name: `预览字典 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.locator('p[role=status]')).toHaveText('共计 2 条，正常 1 条，停用 1 条'); await expect(dialog.getByText('逗号标签', {exact: true})).toBeVisible(); await expect(dialog.getByText(`${code}_renamed`, {exact: true})).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('button', {name, exact: true}).click(); await expect(page).toHaveURL(new RegExp(`/dict/data/${dictionaryId}$`));
  for (const label of ['逗号标签', '重复键值标签']) await page.getByRole('checkbox', {name: `选择字典 ${label}`, exact: true}).check();
  await page.getByRole('button', {name: '删除所选字典'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无字典记录', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '关闭字典数据'}).click(); await page.getByLabel('字典类型筛选').fill(code); await page.getByRole('button', {name: '查询', exact: true}).click(); await page.getByRole('button', {name: `删除字典 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无字典记录', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});
