import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Button} from '../../ui/controls';
import type {NoticeResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {DeferredFeature} from '../../app/components/DeferredFeature';
import {errorMessage} from '../../integration/errors';

const loadRichContent = () => import('./NoticeRichContent').then(module => ({default: module.NoticeRichContent}));

export function NoticePreview({id, onClose, onLoaded, readError = ''}: {id: string; onClose: () => void; onLoaded?: (row: NoticeResponse) => void; readError?: string}) {
  const api = useApi(), loaded = useRef(onLoaded);
  const notified = useRef<NoticeResponse | null>(null);
  const [row, setRow] = useState<NoticeResponse | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useLayoutEffect(() => {loaded.current = onLoaded;});
  const contentReady = useCallback(() => {
    // A GET alone does not mean the lazy, sanitized body has been displayed.
    // Track this response, not a boolean: a replacement notice must acknowledge independently.
    if (row?.id === id && notified.current !== row) {
      notified.current = row;
      loaded.current?.(row);
    }
  }, [id, row]);
  useEffect(() => {
    const controller = new AbortController(); setRow(null); setError('');
    api.getNotice(id, controller.signal).then(result => {if (!controller.signal.aborted) setRow(result);}).catch(cause => {if (!controller.signal.aborted) setError(errorMessage(cause));});
    return () => controller.abort();
  }, [api, id, version]);
  return <ResourceDialog titleId="notice-preview-title" busy={false} onCancel={onClose}>
    <h2 id="notice-preview-title">{row?.title ?? '公告详情'}</h2>
    {error ? <><p role="alert">{error}</p><Button label="重试详情" onClick={() => setVersion(value => value + 1)} /></> : !row ? <p role="status">正在加载公告…</p> : <>
      <p className="notice-meta">{row.type === '1' ? '通知' : '公告'} · {row.createdBy || '—'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—'}</p>
      <DeferredFeature load={loadRichContent} componentProps={{html: row.content, onReady: contentReady}}
        fallback={<p role="status">正在加载公告正文…</p>}
        errorFallback={retry => <div role="alert"><p>公告正文暂时无法加载，请重试。</p><Button label="重试正文加载" onClick={retry} /></div>} />
    </>}
    {readError && <p role="alert">{readError}</p>}
    <div className="post-row-actions"><Button label="关闭详情" variant="ghost" onClick={onClose} /></div>
  </ResourceDialog>;
}
