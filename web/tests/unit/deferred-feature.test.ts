// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {act, createElement, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {DeferredFeature} from '../../app/components/DeferredFeature';

let element: HTMLDivElement, root: Root;
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
const errorFallback = (retry: () => void) => createElement('button', {onClick: retry}, '重试加载');

it('keeps its surroundings usable after a rejected import and retries only when requested', async () => {
  let available = false;
  const load = vi.fn(async () => {
    if (!available) throw new Error('chunk transport details must stay private');
    return {default: () => createElement('p', null, '加载成功')};
  });
  await act(async () => root.render(createElement('main', null,
    createElement('a', {href: '/dashboard'}, '工作台'),
    createElement(DeferredFeature, {load, componentProps: {}, fallback: '加载中', errorFallback}))));
  expect(element.querySelector('a')?.textContent).toBe('工作台');
  expect(element.textContent).not.toContain('transport');
  expect(load).toHaveBeenCalledOnce();
  available = true;
  await act(async () => element.querySelector('button')!.click());
  expect(load).toHaveBeenCalledTimes(2);
  expect(element.textContent).toContain('加载成功');
});

it('updates loaded feature props without remounting its local state or requesting the module again', async () => {
  function Feature({owner}: {owner: string}) {
    const [draft, setDraft] = useState('');
    return createElement('button', {onClick: () => setDraft('未保存草稿')}, owner + draft);
  }
  const load = vi.fn(async () => ({default: Feature}));
  const render = (owner: string) => root.render(createElement(DeferredFeature<{owner: string}>, {
    load, componentProps: {owner}, fallback: '加载中', errorFallback
  }));
  await act(async () => render('原名称'));
  await act(async () => element.querySelector('button')!.click());
  await act(async () => render('刷新后名称'));
  expect(element.querySelector('button')?.textContent).toBe('刷新后名称未保存草稿');
  expect(load).toHaveBeenCalledOnce();
});
