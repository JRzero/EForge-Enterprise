import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';

async function login(page: Page) {
  await page.goto('/post'); await page.getByLabel('账号', {exact: true}).fill('admin');
  await page.getByLabel('密码', {exact: true}).fill('admin123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  await expect(page.getByRole('heading', {name: '岗位管理', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: 'ceo', exact: true})).toBeVisible();
}

// Read ZIP central-directory entries, including Excel's streamed data descriptors.
function workbookXml(buffer: Buffer): string {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Download is not an XLSX ZIP archive.');
  let cursor = buffer.readUInt32LE(end + 16); const entries = buffer.readUInt16LE(end + 10);
  const xml: string[] = [];
  for (let index = 0; index < entries; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory.');
    const method = buffer.readUInt16LE(cursor + 10), size = buffer.readUInt32LE(cursor + 20);
    const nameSize = buffer.readUInt16LE(cursor + 28), extraSize = buffer.readUInt16LE(cursor + 30), commentSize = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameSize).toString();
    const offset = buffer.readUInt32LE(cursor + 42);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (name.startsWith('xl/') && name.endsWith('.xml')) {
      const content = buffer.subarray(start, start + size);
      xml.push((method === 8 ? inflateRawSync(content) : content).toString());
    }
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  return xml.join('\n');
}

test('real post create, duplicate handling, edit, filters, columns, XLSX and deletion protection', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', cause => errors.push(cause.message));
  await login(page);
  await page.getByRole('button', {name: '删除 董事长', exact: true}).click();
  await page.getByRole('button', {name: '确认删除', exact: true}).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('已分配给用户');
  await page.getByRole('button', {name: '取消', exact: true}).click();

  const code = `browser-${Date.now()}`, name = `浏览器验证-${Date.now()}`;
  await page.getByRole('button', {name: '新增岗位', exact: true}).click();
  await page.getByRole('button', {name: '保存岗位', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('请填写岗位编码');
  await page.getByRole('dialog').getByLabel('岗位编码', {exact: true}).fill(code);
  await page.getByRole('dialog').getByLabel('岗位名称', {exact: true}).fill(name);
  const nativeEditor=page.getByRole('dialog',{name:'新增岗位',exact:true}),geometry=(await nativeEditor.boundingBox())!;
  await nativeEditor.getByRole('button',{name:'移动弹窗',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect.poll(async()=>Math.round((await nativeEditor.boundingBox())!.x-geometry.x)).toBe(10);
  await nativeEditor.getByRole('button',{name:'调整弹窗宽度',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect.poll(async()=>Math.round((await nativeEditor.boundingBox())!.width-geometry.width)).toBe(10);
  await page.keyboard.press('Home');await expect(nativeEditor.getByLabel('岗位名称',{exact:true})).toHaveValue(name);
  await page.getByRole('dialog').getByLabel('显示顺序', {exact: true}).fill('9');
  await page.getByLabel('备注', {exact: true}).fill('浏览器真实操作');
  await page.getByRole('button', {name: '保存岗位', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('岗位已新增。', {exact: true})).toBeVisible();

  await page.getByRole('button', {name: '新增岗位', exact: true}).click();
  await page.getByRole('dialog').getByLabel('岗位编码', {exact: true}).fill(code);
  await page.getByRole('dialog').getByLabel('岗位名称', {exact: true}).fill(`${name}-重复`);
  await page.getByRole('button', {name: '保存岗位', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('编码已存在');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByLabel('岗位编码筛选', {exact: true}).fill(code);
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByRole('cell', {name: code, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '隐藏筛选', exact: true}).click();
  await expect(page.getByLabel('岗位编码筛选', {exact: true})).toBeHidden();
  await page.getByRole('button', {name: '显示筛选', exact: true}).click();
  await expect(page.getByLabel('岗位编码筛选', {exact: true})).toHaveValue(code);
  await page.getByRole('button', {name: `修改 ${name}`, exact: true}).click();
  await expect(page.getByLabel('备注', {exact: true})).toHaveValue('浏览器真实操作');
  await page.getByLabel('岗位状态', {exact: true}).selectOption('1');
  await page.getByRole('dialog').getByLabel('显示顺序', {exact: true}).fill('12');
  await page.getByLabel('备注', {exact: true}).fill('');
  await page.getByRole('button', {name: '保存岗位', exact: true}).click();
  await expect(page.getByRole('cell', {name: '停用', exact: true})).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', {name: '岗位管理', exact: true})).toBeVisible();
  await page.getByLabel('岗位编码筛选', {exact: true}).fill(code);
  await page.getByLabel('状态筛选', {exact: true}).selectOption('0');
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByText('暂无岗位', {exact: true})).toBeVisible();
  await page.getByLabel('状态筛选', {exact: true}).selectOption('1');
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByRole('cell', {name: code, exact: true})).toBeVisible();
  await page.getByText('显示列', {exact: true}).click();
  await page.getByRole('checkbox', {name: '创建时间', exact: true}).uncheck();
  await expect(page.getByRole('columnheader', {name: '创建时间', exact: true})).toHaveCount(0);
  await page.getByRole('checkbox', {name: '创建时间', exact: true}).check();
  await page.getByText('显示列', {exact: true}).click();
  await page.screenshot({path: 'test-results/live-posts.png', fullPage: true});
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出岗位', exact: true}).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('岗位数据.xlsx');
  const file = await download.path(); expect(file).not.toBeNull();
  const xml = workbookXml(await readFile(file!)); expect(xml).toContain(code); expect(xml).toContain('停用'); expect(xml).not.toContain('董事长');
  await page.getByRole('checkbox', {name: `选择岗位 ${name}`, exact: true}).check();
  await page.getByRole('button', {name: '删除所选岗位', exact: true}).click();
  await page.getByRole('button', {name: '取消', exact: true}).click();
  await expect(page.getByRole('cell', {name: code, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '删除所选岗位', exact: true}).click();
  await page.getByRole('button', {name: '确认删除', exact: true}).click();
  await expect(page.getByText('暂无岗位', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('real server pagination, page size and multi-row batch deletion', async ({page}) => {
  await login(page);
  const prefix = `paging-${Date.now()}`;
  // Seed enough real rows to exercise page boundaries without twelve identical UI creates.
  await page.evaluate(async prefix => {
    const token = JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken;
    for (let index = 0; index < 12; index++) {
      const response = await fetch('/api/v1/system/posts', {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({code: `${prefix}-${index}`, name: `${prefix}-岗位-${index}`, sort: index, status: '0'})});
      if (response.status !== 201) throw new Error('Pagination fixture creation failed.');
    }
  }, prefix);
  await page.getByLabel('岗位名称筛选', {exact: true}).fill(prefix);
  await page.getByRole('button', {name: '查询', exact: true}).click();
  await expect(page.getByText('共 12 条，第 1 页', {exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: `${prefix}-9`, exact: true})).toBeVisible();
  await page.getByRole('button', {name: '下一页', exact: true}).click();
  await expect(page.getByRole('cell', {name: `${prefix}-10`, exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: `${prefix}-0`, exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '下一页', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '上一页', exact: true}).click();
  await page.getByLabel('每页条数', {exact: true}).selectOption('20');
  await expect(page.getByRole('cell', {name: `${prefix}-11`, exact: true})).toBeVisible();
  for (let index = 0; index < 12; index++) await page.getByRole('checkbox', {name: `选择岗位 ${prefix}-岗位-${index}`, exact: true}).check();
  await page.getByRole('button', {name: '删除所选岗位', exact: true}).click();
  await expect(page.getByRole('alertdialog')).toContainText('12 个岗位');
  await page.getByRole('button', {name: '确认删除', exact: true}).click();
  await expect(page.getByText('暂无岗位', {exact: true})).toBeVisible();
});
