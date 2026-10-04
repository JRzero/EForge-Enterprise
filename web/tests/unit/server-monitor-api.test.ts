import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const key = 'eforge.enterprise.session.v1';
const bootstrap = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('server diagnostics use the generated canonical endpoint, safe auth transport and caller cancellation', async () => {
  const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const sample = {sampledAt: '2026-10-05T00:00:00Z', cpu: {coreCount: 4}, memory: {totalGiB: 8}, jvm: {totalMiB: 512}, host: {name: '主机'}, disks: [{mount: '/', totalSize: '100 GB'}]};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json(sample));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect(await runtime.api.getServerMonitor(controller.signal)).toEqual(sample);
  const [url, init] = fetcher.mock.calls[1]!; expect(String(url)).toBe('/api/v1/monitor/server');
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');
  controller.abort(); expect(init?.signal?.aborted).toBe(true);
});
it('diagnostic faults support retry without losing authentication, while actual 401 expires it', async () => {
  const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({code: 'SERVER_MONITOR_UNAVAILABLE'}, 503))
    .mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.getServerMonitor()).rejects.toMatchObject({status: 503, code: 'SERVER_MONITOR_UNAVAILABLE'}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.getServerMonitor()).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.getServerMonitor()).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(key)).toBeNull();
});
