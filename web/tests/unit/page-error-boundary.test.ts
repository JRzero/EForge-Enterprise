// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {PageErrorBoundary} from '../../app/components/PageErrorBoundary';
vi.mock('@eforge/ui', () => ({Button: ({label, onClick}: {label: string; onClick: () => void}) => createElement('button', {onClick}, label)}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('isolates the failing route, hides exception details, and a new page revision recovers without clearing siblings', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let failing = true, revision = 0;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Page() { if (failing) throw new Error('private-diagnostic-detail'); return createElement('p', null, '页面已恢复'); }
  const render = () => root.render(createElement('div', null,
    createElement('input', {defaultValue: '其他页面草稿'}),
    createElement(PageErrorBoundary, {key: revision, title: '用户管理', onRetry: () => { failing = false; revision++; render(); }, children: createElement(Page)})));
  try {
    await act(async () => render());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('用户管理暂时无法显示');
    expect(host.textContent).not.toContain('private-diagnostic-detail');
    const input = host.querySelector('input')!; input.value = '保留的修改';
    await act(async () => { host.querySelector('button')!.click(); });
    expect(host.textContent).toContain('页面已恢复');
    expect(host.querySelector('input')?.value).toBe('保留的修改');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
