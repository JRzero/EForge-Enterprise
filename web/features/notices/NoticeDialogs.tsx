import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import {DataTable, type ColumnDef} from '@eforge/data';
import type {NoticeReader, NoticeResponse, PageResponseNoticeReader} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {NoticeRichContent} from './NoticeRichContent';

export function NoticePreview({id, onClose, onLoaded, readError = ''}: {id: string; onClose: () => void; onLoaded?: (row: NoticeResponse) => void; readError?: string}) {
  const api = useApi(), loaded = useRef(onLoaded);
  const [row, setRow] = useState<NoticeResponse | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {loaded.current = onLoaded;});
  useEffect(() => {
    const controller = new AbortController(); setRow(null); setError('');
    api.getNotice(id, controller.signal).then(result => {if (!controller.signal.aborted) {setRow(result); loaded.current?.(result);}}).catch(cause => {if (!controller.signal.aborted) setError(errorMessage(cause));});
    return () => controller.abort();
  }, [api, id, version]);
  return <ResourceDialog titleId="notice-preview-title" busy={false} onCancel={onClose}>
    <h2 id="notice-preview-title">{row?.title ?? '公告详情'}</h2>
    {error ? <><p role="alert">{error}</p><Button label="重试详情" onClick={() => setVersion(value => value + 1)} /></> : !row ? <p role="status">正在加载公告…</p> : <>
      <p className="notice-meta">{row.type === '1' ? '通知' : '公告'} · {row.createdBy || '—'} · {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—'}</p>
      <NoticeRichContent html={row.content} />
    </>}
    {readError && <p role="alert">{readError}</p>}
    <div className="post-row-actions"><Button label="关闭详情" variant="ghost" onClick={onClose} /></div>
  </ResourceDialog>;
}

const readerColumns: ColumnDef<NoticeReader>[] = [
  {accessorKey: 'username', header: '账号'}, {accessorKey: 'displayName', header: '姓名'}, {accessorKey: 'departmentName', header: '部门'}, {accessorKey: 'phone', header: '手机号'},
  {accessorKey: 'readAt', header: '阅读时间', cell: ({row}) => row.original.readAt ? new Date(row.original.readAt).toLocaleString('zh-CN') : '—'},
];
export function NoticeReaders({id, onClose}: {id: string; onClose: () => void}) {
  const api = useApi();
  const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResponseNoticeReader | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    api.listNoticeReaders(id, {page, pageSize, search}, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(1, Math.ceil(result.total / pageSize)); if (page > last) {setPage(last); return;}
      setData(result); setLoading(false);
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);}});
    return () => controller.abort();
  }, [api, id, search, page, pageSize, version]);
  function apply(event: FormEvent) {event.preventDefault(); setSearch(draft); setPage(1); setVersion(value => value + 1);}
  return <ResourceDialog titleId="notice-readers-title" busy={false} onCancel={onClose}>
    <h2 id="notice-readers-title">已读用户</h2>
    <form className="post-filters" onSubmit={apply}><Input label="读者账号或姓名" value={draft} onChange={setDraft} /><Button label="搜索读者" type="submit" /><Button label="重置读者" variant="ghost" onClick={() => {setDraft(''); setSearch(''); setPage(1); setVersion(value => value + 1);}} /></form>
    {error ? <><p role="alert">{error}</p><Button label="重试读者" onClick={() => setVersion(value => value + 1)} /></> : <div className="post-table"><DataTable columns={readerColumns} data={data?.items ?? []} getRowId={row => row.userId} loading={loading} emptyText="暂无已读用户" pagination={false} sortable={false} showColumnVisibility={false} /></div>}
    <div className="post-pagination"><span>共 {data?.total ?? 0} 位读者，第 {page} 页</span><label>读者每页条数<select aria-label="读者每页条数" value={pageSize} onChange={event => {setPageSize(Number(event.target.value)); setPage(1);}}>{[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <Button label="读者上一页" variant="ghost" isDisabled={loading || page === 1} onClick={() => setPage(value => value - 1)} /><Button label="读者下一页" variant="ghost" isDisabled={loading || page * pageSize >= (data?.total ?? 0)} onClick={() => setPage(value => value + 1)} /></div>
    <Button label="关闭读者" variant="ghost" onClick={onClose} />
  </ResourceDialog>;
}
