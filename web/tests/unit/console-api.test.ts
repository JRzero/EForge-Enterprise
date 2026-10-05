import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const storageKey = 'eforge.enterprise.session.v1';
const bootstrap = {user: {id: '7', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated console status reads abort and only fixed console openings accept same-origin cookies', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({enabled: false}))
    .mockResolvedValueOnce(json({enabled: true})).mockResolvedValueOnce(json({entryPath: '/druid/login.html', expiresInSeconds: 300}))
    .mockResolvedValueOnce(json({entryPath: '/swagger-ui/index.html', expiresInSeconds: 300})).mockResolvedValueOnce(json([]));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore(); const controller = new AbortController();
  expect(await runtime.api.getDruidConsoleStatus(controller.signal)).toEqual({enabled: false}); expect(await runtime.api.getApiDocsConsoleStatus()).toEqual({enabled: true});
  expect(await runtime.api.openDruidConsole()).toEqual({entryPath: '/druid/login.html', expiresInSeconds: 300}); await runtime.api.openApiDocsConsole(); await runtime.api.listCacheNames();
  expect(fetcher.mock.calls.slice(1).map(([url]) => url)).toEqual(['/api/v1/monitor/consoles/druid', '/api/v1/monitor/consoles/api-docs', '/api/v1/monitor/consoles/druid/session', '/api/v1/monitor/consoles/api-docs/session', '/api/v1/monitor/cache/names']);
  for (const [index, [, init]] of fetcher.mock.calls.entries()) {
    expect(init?.credentials).toBe(index === 3 || index === 4 ? 'same-origin' : 'omit'); expect(init?.cache).toBe('no-store'); expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
  }
  expect(fetcher.mock.calls[3]![1]?.method).toBe('POST'); expect(fetcher.mock.calls[4]![1]?.method).toBe('POST'); controller.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);
});
it('disabled/fault/revoked console access preserves app authentication while real 401 clears it', async () => {
  const storage = createMemoryStorage({[storageKey]: JSON.stringify({accessToken: 'token'})});
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({code: 'CONSOLE_DISABLED'}, 404))
    .mockResolvedValueOnce(json({code: 'CONSOLE_UNAVAILABLE'}, 503)).mockResolvedValueOnce(json({code: 'ACCESS_DENIED'}, 403)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage, fetcher); await runtime.restore();
  await expect(runtime.api.openDruidConsole()).rejects.toMatchObject({status: 404, code: 'CONSOLE_DISABLED'});
  await expect(runtime.api.openDruidConsole()).rejects.toMatchObject({status: 503, code: 'CONSOLE_UNAVAILABLE'});
  await expect(runtime.api.openApiDocsConsole()).rejects.toMatchObject({status: 403}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.getApiDocsConsoleStatus()).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(storageKey)).toBeNull();
});
