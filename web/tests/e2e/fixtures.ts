import {test as base} from '@playwright/test';
export {expect} from '@playwright/test';
export const test = base.extend<{dictionaryLookup: void}>({dictionaryLookup: [async ({page}, use) => {
  await page.route('**/api/v1/system/notices/feed', route => route.fulfill({json: {items: [], unreadCount: 0}}));
  await page.route('**/api/v1/system/dictionaries/lookup/*', route => {
    const code = new URL(route.request().url()).pathname.split('/').at(-1);
    const options = code === 'sys_user_sex' ? [['0', '男'], ['1', '女'], ['2', '未知']] : code === 'sys_show_hide' ? [['0', '显示'], ['1', '隐藏']] : [['0', '正常'], ['1', '停用']];
    return route.fulfill({json: options.map(([value, label]) => ({value, label, style: 'DEFAULT', defaultEntry: value === '0'}))});
  }); await use();
}, {auto: true}]});
