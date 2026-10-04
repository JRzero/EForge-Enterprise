// Temporary RuoYi compatibility boundary. Canonical app code never reads AjaxResult.
import {ApiError, record} from './errors';
export interface CaptchaChallenge {enabled: boolean; uuid: string; image: string}
export async function getCaptcha(request: typeof fetch, signal?: AbortSignal): Promise<CaptchaChallenge> {
  const response = await request('/captchaImage', {signal, cache: 'no-store', credentials: 'omit'});
  const body = record(await response.json());
  if (body.code !== 200 || typeof body.captchaEnabled !== 'boolean') throw new ApiError(503, 'CAPTCHA_UNAVAILABLE');
  if (!body.captchaEnabled) return {enabled: false, uuid: '', image: ''};
  if (typeof body.uuid !== 'string' || !body.uuid || typeof body.img !== 'string' ||
      !/^[A-Za-z0-9+/=]+$/.test(body.img)) throw new ApiError(503, 'CAPTCHA_UNAVAILABLE');
  return {enabled: true, uuid: body.uuid, image: `data:image/jpeg;base64,${body.img}`};
}
export async function revokeSession(request: typeof fetch, signal?: AbortSignal): Promise<void> {
  const response = await request('/logout', {method: 'POST', signal, cache: 'no-store', credentials: 'omit'});
  const body = record(await response.json());
  if (body.code !== 200) throw new ApiError(503, 'LOGOUT_FAILED');
}
