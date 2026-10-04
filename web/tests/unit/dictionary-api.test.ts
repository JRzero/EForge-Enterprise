import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const key = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated dictionary transport preserves exact IDs, filters, duplicate values and binary exports', async () => {
  const id = '9007199254740993', storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const duplicateValues = [{value: '0', label: 'First', style: 'PRIMARY', defaultEntry: true}, {value: '0', label: 'Second', style: 'DEFAULT', defaultEntry: true}];
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({items: [], total: 0, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(json({items: [], total: 0, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(json(duplicateValues)).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), {headers: {'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await runtime.api.listDictionaries({name: '中文 & data', $from: '2026-10-04', to: '2026-10-05'});
  const query = new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams;
  expect(query.get('name')).toBe('中文 & data'); expect(query.get('from')).toBe('2026-10-04'); expect(query.get('to')).toBe('2026-10-05');
  await runtime.api.listDictionaryEntries(id, {label: 'A&B'});
  expect(new URL(String(fetcher.mock.calls[2]![0]), 'https://local.test').searchParams.get('dictionaryId')).toBe(id);
  expect(await runtime.api.getDictionaryValues('sys_normal_disable')).toEqual(duplicateValues);
  await runtime.api.deleteDictionaryEntries([id]); expect(JSON.parse(String(fetcher.mock.calls[4]![1]?.body))).toEqual({ids: [id]});
  expect(new Uint8Array(await (await runtime.api.exportDictionaries({status: '1'})).arrayBuffer())).toEqual(new Uint8Array([80, 75, 3, 4]));
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit'); expect(init?.signal).toBeInstanceOf(AbortSignal);}
});
it('dictionary cache failure retains the session for retry, while lookup 401 clears it', async () => {
  const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({code: 'DICTIONARY_CACHE_UNAVAILABLE'}, 503))
    .mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.refreshDictionaryCache()).rejects.toThrow('字典缓存暂时不可用'); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await runtime.api.refreshDictionaryCache(); expect(fetcher.mock.calls[1]![0]).toBe(fetcher.mock.calls[2]![0]);
  await expect(runtime.api.getDictionaryValues('sys_normal_disable')).rejects.toThrow(); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(key)).toBeNull();
});
