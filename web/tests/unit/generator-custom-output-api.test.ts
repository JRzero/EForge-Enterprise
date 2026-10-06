import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
import {GeneratorCustomOutputError} from '../../integration/generator-errors';
const bootstrap = {user: {id: '2', username: 'writer', displayName: 'Writer'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
const storage = () => createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})});
it('custom output uses the generated POST and preserves retained/unconfirmed Unicode file outcomes without retry', async () => {
  const result = {files: [{path: '模块/main/java/中文.java', state: 'CREATED'}]};
  const partial = {files: [...result.files, {path: '模块/main/java/第二.java', state: 'UNCONFIRMED'}, {path: '模块/main/java/第三.java', state: 'UNATTEMPTED'}]};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json(result))
    .mockResolvedValueOnce(json({code: 'GENERATOR_CUSTOM_OUTPUT_PARTIAL', output: partial, detail: 'private server message'}, 503));
  const runtime = createSessionRuntime(storage(), fetcher); await runtime.restore();
  const abort = new AbortController(); expect(await runtime.api.writeGeneratorCustomOutput('9007199254740993', abort.signal)).toEqual(result);
  const error = await runtime.api.writeGeneratorCustomOutput('9007199254740993', abort.signal).catch(cause => cause);
  expect(error).toBeInstanceOf(GeneratorCustomOutputError); expect(error.output).toEqual(partial); expect(error.message).not.toContain('private');
  expect(runtime.getSnapshot().phase).toBe('authenticated'); expect(fetcher).toHaveBeenCalledTimes(3);
  for (const [url, init] of fetcher.mock.calls.slice(1)) {
    expect(String(url)).toBe('/api/v1/tool/generator/tables/9007199254740993/custom-output');expect(init?.method).toBe('POST'); expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');expect(init?.credentials).toBe('omit');expect(init?.cache).toBe('no-store');
  }
  abort.abort();expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true);expect(fetcher.mock.calls[2]![1]?.signal?.aborted).toBe(true);
});
it('unrelated 503 and disabled 403 stay generic while actual 401 still invalidates the session', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap))
    .mockResolvedValueOnce(json({code: 'GENERATOR_SNAPSHOT_UNAVAILABLE', detail: 'private SQL'}, 503))
    .mockResolvedValueOnce(json({code: 'GENERATOR_CUSTOM_OUTPUT_DISABLED'}, 403)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(storage(), fetcher);await runtime.restore();
  const unavailable = await runtime.api.writeGeneratorCustomOutput('1').catch(cause => cause);
  expect(unavailable).not.toBeInstanceOf(GeneratorCustomOutputError);expect(unavailable).toMatchObject({status: 503, code: 'GENERATOR_SNAPSHOT_UNAVAILABLE'});expect(unavailable.message).not.toContain('private');
  await expect(runtime.api.writeGeneratorCustomOutput('1')).rejects.toMatchObject({status: 403, code: 'GENERATOR_CUSTOM_OUTPUT_DISABLED'});expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.writeGeneratorCustomOutput('1')).rejects.toMatchObject({status: 401});expect(runtime.getSnapshot().phase).toBe('signed-out');expect(fetcher).toHaveBeenCalledTimes(4);
});it.each([new TypeError('private network detail'), new DOMException('private cancelled detail', 'AbortError')])('lost/cancelled output response reports an unconfirmed result without repeat writes', async failure => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockRejectedValueOnce(failure);
  const runtime = createSessionRuntime(storage(), fetcher);await runtime.restore();
  const error = await runtime.api.writeGeneratorCustomOutput('1').catch(cause => cause);
  expect(error).toMatchObject({status: 0, code: 'GENERATOR_CUSTOM_OUTPUT_UNCONFIRMED'});expect(error.message).not.toContain('private');
  expect(runtime.getSnapshot().phase).toBe('authenticated');expect(fetcher).toHaveBeenCalledTimes(2);
});