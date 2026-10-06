import {expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime} from '../../integration/session';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
it('generated business transport forbids external or normalized non-business targets before attaching credentials', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({items: [], total: 0}));
  const runtime = createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'private-token'})}), fetcher);
  for (const target of ['https://external.invalid/api/v1/business/test/entry', '//external.invalid/api/v1/business/test/entry', '/api/v1/business/../system/users']) {
    await expect(runtime.api.authenticatedFetch(target)).rejects.toMatchObject({code: 'GENERATED_API_TARGET_INVALID'});
  }
  expect(fetcher).not.toHaveBeenCalled();
  const controller = new AbortController();
  await runtime.api.authenticatedFetch('/api/v1/business/test/entry', {signal: controller.signal});
  const [url, init] = fetcher.mock.calls[0]!;
  expect(String(url)).not.toContain('private-token');
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer private-token');
  expect(init?.cache).toBe('no-store'); expect(init?.credentials).toBe('omit');
  controller.abort(); expect(init?.signal?.aborted).toBe(true);
});
it('original upload compatibility returns only a validated profile resource, without exposing legacy private failure text', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({code: 200, fileName: '/profile/upload/owned.png'}))
    .mockResolvedValueOnce(json({code: 500, msg: 'private filesystem details'}))
    .mockResolvedValueOnce(json({code: 200, fileName: '/profile/upload/../private.txt'}));
  const runtime = createSessionRuntime(createMemoryStorage({'eforge.enterprise.session.v1': JSON.stringify({accessToken: 'token'})}), fetcher);
  const file = new File(['owned'], 'owned.png', {type: 'image/png'});
  expect(await runtime.api.uploadGeneratedFile(file)).toBe('/profile/upload/owned.png');
  await expect(runtime.api.uploadGeneratedFile(file)).rejects.toMatchObject({code: 'UPLOAD_FAILED'});
  await expect(runtime.api.uploadGeneratedFile(file)).rejects.toMatchObject({code: 'UPLOAD_FAILED'});
  expect(fetcher.mock.calls[0]![1]?.body).toBeInstanceOf(FormData);
});