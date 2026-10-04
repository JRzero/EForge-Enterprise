import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const key = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated online requests encode exact filters, preserve opaque identifiers and forward cancellation', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({items: [{id, username: '张 & 用户'}], total: 1, page: 2, pageSize: 1}))
    .mockResolvedValueOnce(new Response(null, {status: 204}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect((await runtime.api.listOnlineSessions({username: '张 & 用户', ip: '::1', page: 2, pageSize: 1}, controller.signal)).items[0]?.id).toBe(id);
  const query = new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams;
  expect(query.get('username')).toBe('张 & 用户'); expect(query.get('ip')).toBe('::1'); expect(query.get('page')).toBe('2');
  await runtime.api.revokeOnlineSession(id); expect(fetcher.mock.calls[2]![1]?.method).toBe('DELETE'); expect(String(fetcher.mock.calls[2]![0])).toContain(id);
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('Redis failure and denied revocation keep the session, while actual revocation of the caller expires it', async () => {
  const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({code: 'ONLINE_SESSIONS_UNAVAILABLE'}, 503))
    .mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.listOnlineSessions({})).rejects.toMatchObject({status: 503, code: 'ONLINE_SESSIONS_UNAVAILABLE'});
  await expect(runtime.api.revokeOnlineSession('opaque-id')).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.listOnlineSessions({})).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(key)).toBeNull();
});
