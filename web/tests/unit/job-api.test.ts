import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const snapshot = {user: {id: '2', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated task/log transports preserve filters, long IDs, abort and full binary export', async () => {
  const id = '9007199254740993', entry = {id, name: '任务 & 名称'};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({items: [entry], total: 1, page: 1, pageSize: 10}))
    .mockResolvedValueOnce(json(entry)).mockResolvedValueOnce(json({items: [entry], total: 1, page: 1, pageSize: 10})).mockResolvedValueOnce(json({entry, exceptionInfo: '<script>text</script>'}))
    .mockResolvedValueOnce(new Response(null, {status: 204})).mockResolvedValueOnce(new Response(null, {status: 204}))
    .mockResolvedValueOnce(new Response('PK')).mockResolvedValueOnce(new Response('PK')).mockResolvedValueOnce(json({zone: 'UTC', times: []}));
  const storage = createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})}); const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect((await runtime.api.listJobs({name: entry.name, sort: 'name', direction: 'desc'}, controller.signal)).items[0]?.id).toBe(id);
  expect(await runtime.api.getJob(id)).toEqual(entry); expect((await runtime.api.listJobLogs({name: entry.name, $from: '2026-10-01', direction: 'asc'})).items[0]?.id).toBe(id);
  expect((await runtime.api.getJobLog(id)).exceptionInfo).toBe('<script>text</script>'); await runtime.api.deleteJobLogs([id]); await runtime.api.clearJobLogs();
  expect(await runtime.api.exportJobs({name: entry.name})).toBeInstanceOf(Blob); expect(await runtime.api.exportJobLogs({name: entry.name, direction: 'asc'})).toBeInstanceOf(Blob);
  const expression = '0 0 0 ? JAN MON#1 2099'; expect(await runtime.api.previewJobCron(expression, controller.signal)).toEqual({zone: 'UTC', times: []}); expect(new URL(String(fetcher.mock.calls.at(-1)![0]), 'https://local.test').searchParams.get('expression')).toBe(expression);
  expect(new URL(String(fetcher.mock.calls[1]![0]), 'https://local.test').searchParams.get('name')).toBe(entry.name); expect(new URL(String(fetcher.mock.calls[3]![0]), 'https://local.test').searchParams.get('from')).toBe('2026-10-01');
  expect(JSON.parse(String(fetcher.mock.calls[5]![1]?.body))).toEqual({ids: [id]}); expect(fetcher.mock.calls[6]![1]?.method).toBe('POST');
  for (const [, init] of fetcher.mock.calls) {expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('task context and scheduler-log faults retain the session while 401 expires it', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot)).mockResolvedValueOnce(json({code: 'JOB_NOT_FOUND'}, 404)).mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403)).mockResolvedValueOnce(json({}, 401));
  const runtime = createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})}), fetcher); await runtime.restore();
  await expect(runtime.api.getJob('1')).rejects.toMatchObject({status: 404}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.clearJobLogs()).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.listJobLogs({})).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out');
});