import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const bootstrap = {user: {id: '2', username: 'reader', displayName: 'Reader'}, roles: [], permissions: [], navigation: []};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
it('generated output transport keeps exact IDs, typed source text, binary ZIP, abort and credentials boundary', async () => {
  const id = '9007199254740993', bytes = new Uint8Array([80, 75, 3, 4, 0, 255, 128]);
  const preview = {tableId: id, generationDate: '2026-10-06', files: [{template: 'vm/java/domain.java.vm', path: 'main/java/中文.java', content: '<script>source text</script>\n中文'}]};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json(preview))
    .mockResolvedValueOnce(new Response(bytes, {headers: {'Content-Type': 'application/zip'}}));
  const runtime = createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})}), fetcher); await runtime.restore();
  const abort = new AbortController(); expect(await runtime.api.previewGeneratorTable(id, abort.signal)).toEqual(preview);
  const archive = await runtime.api.downloadGeneratorTables([id, '9223372036854775807'], abort.signal);
  expect(archive).toBeInstanceOf(Blob); expect(new Uint8Array(await archive.arrayBuffer())).toEqual(bytes);
  expect(String(fetcher.mock.calls[1]![0])).toBe(`/api/v1/tool/generator/tables/${id}/preview`);
  expect(fetcher.mock.calls[2]![1]?.method).toBe('POST'); expect(JSON.parse(String(fetcher.mock.calls[2]![1]?.body))).toEqual({tableIds: [id, '9223372036854775807']});
  for (const [url, init] of fetcher.mock.calls) {expect(String(url)).not.toContain('token'); expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token'); expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');}
  abort.abort(); expect(fetcher.mock.calls[1]![1]?.signal?.aborted).toBe(true); expect(fetcher.mock.calls[2]![1]?.signal?.aborted).toBe(true);
});
it('canonical output failures preserve a valid session while real 401 expires it', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(bootstrap)).mockResolvedValueOnce(json({code: 'GENERATOR_TABLE_NOT_FOUND'}, 404))
    .mockResolvedValueOnce(json({code: 'GENERATOR_OUTPUT_COLLISION'}, 409)).mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
  const runtime = createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})}), fetcher); await runtime.restore();
  await expect(runtime.api.previewGeneratorTable('1')).rejects.toMatchObject({status: 404, code: 'GENERATOR_TABLE_NOT_FOUND'}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.downloadGeneratorTables(['1', '2'])).rejects.toMatchObject({status: 409, code: 'GENERATOR_OUTPUT_COLLISION'}); expect(runtime.getSnapshot().phase).toBe('authenticated');
  await expect(runtime.api.downloadGeneratorTables(['1'])).rejects.toMatchObject({status: 401}); expect(runtime.getSnapshot().phase).toBe('signed-out');
});