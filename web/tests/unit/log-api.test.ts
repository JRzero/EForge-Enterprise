import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const storageKey = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated log requests preserve filters, exact IDs, data payloads, binary exports and canonical mutations', async () => {
  const id = '9007199254740993', entry = {id, title: '日志', status: '0'}, detail = {entry, responseBody: '<script>untrusted</script>'};
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({items: [entry], total: 1, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(new Uint8Array([80, 75]), {headers: {'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}))
    .mockResolvedValueOnce(json({items: [{id, username: '张 & name'}], total: 1, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(new Uint8Array([80, 75]), {headers: {'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}))
    .mockResolvedValueOnce(new Response(null, {status: 204}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect((await runtime.api.listOperationLogs({title: '模块 & 名称', operator: '张', ip: '127.', businessType: 2, status: 0, $from: '2026-10-01', to: '2026-10-05', sort: 'duration', direction: 'asc'}, controller.signal)).items[0]?.id).toBe(id);
  const query = new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams;
  expect(query.get('title')).toBe('模块 & 名称'); expect(query.get('operator')).toBe('张'); expect(query.get('from')).toBe('2026-10-01'); expect(query.get('status')).toBe('0'); expect(query.get('sort')).toBe('duration');
  expect(await runtime.api.getOperationLog(id)).toEqual(detail); expect(String(fetcher.mock.calls[2]![0])).toContain(id);
  await runtime.api.deleteOperationLogs([id]); expect(JSON.parse(String(fetcher.mock.calls[3]![1]?.body))).toEqual({ids: [id]});
  await runtime.api.clearOperationLogs(); expect(fetcher.mock.calls[4]![1]?.method).toBe('POST');
  expect(await runtime.api.exportOperationLogs({operator: '张', sort: 'time'})).toBeInstanceOf(Blob);
  expect((await runtime.api.listLoginLogs({username: '张 & name', sort: 'username', direction: 'asc'})).items[0]?.id).toBe(id);
  expect(new URL(String(fetcher.mock.calls[6]![0]), 'https://local.test').searchParams.get('username')).toBe('张 & name');
  await runtime.api.deleteLoginLogs([id]); await runtime.api.clearLoginLogs(); expect(await runtime.api.exportLoginLogs({username: '张 & name'})).toBeInstanceOf(Blob);
  await runtime.api.unlockLoginAccount('张 & name'); expect(fetcher.mock.calls[10]![1]?.method).toBe('POST'); expect(JSON.parse(String(fetcher.mock.calls[10]![1]?.body))).toEqual({username: '张 & name'});
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('permission, missing data and unlock faults keep a valid session; actual 401 expires it', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403))
    .mockResolvedValueOnce(json({code: 'OPERATION_LOG_NOT_FOUND'}, 404)).mockResolvedValueOnce(json({code: 'LOGIN_UNLOCK_UNAVAILABLE'}, 503)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.listLoginLogs({})).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.getOperationLog('1')).rejects.toThrow('日志已不存在'); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.unlockLoginAccount('reader')).rejects.toThrow('账号解锁'); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.listOperationLogs({})).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(storageKey)).toBeNull();
});
