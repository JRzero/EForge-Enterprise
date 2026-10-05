import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const storageKey = 'eforge.enterprise.session.v1';
const bootstrap = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated cache operations preserve exact data, query keys, scoped bodies and authenticated cancellation', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const stats = {info: {usedMemoryBytes: '9007199254740993'}, keyCount: '9007199254740993', commands: [{name: 'get', calls: '9007199254740993'}]};
  const name = 'sys_config:', key = 'sys_config:中文/a & b';
  const value = {name, key, value: '<script>文本</script>'};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json(stats)).mockResolvedValueOnce(json([{name, description: '配置信息'}]))
    .mockResolvedValueOnce(json([key])).mockResolvedValueOnce(json(value)).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(new Response(null, {status: 204}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect(await runtime.api.getCacheStatistics(controller.signal)).toEqual(stats); expect(await runtime.api.listCacheNames()).toEqual([{name, description: '配置信息'}]);
  expect(await runtime.api.listCacheKeys(name)).toEqual([key]); expect(await runtime.api.getCacheValue(name, key)).toEqual(value);
  await runtime.api.clearCacheKey({name, key}); await runtime.api.clearCacheName(name); await runtime.api.clearAllCache();
  const query = new URL(String(fetcher.mock.calls[4]![0]), 'http://local').searchParams; expect(query.get('name')).toBe(name); expect(query.get('key')).toBe(key);
  expect(JSON.parse(String(fetcher.mock.calls[5]![1]?.body))).toEqual({name, key}); expect(fetcher.mock.calls[5]![1]?.method).toBe('DELETE');
  expect(String(fetcher.mock.calls[6]![0])).toBe('/api/v1/monitor/cache/names/sys_config%3A'); expect(String(fetcher.mock.calls[7]![0])).toBe('/api/v1/monitor/cache'); expect(fetcher.mock.calls[7]![1]?.method).toBe('DELETE');
  for (const [, init] of fetcher.mock.calls.slice(1)) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('Redis faults and expiry permit recovery; actual authentication loss after clearing ends the session', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({code: 'CACHE_UNAVAILABLE'}, 503))
    .mockResolvedValueOnce(json({code: 'CACHE_KEY_NOT_FOUND'}, 404)).mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403))
    .mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.getCacheStatistics()).rejects.toMatchObject({status: 503, code: 'CACHE_UNAVAILABLE'});
  await expect(runtime.api.getCacheValue('sys_config:', 'sys_config:expired')).rejects.toMatchObject({status: 404, code: 'CACHE_KEY_NOT_FOUND'});
  await expect(runtime.api.clearCacheName('sys_config:')).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await runtime.api.clearAllCache(); await expect(runtime.api.listCacheNames()).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(storageKey)).toBeNull();
});
