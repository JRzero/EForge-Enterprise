import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {workbookXml} from '../helpers/user-workbook';
async function login(page: Page) {
  await page.goto('/config'); await page.getByLabel('账号', {exact: true}).fill('admin'); await page.getByLabel('密码', {exact: true}).fill('admin123'); await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '参数配置', exact: true})).toBeVisible();
}
test('real configuration CRUD, builtin protection, rename, clear, XLSX and refresh', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await login(page);
  const name = `浏览器参数${Date.now()}`, key = `中文/键 & ${Date.now()}`;
  await page.getByRole('button', {name: '新增参数', exact: true}).click(); let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog.getByRole('alert')).toContainText('请填写');
  await dialog.getByLabel('参数名称', {exact: true}).fill(name); await dialog.getByLabel('参数键名', {exact: true}).fill(key); await dialog.getByLabel('参数键值', {exact: true}).fill('中文 <plain>'); await dialog.getByLabel('备注', {exact: true}).fill('待清空');
  await expect(dialog.getByLabel('系统内置', {exact: true})).toHaveValue('Y'); await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog).toHaveCount(0);
  await page.locator('.list-filters').getByLabel('参数名称', {exact: true}).fill(name); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: key, exact: true})).toBeVisible();
  await page.getByRole('button', {name: `删除 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('内置参数不能删除'); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '新增参数', exact: true}).click(); dialog = page.getByRole('dialog'); await dialog.getByLabel('参数名称', {exact: true}).fill('重复'); await dialog.getByLabel('参数键名', {exact: true}).fill(key); await dialog.getByLabel('参数键值', {exact: true}).fill('值'); await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog.getByRole('alert')).toContainText('键名已存在'); await page.keyboard.press('Escape');
  const discard = page.getByRole('alertdialog', {name: '有未保存的修改', exact: true}); await expect(discard).toBeVisible();
  await expect(dialog.getByLabel('参数名称', {exact: true})).toHaveValue('重复'); await expect(dialog.getByLabel('参数键名', {exact: true})).toHaveValue(key); await expect(dialog.getByLabel('参数键值', {exact: true})).toHaveValue('值');
  await discard.getByRole('button', {name: '放弃修改', exact: true}).click(); await expect(discard).toHaveCount(0); await expect(dialog).toHaveCount(0);
  await page.getByRole('checkbox', {name: `选择参数 ${name}`, exact: true}).check(); await page.getByRole('button', {name: '修改所选参数'}).click(); dialog = page.getByRole('dialog');
  const renamed = `${key}.renamed`; await dialog.getByLabel('参数键名', {exact: true}).fill(renamed); await dialog.getByLabel('参数键值', {exact: true}).fill('新值'); await dialog.getByLabel('备注', {exact: true}).fill(''); await dialog.getByLabel('系统内置', {exact: true}).selectOption('N'); await dialog.getByRole('button', {name: '保存参数'}).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('cell', {name: renamed, exact: true})).toBeVisible(); await page.getByRole('button', {name: `修改 ${name}`, exact: true}).click(); dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('备注', {exact: true})).toHaveValue(''); await expect(dialog.getByLabel('系统内置', {exact: true})).toHaveValue('N'); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(discard).toHaveCount(0);
  const values = await page.evaluate(async keys => {const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; return Promise.all(keys.map(async key => {const response = await fetch(`/api/v1/system/configurations/lookup?key=${encodeURIComponent(key)}`, {headers: {Authorization: `Bearer ${token}`}}); if (!response.ok) throw new Error('Lookup failed'); return (await response.json()).value;}));}, [key, renamed]); expect(values).toEqual(['', '新值']);
  await page.locator('.list-filters').getByLabel('系统内置').selectOption('N'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('cell', {name: renamed, exact: true})).toBeVisible();
  await page.getByText('显示列', {exact: true}).click(); await page.getByRole('checkbox', {name: '参数键值', exact: true}).uncheck(); await expect(page.getByRole('columnheader', {name: '参数键值', exact: true})).toHaveCount(0); await page.getByText('显示列', {exact: true}).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', {name: '导出参数'}).click(); const download = await pending; expect(download.suggestedFilename()).toBe('参数数据.xlsx'); const xml = workbookXml(await readFile((await download.path())!)); expect(xml).toContain('新值'); expect(xml).toContain('浏览器参数'); expect(xml).not.toContain('sys.account.captchaEnabled');
  await page.getByRole('button', {name: '刷新参数缓存'}).click(); await expect(page.getByText('参数缓存已刷新。')).toBeVisible();
  await page.getByRole('button', {name: `删除 ${name}`, exact: true}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无参数', {exact: true})).toBeVisible(); expect(errors).toEqual([]);
});
test('real configuration paging, dates, last-page deletion and batch selection', async ({page}) => {
  await login(page); const prefix = `config-paging-${Date.now()}`;
  await page.evaluate(async prefix => {const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken; for (let index = 0; index < 12; index++) {const response = await fetch('/api/v1/system/configurations', {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({name: `${prefix}-${index}`, key: `${prefix}.${index}`, value: String(index), builtin: false})}); if (response.status !== 201) throw new Error('Configuration paging fixture failed');}}, prefix);
  await page.locator('.list-filters').getByLabel('参数名称', {exact: true}).fill(prefix); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '下一页', exact: true}).click(); await expect(page.getByText('共 12 条，第 2 页', {exact: true})).toBeVisible();
  for (const index of [10, 11]) await page.getByRole('checkbox', {name: `选择参数 ${prefix}-${index}`, exact: true}).check(); await page.getByRole('button', {name: '删除所选参数'}).click(); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  await page.getByLabel('开始日期').fill('2026-10-05'); await page.getByLabel('结束日期').fill('2026-10-04'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByRole('alert')).toContainText('开始日期不能晚于结束日期');
  await page.getByLabel('开始日期').fill('2000-01-01'); await page.getByLabel('结束日期').fill('2000-01-02'); await page.getByRole('button', {name: '查询', exact: true}).click(); await expect(page.getByText('暂无参数', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '重置', exact: true}).click(); await expect(page.getByLabel('开始日期')).toHaveValue(''); await page.locator('.list-filters').getByLabel('参数名称', {exact: true}).fill(prefix); await page.getByRole('button', {name: '查询', exact: true}).click(); await page.getByLabel('每页条数').selectOption('20'); await expect(page.getByText('共 10 条，第 1 页', {exact: true})).toBeVisible();
  for (let index = 0; index < 10; index++) await page.getByRole('checkbox', {name: `选择参数 ${prefix}-${index}`, exact: true}).check(); await page.getByRole('button', {name: '删除所选参数'}).click(); await expect(page.getByRole('alertdialog')).toContainText('10 个参数'); await page.getByRole('button', {name: '确认删除'}).click(); await expect(page.getByText('暂无参数', {exact: true})).toBeVisible();
});
