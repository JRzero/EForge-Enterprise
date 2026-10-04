import {expect, it, vi} from 'vitest';
import {getCaptcha, revokeSession} from '../../integration/legacy-auth';
it('isolates legacy captcha wrappers and never returns their internal fields', async () => {
  const response = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({code: 200, captchaEnabled: false, msg: 'legacy'})));
  expect(await getCaptcha(response)).toEqual({enabled: false, uuid: '', image: ''});
});
it('rejects an invalid challenge or unsuccessful logout wrapper', async () => {
  await expect(getCaptcha(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(
    {code: 200, captchaEnabled: true, uuid: 'x', img: 'invalid:url'}))))).rejects.toThrow();
  await expect(revokeSession(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({code: 500}))))).rejects.toThrow();
});
