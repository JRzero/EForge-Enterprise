// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, createElement, lazy, Suspense} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {PageErrorBoundary} from '../../app/components/PageErrorBoundary';

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function button(label: string) {
  const found = [...element.querySelectorAll('button')].find(item => item.textContent === label);
  expect(found).toBeTruthy();
  return found!;
}

describe('page failure isolation', () => {
  it('keeps the surrounding navigation, hides exception details and recovers after an explicit page retry', async () => {
    let failed = true;
    let revision = 0;
    function Page() {
      if (failed) throw new Error('internal database credential must not be shown');
      return createElement('p', null, '页面内容已恢复');
    }
    const reload = vi.fn();
    const retry = vi.fn(() => {failed = false; revision++; render();});
    function render() {
      root.render(createElement('main', null,
        createElement('nav', null, createElement('a', {href: '/dashboard'}, '工作台导航')),
        createElement(PageErrorBoundary, {key: revision, title: '用户管理', onRetry: retry, onReload: reload,
          children: createElement(Page)})));
    }
    await act(async () => render());
    expect(element.querySelector('nav')?.textContent).toBe('工作台导航');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('用户管理暂时无法打开');
    expect(element.textContent).not.toContain('credential');
    expect(retry).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await act(async () => button('重试此页面').click());
    expect(retry).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('页面内容已恢复');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('catches rejected lazy imports and reloads only after the user requests it', async () => {
    const load = vi.fn(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    const Page = lazy(load);
    const retry = vi.fn(), reload = vi.fn();
    await act(async () => root.render(createElement(PageErrorBoundary, {
      title: '用户管理', onRetry: retry, onReload: reload,
      children: createElement(Suspense, {fallback: '正在加载页面'}, createElement(Page))
    })));
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('重新加载应用');
    expect(load).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await act(async () => button('重新加载应用').click());
    expect(reload).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
  });
});
