import {bootstrap, login, type LoginRequestWrite, type UserSummary} from '../generated/api';
import type {AuthStore} from '@eforge/core';
import {ApiError, record} from './errors';
import {getCaptcha, revokeSession} from './legacy-auth';

export function createApi(auth: AuthStore<UserSummary>, fetcher: typeof fetch = fetch,
  onUnauthorized: (token: string) => void = () => {}) {
  function transport(authenticated: boolean): typeof fetch {
    return async (input, init) => {
      const token = authenticated ? auth.getState().session?.accessToken : undefined;
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const timeout = AbortSignal.timeout(15000);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      const response = await fetcher(input, {...init, headers, signal, cache: 'no-store', credentials: 'omit'});
      if (!response.ok) {
        const body = record(await response.clone().json().catch(() => ({})));
        if (response.status === 401 && token) onUnauthorized(token);
        throw new ApiError(response.status, typeof body.code === 'string' ? body.code : 'HTTP_ERROR');
      }
      return response;
    };
  }
  return {
    async login(request: LoginRequestWrite, signal?: AbortSignal) {
      const response = await login(request, {baseUrl: '', fetch: transport(false), signal});
      if (response.status !== 200 || !response.data.accessToken || response.data.tokenType !== 'Bearer') {
        throw new ApiError(503, 'INVALID_LOGIN_RESPONSE');
      }
      return response.data;
    },
    async bootstrap(signal?: AbortSignal) {
      const response = await bootstrap({baseUrl: '', fetch: transport(true), signal});
      const snapshot = response.data;
      if (!snapshot?.user?.id || !Array.isArray(snapshot.permissions) || !Array.isArray(snapshot.roles) ||
          !Array.isArray(snapshot.navigation) || snapshot.permissions.some(value => typeof value !== 'string')) {
        throw new ApiError(503, 'INVALID_BOOTSTRAP_RESPONSE');
      }
      return snapshot;
    },
    captcha: (signal?: AbortSignal) => getCaptcha(transport(false), signal),
    logout: (signal?: AbortSignal) => revokeSession(transport(true), signal)
  };
}
export type ApplicationApi = ReturnType<typeof createApi>;
