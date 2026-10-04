import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const storageKey = 'eforge.enterprise.session.v1';
const snapshot = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated notice transport preserves HTML data, exact IDs, consumer reads and filtered readers', async () => {
  const id = '9007199254740993', request = {title: '公告 & 名称', type: '2', content: '<p><strong>中文</strong></p>', status: '0', remark: ''};
  const row = {id, ...request}, feed = {items: [{id, title: request.title, type: '2', read: false}], unreadCount: 1};
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({items: [row], total: 1, page: 1, pageSize: 10})).mockResolvedValueOnce(json(row))
    .mockResolvedValueOnce(json(row, 201)).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(json(feed)).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(json({items: [{userId: id, username: 'reader'}], total: 1, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(new Response(null, {status: 204}));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  const controller = new AbortController();
  await runtime.api.listNotices({title: request.title, author: '张三', $type: '2'}, controller.signal);
  const query = new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams;
  expect(query.get('title')).toBe(request.title); expect(query.get('author')).toBe('张三'); expect(query.get('type')).toBe('2');
  expect((await runtime.api.getNotice(id)).content).toBe(request.content);
  expect((await runtime.api.createNotice(request)).id).toBe(id);
  await runtime.api.updateNotice(id, {...request, content: ''}); expect(JSON.parse(String(fetcher.mock.calls[4]![1]?.body)).content).toBe('');
  expect(await runtime.api.getNoticeFeed()).toEqual(feed);
  await runtime.api.markNoticesRead([id]); expect(JSON.parse(String(fetcher.mock.calls[6]![1]?.body))).toEqual({ids: [id]});
  expect((await runtime.api.listNoticeReaders(id, {search: '中文 & reader'})).items[0]?.userId).toBe(id);
  expect(new URL(String(fetcher.mock.calls[7]![0]), 'https://local.test').searchParams.get('search')).toBe('中文 & reader');
  await runtime.api.deleteNotices([id]); expect(JSON.parse(String(fetcher.mock.calls[8]![1]?.body))).toEqual({ids: [id]});
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('missing notice retains login, while feed 401 expires the session', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({code: 'NOTICE_NOT_FOUND'}, 404)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.getNotice('1')).rejects.toThrow('公告已不存在'); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.getNoticeFeed()).rejects.toThrow(); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(storageKey)).toBeNull();
});
