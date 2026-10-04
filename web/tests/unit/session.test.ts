import {afterEach, describe, expect, it, vi} from 'vitest';
import {createMemoryStorage} from '@eforge/core';
import {createSessionRuntime, browserSessionStorage} from '../../integration/session';
import type {BootstrapResponse} from '../../generated/api';
const key = 'eforge.enterprise.session.v1';
const snapshot: BootstrapResponse = {user: {id: '1', username: 'admin', displayName: '管理员'},
  roles: ['admin'], permissions: ['*:*:*'], navigation: []};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
afterEach(() => vi.unstubAllGlobals());
describe('session lifecycle and asynchronous boundaries', () => {
  it('refreshes the bootstrap without unmounting the authenticated workspace and discards results after logout', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken:'old'})});
    let complete!: (value: Response) => void;
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
      .mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const runtime = createSessionRuntime(storage,transport); await runtime.restore();
    const update = runtime.refresh(); expect(runtime.getSnapshot().phase).toBe('authenticated');
    runtime.forget(); complete(json({...snapshot,user:{...snapshot.user,displayName:'Changed'}})); await update;
    expect(runtime.getSnapshot().phase).toBe('signed-out'); expect(storage.getItem(key)).toBeNull();
  });
  it('restores token-only storage and clears it on an authenticated 401', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'old'})});
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
      .mockResolvedValueOnce(json({code: 'AUTHENTICATION_REQUIRED'}, 401));
    const runtime = createSessionRuntime(storage, transport);
    await runtime.restore(); expect(runtime.getSnapshot().phase).toBe('authenticated');
    expect(new Headers(transport.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer old');
    await runtime.restore(); expect(runtime.getSnapshot().phase).toBe('signed-out');
    expect(storage.getItem(key)).toBeNull();
  });
  it('preserves the token on network/server failures and supports retry', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'old'})});
    const runtime = createSessionRuntime(storage, vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(snapshot)));
    await runtime.restore(); expect(runtime.getSnapshot().phase).toBe('error');
    expect(storage.getItem(key)).not.toBeNull();
    await runtime.restore(); expect(runtime.getSnapshot().phase).toBe('authenticated');
  });
  it('never restores a stale response over a newer login', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'old'})});
    let resolveOld!: (value: Response) => void;
    const transport = vi.fn<typeof fetch>().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce(json({accessToken: 'new', tokenType: 'Bearer'}))
      .mockResolvedValueOnce(json({...snapshot, user: {...snapshot.user, username: 'new-user'}}));
    const runtime = createSessionRuntime(storage, transport);
    const old = runtime.restore(); runtime.forget();
    await runtime.login({username: 'new-user', password: 'password'});
    resolveOld(json(snapshot)); await old;
    expect(runtime.getSnapshot()).toMatchObject({phase: 'authenticated', bootstrap: {user: {username: 'new-user'}}});
    expect(JSON.parse(storage.getItem(key)!)).toEqual({accessToken: 'new'});
  });
  it('retains the session if server logout fails, and clears it after confirmed revocation', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'old'})});
    const runtime = createSessionRuntime(storage, vi.fn<typeof fetch>().mockResolvedValueOnce(json(snapshot))
      .mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({code: 200})));
    await runtime.restore(); await expect(runtime.logout()).rejects.toThrow();
    expect(runtime.getSnapshot().phase).toBe('authenticated');
    expect(storage.getItem(key)).not.toBeNull();
    await runtime.logout(); expect(runtime.getSnapshot().phase).toBe('signed-out');
    expect(storage.getItem(key)).toBeNull();
  });
  it('does not expire a newer login when an older authenticated request returns 401', async () => {
    const storage = createMemoryStorage({[key]: JSON.stringify({accessToken: 'old'})});
    let rejectOld!: (value: Response) => void;
    const transport = vi.fn<typeof fetch>().mockReturnValueOnce(new Promise(resolve => { rejectOld = resolve; }))
      .mockResolvedValueOnce(json({accessToken: 'new', tokenType: 'Bearer'})).mockResolvedValueOnce(json(snapshot));
    const runtime = createSessionRuntime(storage, transport);
    const old = runtime.restore(); runtime.forget(); await runtime.login({username: 'admin', password: 'password'});
    rejectOld(json({code: 'AUTHENTICATION_REQUIRED'}, 401)); await old;
    expect(runtime.getSnapshot().phase).toBe('authenticated');
    expect(JSON.parse(storage.getItem(key)!)).toEqual({accessToken: 'new'});
  });
  it('does not persist credentials on rejected login', async () => {
    const storage = createMemoryStorage();
    const runtime = createSessionRuntime(storage, vi.fn<typeof fetch>().mockResolvedValue(json({code: 'AUTHENTICATION_FAILED'}, 401)));
    await expect(runtime.login({username: 'admin', password: 'wrong'})).rejects.toThrow('账号或密码');
    expect(storage.getItem(key)).toBeNull();
  });
  it('sanitizes tab storage and tolerates unavailable browser storage', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', {sessionStorage: storage});
    storage.setItem(key, JSON.stringify({accessToken: 'token', permissions: ['*:*:*'], password: 'secret'}));
    expect(JSON.parse(browserSessionStorage().getItem(key)!)).toEqual({accessToken: 'token'});
    storage.setItem(key, JSON.stringify({accessToken: 'bad\r\ntoken'}));
    expect(browserSessionStorage().getItem(key)).toBeNull();
    vi.stubGlobal('window', {get sessionStorage() { throw new Error('blocked'); }});
    const fallback = browserSessionStorage(); fallback.setItem(key, 'value');
    expect(fallback.getItem(key)).toBe('value'); fallback.removeItem(key);
    expect(fallback.getItem(key)).toBeNull();
  });
});
