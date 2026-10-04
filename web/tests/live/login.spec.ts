import {test, expect} from '@playwright/test';
for (const username of ['admin', 'ry']) {
  test(`${username}: real login, Redis session restore and logout invalidation`, async ({page}) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/dashboard'); await page.getByLabel('账号', {exact: true}).fill(username);
    await page.getByLabel('密码', {exact: true}).fill('admin123');
    await page.getByRole('button', {name: '登录', exact: true}).click();
    await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible();
    await expect(page.getByRole('link', {name: '工作台', exact: true})).toBeVisible();
    await page.screenshot({path: `test-results/live-${username}-dashboard.png`, fullPage: true});
    const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('eforge.enterprise.session.v1')!).accessToken as string);
    await page.reload(); await expect(page.getByRole('heading', {name: /^你好，/})).toBeVisible();
    await page.goto('/missing'); await expect(page.getByRole('heading', {name: '页面不存在'})).toBeVisible();
    await page.getByRole('button', {name: '返回工作台'}).click();
    await page.getByRole('button', {name: '退出登录'}).click();
    await expect(page.getByRole('heading', {name: '登录工作空间'})).toBeVisible();
    const status = await page.evaluate(async token => (await fetch('/api/v1/app/bootstrap', {headers: {Authorization: `Bearer ${token}`}})).status, token);
    expect(status).toBe(401); expect(errors).toEqual([]);
  });
}
