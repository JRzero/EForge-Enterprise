import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
import {ApiError, errorMessage} from '../../integration/errors';

const storageKey = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'importer', displayName: '导入管理员'}, roles: [], permissions: ['system:user:import'], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});

it('preserves committed and failed import rows through the generated multipart transport', async () => {
  const result = {total: 2, created: 0, updated: 1, failed: 1, rows: [
    {row: 1, username: 'updated', outcome: 'UPDATED'},
    {row: 2, username: 'invalid', outcome: 'FAILED', code: 'VALIDATION_ERROR'},
  ]};
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json(result));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  const file = new File(['fixture'], '用户.xlsx');
  expect(await runtime.api.importUsers(file, true)).toEqual(result);
  const [url, request] = fetcher.mock.calls[1]!;
  expect(new URL(String(url), 'https://local.test').searchParams.get('updateExisting')).toBe('true');
  expect((request?.body as FormData).get('file')).toBe(file);
  expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer token');
  expect(new Headers(request?.headers).get('Content-Type')).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('reports committed data when session publication fails without retrying the import or expiring its caller', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({code: 'USER_IMPORT_SESSION_REFRESH_FAILED'}, 503));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  const failure = await runtime.api.importUsers(new File(['fixture'], '用户.xlsx'), true).catch(error => error);
  expect(failure).toBeInstanceOf(ApiError);
  expect(failure).toMatchObject({status: 503, code: 'USER_IMPORT_SESSION_REFRESH_FAILED'});
  expect(errorMessage(failure)).toContain('成功的记录已保存');
  expect(errorMessage(failure)).toContain('在线会话更新失败');
  expect(runtime.getSnapshot().phase).toBe('authenticated');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
