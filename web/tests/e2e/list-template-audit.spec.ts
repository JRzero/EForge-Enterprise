import {test, expect} from './fixtures';
import contracts from '../../app/route-contract.json' with {type: 'json'};

const excluded = new Set(['dashboard', 'monitor-server', 'monitor-cache', 'monitor-cache-entries', 'monitor-druid', 'tool-openapi']);
const cases = contracts.filter(route => !excluded.has(route.id)).map(route => ({...route, url: route.path}));
cases.push(
  {...contracts.find(route => route.id === 'system-roles')!, url: '/role/users/2'},
  {...contracts.find(route => route.id === 'system-dictionaries')!, url: '/dict/data/2'},
  {...contracts.find(route => route.id === 'monitor-jobs')!, url: '/job/log/2'},
);

for (const route of cases) test(`shared list layout: ${route.url}`, async ({page}, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/captchaImage', request => request.fulfill({json: {code: 200, captchaEnabled: false}}));
  await page.route('**/api/v1/**', request => {
    const url = new URL(request.request().url()), path = url.pathname;
    if (path.includes('/dictionaries/lookup/') || path.endsWith('/registration') || path.endsWith('/notices/feed')) return request.fallback();
    if (path.endsWith('/auth/login')) return request.fulfill({json: {accessToken: 'layout-fixture', tokenType: 'Bearer'}});
    if (path.endsWith('/app/bootstrap')) return request.fulfill({json: {
      user: {id: '2', username: 'reader', displayName: '模板验收'}, roles: [], permissions: [route.permission],
      navigation: [{key: route.id, type: 'ROUTE', routeId: route.id, label: '验收页面', order: 0, children: []}],
    }});
    if (path.endsWith('/dictionaries/options')) return request.fulfill({json: [{id: '2', name: '验收字典', code: 'audit_dict', status: '0'}]});
    return request.fulfill({json: url.searchParams.has('page') ? {items: [], total: 0, page: 1, pageSize: 10} : []});
  });
  await page.goto(route.url);
  await page.getByLabel('账号', {exact: true}).fill('reader');
  await page.getByLabel('密码', {exact: true}).fill('password');
  await page.getByRole('button', {name: '登录', exact: true}).click();
  const list = page.locator('.list-page');
  await expect(list).toBeVisible();
  await expect(list.locator(':scope > .ef-page-header')).toHaveCount(0);
  for (const field of await list.locator('.list-filter-field').all()) await expect(field).not.toContainText('筛选');
  await expect(list.locator('.enterprise-data-table table').first()).toBeVisible();
  await expect(list.getByRole('alert')).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const fields = list.locator('.list-filter-field:visible, .list-toolbar > label:visible');
    for (const field of await fields.all()) {
      await expect(field.locator('input,select')).toHaveCount(1);
      const metrics = await field.evaluate(element => {
        const label = element.matches('label') ? element : element.querySelector('label')!, control = element.querySelector('input,select')!;
        const range = document.createRange();
        const text = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        if (text) range.selectNodeContents(text); else range.selectNodeContents(label.querySelector('span') ?? label);
        const a = range.getBoundingClientRect(), b = (control.closest('[data-pressable-container]') ?? control).getBoundingClientRect();
        return {offset: Math.abs(a.y + a.height / 2 - b.y - b.height / 2), left: b.x, right: b.right};
      });
      expect(metrics.offset).toBeLessThanOrEqual(3);
      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(width);
      if (await field.evaluate(element => element.classList.contains('list-filter-field'))) {
        const labelColumn = await field.evaluate(element => {
          const group = element.firstElementChild!;
          return getComputedStyle(group).gridTemplateColumns.split(' ')[0];
        });
        expect(labelColumn).toBe('80px');
      }
    }
    for (const label of await list.locator('.pagination-field:visible').all()) {
      const offset = await label.evaluate(element => {
        const a = element.querySelector('span')!.getBoundingClientRect(), b = element.querySelector('input,select')!.getBoundingClientRect();
        return Math.abs(a.y + a.height / 2 - b.y - b.height / 2);
      });
      expect(offset).toBeLessThanOrEqual(2);
    }
    await page.screenshot({path: info.outputPath(`list-${width}.png`), fullPage: true});
  }
  expect(errors).toEqual([]);
});
