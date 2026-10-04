import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const storageKey = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('configuration transport preserves exact IDs, false filters, Unicode query keys and binary export', async () => {
  const id = '9007199254740993', request = {name: '中文名称', key: '中文/键 & data', value: '值', builtin: false, remark: ''};
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({items: [], total: 0, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(json({id, ...request})).mockResolvedValueOnce(json({value: request.value}))
    .mockResolvedValueOnce(json({id, ...request}, 201)).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), {headers: {'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  const controller = new AbortController();
  await runtime.api.listConfigurations({name: request.name, builtin: false, $from: '2026-10-04', to: '2026-10-05'}, controller.signal);
  const query = new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams;
  expect(query.get('builtin')).toBe('false'); expect(query.get('name')).toBe(request.name);
  expect(query.get('from')).toBe('2026-10-04'); expect(query.get('to')).toBe('2026-10-05');
  expect((await runtime.api.getConfiguration(id)).id).toBe(id);
  expect((await runtime.api.getConfigurationValue(request.key)).value).toBe(request.value);
  expect(new URL(String(fetcher.mock.calls[3]![0]), 'https://local.test').searchParams.get('key')).toBe(request.key);
  expect((await runtime.api.createConfiguration(request)).id).toBe(id);
  await runtime.api.updateConfiguration(id, request); expect(JSON.parse(String(fetcher.mock.calls[5]![1]?.body))).toEqual(request);
  await runtime.api.deleteConfigurations([id]); expect(JSON.parse(String(fetcher.mock.calls[6]![1]?.body))).toEqual({ids: [id]});
  await runtime.api.refreshConfigurationCache();
  expect(new Uint8Array(await (await runtime.api.exportConfigurations({builtin: false})).arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit'); expect(init?.signal).toBeInstanceOf(AbortSignal);}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('configuration cache errors retain login for retry; unauthorized lookup expires the session', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({code: 'CONFIGURATION_CACHE_UNAVAILABLE'}, 503))
    .mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.refreshConfigurationCache()).rejects.toThrow('参数缓存暂时不可用'); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await runtime.api.refreshConfigurationCache();
  await expect(runtime.api.getConfigurationValue('test')).rejects.toThrow(); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(storageKey)).toBeNull();
});
