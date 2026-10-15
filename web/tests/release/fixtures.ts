import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test as base, expect, type Page} from '@playwright/test';
import type {BootstrapResponse, PostRequest, PostResponse} from '../../generated/api';

const origin = 'http://127.0.0.1:4176';
const token = 'dist-only-fictional-token';
const bootstrap: BootstrapResponse = {
  user: {id: '9007199254740993', username: 'dist-reader', displayName: '构建验收账号'},
  roles: [], permissions: ['app:dashboard:view', 'system:post:list', 'system:post:add'],
  navigation: [
    {key: 'dashboard', type: 'ROUTE', routeId: 'dashboard', label: '工作台', order: 0, children: []},
    {key: 'posts', type: 'ROUTE', routeId: 'system-posts', label: '岗位管理', order: 1, children: []}
  ]
};
interface DistState {
  rejectLogin: boolean;
  loginRequests: unknown[];
  bootstrapCalls: number;
  logoutCalls: number;
  postQueries: string[];
  createdPosts: PostRequest[];
  assets: string[];
  pageErrors: string[];
}

export const test = base.extend<{mock: DistState}>({
  mock: [async ({page}, use) => {
    const state: DistState = {rejectLogin: false, loginRequests: [], bootstrapCalls: 0,
      logoutCalls: 0, postQueries: [], createdPosts: [], assets: [], pageErrors: []};
    const posts: PostResponse[] = [{id: '9007199254740995', code: 'dist-seed', name: '构建验收岗位', sort: 0, status: '0'}];
    const unexpected: string[] = [];
    page.on('pageerror', error => state.pageErrors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/assets/')) state.assets.push(new URL(request.url()).pathname);
    });
    // Fail closed: a missing fixture cannot reach the user's local backend or an
    // external service. Production JavaScript/CSS/HTML still come from real dist.
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      if (url.origin !== origin) {
        unexpected.push(`external ${request.method()} ${url.origin}${path}`); return route.abort('blockedbyclient');
      }
      if (path === '/captchaImage' && request.method() === 'GET') return route.fulfill({json: {code: 200, captchaEnabled: false}});
      if (path === '/api/v1/auth/registration' && request.method() === 'GET') return route.fulfill({json: {enabled: false}});
      if (path === '/api/v1/auth/login' && request.method() === 'POST') {
        state.loginRequests.push(request.postDataJSON());
        return route.fulfill(state.rejectLogin
          ? {status: 401, contentType: 'application/problem+json', json: {code: 'AUTHENTICATION_FAILED'}}
          : {json: {accessToken: token, tokenType: 'Bearer'}});
      }
      if (path.startsWith('/api/') || path === '/logout') {
        expect(request.headers().authorization).toBe(`Bearer ${token}`);
        if (path === '/api/v1/app/bootstrap' && request.method() === 'GET') {
          state.bootstrapCalls++; return route.fulfill({json: bootstrap});
        }
        if (path === '/api/v1/system/notices/feed' && request.method() === 'GET') return route.fulfill({json: {items: [], unreadCount: 0}});
        if (path === '/api/v1/system/dictionaries/lookup/sys_normal_disable' && request.method() === 'GET') {
          return route.fulfill({json: [{value: '0', label: '正常', style: 'DEFAULT', defaultEntry: true},
            {value: '1', label: '停用', style: 'INFO', defaultEntry: false}]});
        }
        if (path === '/api/v1/system/posts' && request.method() === 'GET') {
          state.postQueries.push(url.search);
          return route.fulfill({json: {items: posts, total: posts.length, page: 1, pageSize: 10}});
        }
        if (path === '/api/v1/system/posts' && request.method() === 'POST') {
          const body = request.postDataJSON() as PostRequest;
          state.createdPosts.push(body);
          const created = {...body, id: '9007199254740997'};
          posts.push(created); return route.fulfill({status: 201, json: created});
        }
        if (path === '/logout' && request.method() === 'POST') {
          state.logoutCalls++; return route.fulfill({json: {code: 200}});
        }
      }
      if (['fetch', 'xhr'].includes(request.resourceType()) || path.startsWith('/api/') ||
          !['GET', 'HEAD'].includes(request.method())) {
        unexpected.push(`${request.method()} ${path}`);
        return route.fulfill({status: 501, json: {code: 'UNEXPECTED_DIST_TEST_REQUEST'}});
      }
      return route.continue();
    });
    await use(state);
    expect(unexpected, 'Every API request must be explicitly mocked; dist tests never call business services.').toEqual([]);
  }, {auto: true}]
});
export {expect};

/** Resolve the fingerprint from this build, not a source module or an old hash. */
export function builtChunk(name: string): string {
  const assets = readdirSync(fileURLToPath(new URL('../../dist/assets/', import.meta.url)));
  const matches = assets.filter(file => file.startsWith(`${name}-`) && file.endsWith('.js'));
  expect(matches, `Expected one ${name} release chunk. Run npm run build before dist tests.`).toHaveLength(1);
  return `/assets/${matches[0]}`;
}

export async function login(page: Page, path = '/dashboard') {
  await page.goto(path);
  await page.getByLabel('账号', {exact: true}).fill('dist-reader');
  await page.getByLabel('密码', {exact: true}).fill('DistFixture123');
  await page.getByRole('button', {name: '登录', exact: true}).click();
}

export async function openPosts(page: Page) {
  await page.locator('.ef-app-shell__nav').getByRole('link', {name: '岗位管理', exact: true}).click();
}
