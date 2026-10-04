import {useCallback, useEffect, useRef, useState} from 'react';
import {Button} from '@eforge/ui';
import type {NoticeFeed} from '../../generated/api';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {NoticePreview} from './NoticeDialogs';

export function HeaderNotices({version}: {version: number}) {
  const api = useApi(), root = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef<AbortController | null>(null);
  const [data, setData] = useState<NoticeFeed | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); alive.current = controller;
    return () => {controller.abort(); clearTimeout(timer.current);};
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.getNoticeFeed(controller.signal).then(result => {if (!controller.signal.aborted) {setData(result); setLoading(false);}}).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);}});
    return () => controller.abort();
  }, [api, version, reload]);
  useEffect(() => {
    function outside(event: PointerEvent) {if (event.target instanceof Node && !root.current?.contains(event.target)) setVisible(false);}
    document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const mark = useCallback(async (ids: string[]) => {
    const signal = alive.current?.signal; if (!ids.length || signal?.aborted) return;
    setBusy(true); setActionError('');
    try {
      await api.markNoticesRead(ids, signal);
      if (signal?.aborted) return;
      setData(current => {if (!current) return current; const items = current.items.map(item => ids.includes(item.id) ? {...item, read: true} : item); return {...current, items, unreadCount: items.filter(item => !item.read).length};});
      setReload(value => value + 1);
    } catch (cause) {if (!signal?.aborted) setActionError(errorMessage(cause));}
    finally {if (!signal?.aborted) setBusy(false);}
  }, [api]);
  function enter() {clearTimeout(timer.current); if (!preview) setVisible(true);}
  function leave() {clearTimeout(timer.current); timer.current = setTimeout(() => setVisible(false), 150);}
  return <div ref={root} className="header-notices" onMouseEnter={enter} onMouseLeave={leave} onKeyDown={event => {if (event.key === 'Escape') {setVisible(false); event.stopPropagation();}}}>
    <Button label={`通知公告（${data?.unreadCount ?? 0} 条未读）`} variant="ghost" size="sm" aria-expanded={visible} aria-controls="header-notice-list" onClick={() => {clearTimeout(timer.current); setVisible(true);}} />
    {visible && <section id="header-notice-list" className="notice-popover" aria-label="顶部公告列表" onMouseEnter={enter} onMouseLeave={leave}>
      <div className="notice-feed-toolbar"><h2>通知公告</h2><Button label="全部已读" variant="ghost" size="sm" isDisabled={loading || busy || !data?.unreadCount || !!error} onClick={() => {void mark(data?.items.filter(item => !item.read).map(item => item.id) ?? []);}} /></div>
      {loading ? <p role="status">正在加载公告…</p> : error ? <><p role="alert">{error}</p><Button label="重试公告" onClick={() => setReload(value => value + 1)} /></> : !data?.items.length ? <p>暂无公告</p> : <ul>{data.items.map(item => <li key={item.id} className={item.read ? 'notice-is-read' : ''}><button type="button" disabled={busy} aria-label={`阅读 ${item.title}（${item.read ? '已读' : '未读'}）`} onClick={() => {setActionError(''); setVisible(false); setPreview(item.id);}}><span>{item.type === '1' ? '通知' : '公告'}</span><strong>{item.title}</strong><time>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '—'}</time></button></li>)}</ul>}
      {actionError && <p role="alert">已读状态未保存：{actionError}<Button label="重试全部已读" variant="ghost" onClick={() => {void mark(data?.items.filter(item => !item.read).map(item => item.id) ?? []);}} /></p>}
      <Button label="刷新公告" variant="ghost" size="sm" isDisabled={loading || busy} onClick={() => {setActionError(''); setReload(value => value + 1);}} />
    </section>}
    {preview && <NoticePreview id={preview} onClose={() => setPreview(null)} onLoaded={() => {if (data?.items.some(item => item.id === preview && !item.read)) void mark([preview]);}} readError={actionError ? `已读状态未保存：${actionError}` : ''} />}
  </div>;
}
