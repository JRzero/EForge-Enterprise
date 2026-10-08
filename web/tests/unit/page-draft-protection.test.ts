// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Activity, act, createElement, useEffect, useMemo, useSyncExternalStore, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouterAdapter, type AppRouterAdapter} from '@eforge/app';
import {ApplicationControlsContext} from '../../app/context';
import {PageWorkspace, type PageUnloadGuard} from '../../app/components/PageWorkspace';
import type {NavigationItem} from '../../integration/navigation';
const writes = vi.hoisted(() => ({save: vi.fn<() => Promise<void>>() }));

vi.mock('../../app/routes', async () => {
  const {createElement, useState} = await import('react');
  const {usePageDraft} = await import('../../app/useDraftProtection');
  function Editor() {
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const draft = usePageDraft(dirty);
    async function save() {
      const finish = draft.beginSave(); setBusy(true); setError('');
      try {await writes.save(); draft.setDirty(false); setDirty(false);}
      catch {setError('保存失败，草稿保留');}
      finally {finish(); setBusy(false);}
    }
    return createElement('section', null,
      createElement('p', {role: 'status'}, dirty ? '未保存草稿' : '没有未保存修改'),
      createElement('p', {role: 'alert'}, error),
      createElement('button', {disabled: busy, onClick: () => setDirty(true)}, '修改草稿'),
      createElement('button', {disabled: busy, onClick: () => {void save();}}, '保存草稿'));
  }
  return {routes: [
    {id: 'dashboard', path: '/dashboard', title: '工作台', component: () => createElement('h1', null, '工作台')},
    {id: 'users', path: '/user', title: '用户管理', component: Editor},
    {id: 'posts', path: '/post', title: '岗位管理', component: () => createElement('h1', null, '岗位管理')}
  ]};
});
// Modal focus/escape is tested by the browser suite; these tests exercise workspace ownership and actions.
vi.mock('../../app/components/ResourceDialog', () => ({
  ResourceDialog: ({children}: {children: ReactNode}) => createElement('div', {role: 'alertdialog'}, children)
}));

const items: NavigationItem[] = [
  {key: 'home', label: '工作台', path: '/dashboard', href: '/dashboard', children: []},
  {key: 'users', label: '用户管理', path: '/user', href: '/user', cached: true, children: []},
  {key: 'posts', label: '岗位管理', path: '/post', href: '/post', children: []}
];
let element: HTMLDivElement, root: Root, router: AppRouterAdapter;
const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

function Workspace() {
  const href = useSyncExternalStore(router.subscribe, router.getCurrentHref);
  return createElement(ApplicationControlsContext.Provider, {
    value: {navigate: router.navigate, refresh: async () => {}},
    children: createElement(PageWorkspace, {href, items, permissions: [], router, fallback: '不可访问', ownerId: '1'})
  });
}
// Exercise the optional guard contract independently of the authenticated shell;
// browser regressions cover the real shell's lock/unlock and owner refresh wiring.
function LockableWorkspace({locked, owner}: {locked: boolean; owner: string}) {
  const href = useSyncExternalStore(router.subscribe, router.getCurrentHref);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Match the authenticated shell's owner-scoped guard lifetime.
  const guard = useMemo<PageUnloadGuard>(() => ({shouldBlock: () => false}), [owner]);
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => {if (guard.shouldBlock()) event.preventDefault();};
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [guard]);
  return createElement(ApplicationControlsContext.Provider, {
    value: {navigate: router.navigate, refresh: async () => {}},
    children: createElement(Activity, {mode: locked ? 'hidden' : 'visible', children:
      createElement(PageWorkspace, {key: owner, href, items, permissions: [], router, fallback: '不可访问', ownerId: owner, unloadGuard: guard})})
  });
}
async function renderLocked(locked: boolean, owner = '1') {
  await act(async () => root.render(createElement(LockableWorkspace, {locked, owner})));
}
beforeEach(async () => {
  writes.save.mockReset().mockResolvedValue();
  items[1]!.cached = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value() {}});
  window.localStorage.clear();
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  router = createMemoryRouterAdapter('/dashboard');
  await act(async () => root.render(createElement(Workspace)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  if (scrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
});
async function click(label: string) {
  const button = [...element.querySelectorAll('button')].find(item =>
    item.getAttribute('aria-label') === label || item.textContent === label);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function navigate(path: string) {await act(async () => router.navigate(path));}
function unloadBlocked() {
  const event = new Event('beforeunload', {cancelable: true});
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('retained page draft protection', () => {
  it('keeps hidden Activity drafts protected and requires an explicit discard before closing their tag', async () => {
    await navigate('/user');
    await click('修改草稿');
    await navigate('/post');
    expect(unloadBlocked()).toBe(true);
    await click('关闭标签 用户管理');
    expect(element.querySelector('[role="alertdialog"]')?.textContent).toContain('用户管理中有未保存的修改');
    await click('继续编辑');
    expect(router.getCurrentHref()).toBe('/user');
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('未保存草稿');
    await navigate('/post');
    await click('关闭标签 用户管理');
    await click('放弃修改并关闭');
    expect(element.querySelector('[data-page-path="/user"]')).toBeNull();
    expect(unloadBlocked()).toBe(false);
  });

  it('preserves a draft when refresh is cancelled and resets it only after confirming refresh', async () => {
    await navigate('/user');
    await click('修改草稿');
    await click('刷新当前页面');
    await click('继续编辑');
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('未保存草稿');
    await click('刷新当前页面');
    await click('放弃修改并刷新');
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('没有未保存修改');
    expect(unloadBlocked()).toBe(false);
    await click('关闭标签 用户管理');
    expect(element.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('clears the guard after saving, and close-all protects a dirty page rather than silently removing it', async () => {
    await navigate('/user');
    await click('修改草稿');
    expect(unloadBlocked()).toBe(true);
    await click('保存草稿');
    expect(unloadBlocked()).toBe(false);
    await click('修改草稿');
    await navigate('/post');
    await click('标签操作');
    await click('全部关闭');
    expect(element.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click('放弃修改并关闭');
    expect(router.getCurrentHref()).toBe('/dashboard');
    expect(element.querySelectorAll('[data-page-path]')).toHaveLength(1);
    expect(unloadBlocked()).toBe(false);
  });

  it('cancels an obsolete confirmation after history navigation without discarding the draft', async () => {
    await navigate('/user');
    await click('修改草稿');
    await navigate('/post');
    await click('关闭标签 用户管理');
    expect(element.querySelector('[role="alertdialog"]')).not.toBeNull();
    // The memory adapter emits the same location update used by browser popstate.
    await navigate('/dashboard');
    expect(element.querySelector('[role="alertdialog"]')).toBeNull();
    expect(unloadBlocked()).toBe(true);
    await navigate('/user');
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('未保存草稿');
  });

  it.each(['全部关闭', '关闭其他'])('blocks %s atomically while a hidden uncached page still awaits its write acknowledgement', async mode => {
    items[1]!.cached = false;
    let resolve!: () => void;
    writes.save.mockImplementation(() => new Promise<void>(done => {resolve = done;}));
    await navigate('/user');
    await click('修改草稿');
    await click('保存草稿');
    await navigate('/post');
    expect(unloadBlocked()).toBe(true);
    await click('标签操作'); await click(mode);
    expect(element.querySelector('[role="alertdialog"]')?.textContent).toContain('正在保存修改');
    const discard = [...element.querySelectorAll('button')].find(button => button.textContent === '放弃修改并关闭');
    expect(discard?.disabled).toBe(true);
    await act(async () => discard?.click());
    expect(element.querySelectorAll('[data-page-path]')).toHaveLength(3);
    expect(router.getCurrentHref()).toBe('/post');

    // Completion is delivered while Activity effects remain suspended.
    await act(async () => resolve());
    expect(unloadBlocked()).toBe(false);
    expect(writes.save).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[role="alertdialog"]')?.textContent).toContain('修改已保存');
    await click('继续关闭');
    expect(element.querySelector('[data-page-path="/user"]')).toBeNull();
  });

  it('preserves a failed hidden write and prevents refresh before its acknowledgement', async () => {
    let reject!: (reason: Error) => void;
    writes.save.mockImplementation(() => new Promise<void>((_, fail) => {reject = fail;}));
    await navigate('/user'); await click('修改草稿'); await click('保存草稿');
    await click('刷新当前页面');
    expect(element.querySelector('[role="alertdialog"]')?.textContent).toContain('正在保存修改');
    expect([...element.querySelectorAll('button')].find(button => button.textContent === '放弃修改并刷新')?.disabled).toBe(true);
    await click('继续编辑'); await navigate('/post');
    await act(async () => reject(new Error('unavailable')));
    expect(unloadBlocked()).toBe(true);
    await click('关闭标签 用户管理'); await click('继续编辑');
    expect(router.getCurrentHref()).toBe('/user');
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('保存失败，草稿保留');
    expect(writes.save).toHaveBeenCalledTimes(1);
  });

  it('keeps its owner guard bound across outer Activity cleanup and unlock', async () => {
    await renderLocked(false); await navigate('/user'); await click('修改草稿');
    await renderLocked(true); expect(unloadBlocked()).toBe(true);
    await renderLocked(false); expect(unloadBlocked()).toBe(true);
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('未保存草稿');
    await click('保存草稿'); expect(unloadBlocked()).toBe(false);
  });

  it('protects a clean pending write while locked and releases only after its acknowledgement', async () => {
    let resolve!: () => void;
    writes.save.mockImplementation(() => new Promise<void>(done => {resolve = done;}));
    await renderLocked(false); await navigate('/user'); await click('保存草稿');
    await renderLocked(true); expect(unloadBlocked()).toBe(true);
    await act(async () => resolve()); expect(unloadBlocked()).toBe(false);
    await renderLocked(false); expect(unloadBlocked()).toBe(false);
    expect(writes.save).toHaveBeenCalledTimes(1);
  });

  it('isolates the replacement owner from an old locked draft and a late failed write', async () => {
    let reject!: (reason: Error) => void;
    writes.save.mockImplementation(() => new Promise<void>((_, fail) => {reject = fail;}));
    await renderLocked(false); await navigate('/user'); await click('修改草稿'); await click('保存草稿');
    await renderLocked(true); expect(unloadBlocked()).toBe(true);
    await renderLocked(true, '2'); expect(unloadBlocked()).toBe(false);
    await act(async () => reject(new Error('old write failed'))); expect(unloadBlocked()).toBe(false);
    await renderLocked(false, '2'); expect(unloadBlocked()).toBe(false);
    expect(element.querySelector('[data-page-path="/user"]')?.textContent).toContain('没有未保存修改');
  });
});
