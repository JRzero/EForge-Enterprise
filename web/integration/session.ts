import {createAuthStore, createMemoryStorage, type StorageAdapter} from '@eforge/core';
import type {BootstrapResponse, LoginRequestWrite, UserSummary} from '../generated/api';
import {createApi, type ApplicationApi} from './api';
import {errorMessage} from './errors';

export type SessionSnapshot =
  | {phase: 'signed-out'}
  | {phase: 'restoring'}
  | {phase: 'error'; message: string}
  | {phase: 'authenticated'; bootstrap: BootstrapResponse};

export function browserSessionStorage(): StorageAdapter {
  const fallback = createMemoryStorage();
  // Persist only the token for this tab. Permissions/user data always come from bootstrap.
  return {
    getItem(key) {
      try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || !('accessToken' in value) ||
            typeof value.accessToken !== 'string' || !value.accessToken.trim() ||
            value.accessToken.length > 4096 || /[\r\n]/.test(value.accessToken)) {
          window.sessionStorage.removeItem(key); return null;
        }
        return JSON.stringify({accessToken: value.accessToken});
      } catch { return fallback.getItem(key); }
    },
    setItem(key, value) { try { window.sessionStorage.setItem(key, value); } catch { fallback.setItem(key, value); } },
    removeItem(key) { try { window.sessionStorage.removeItem(key); } catch { /* storage may be unavailable */ } fallback.removeItem(key); }
  };
}

export function createSessionRuntime(storage: StorageAdapter, fetcher: typeof fetch = fetch) {
  const auth = createAuthStore<UserSummary>({storage, storageKey: 'eforge.enterprise.session.v1'});
  let state: SessionSnapshot = auth.getState().isAuthenticated ? {phase: 'restoring'} : {phase: 'signed-out'};
  let generation = 0;
  let pending: AbortController | null = null;
  const listeners = new Set<() => void>();
  const emit = (next: SessionSnapshot) => { state = next; listeners.forEach(listener => listener()); };
  function forget() {
    generation++; pending?.abort(); auth.setSession(null); emit({phase: 'signed-out'});
  }
  const api: ApplicationApi = createApi(auth, fetcher, token => {
    if (auth.getState().session?.accessToken === token) forget();
  });
  function begin() {
    pending?.abort(); pending = new AbortController(); generation++;
    return {id: generation, signal: pending.signal};
  }
  async function restore() {
    if (!auth.getState().isAuthenticated) { emit({phase: 'signed-out'}); return; }
    const operation = begin(); emit({phase: 'restoring'});
    try {
      const snapshot = await api.bootstrap(operation.signal);
      if (operation.id === generation) emit({phase: 'authenticated', bootstrap: snapshot});
    } catch (error) {
      if (operation.id === generation) emit({phase: 'error', message: errorMessage(error)});
    }
  }
  return {
    api,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    restore, forget,
    async refresh() {
      if (state.phase !== 'authenticated') return;
      const operation = begin();
      const snapshot = await api.bootstrap(operation.signal);
      if (operation.id === generation) emit({phase: 'authenticated', bootstrap: snapshot});
    },
    async login(request: LoginRequestWrite) {
      const operation = begin();
      const response = await api.login(request, operation.signal);
      if (operation.id !== generation) return;
      auth.setSession({accessToken: response.accessToken});
      await restore();
    },
    async logout() {
      const operation = begin();
      await api.logout(operation.signal);
      if (operation.id === generation) forget();
    }
  };
}
export type SessionRuntime = ReturnType<typeof createSessionRuntime>;
