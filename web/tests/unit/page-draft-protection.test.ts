// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, createElement, useSyncExternalStore, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createMemoryRouterAdapter, type AppRouterAdapter} from '@eforge/app';
import {ApplicationControlsContext} from '../../app/context';
import {PageWorkspace} from '../../app/components/PageWorkspace';
import type {NavigationItem} from '../../integration/navigation';

vi.mock('../../app/routes', async () => {
  const {createElement, useEffect, useState} = await import('react');
  const {useApplicationControls} = await import('../../app/context');
  function Editor() {
    const [dirty, setDirty] = useState(false);
    const {setPageDirty} = useApplicationControls();
    useEffect(() => {setPageDirty?.(dirty);}, [dirty, setPageDirty]);
    return createElement('section', null,
      createElement('p', {role: 'status'}, dirty ? '未保存草稿' : '没有未保存修改'),
      createElement('button', {onClick: () => setDirty(true)}, '修改草稿'),
      createElement('button', {onClick: () => setDirty(false)}, '保存草稿'));
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
beforeEach(async () => {
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
});
