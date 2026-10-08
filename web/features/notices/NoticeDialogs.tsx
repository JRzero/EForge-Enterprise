import {ListFilters} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {useEffect, useState, type FormEvent} from 'react';
import {Button, Input} from '../../ui/controls';
import {DataTable, type ColumnDef} from '../../ui/data';
import type {NoticeReader, PageResponseNoticeReader} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';

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
    <ListFilters actions={<><Button label="搜索读者" type="submit" /><Button label="重置读者" variant="ghost" onClick={() => {setDraft(''); setSearch(''); setPage(1); setVersion(value => value + 1);}} /></>} onSubmit={apply}><Input label="读者账号或姓名" value={draft} onChange={setDraft} /></ListFilters>
    {error ? <><p role="alert">{error}</p><Button label="重试读者" onClick={() => setVersion(value => value + 1)} /></> : <div className="post-table"><DataTable columns={readerColumns} data={data?.items ?? []} getRowId={row => row.userId} loading={loading} emptyText="暂无已读用户" pagination={false} sortable={false} showColumnVisibility={false} /></div>}
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} onPage={setPage} onSize={setPageSize} unit="位读者" previousLabel="读者上一页" nextLabel="读者下一页" sizeLabel="读者每页条数" />
    <Button label="关闭读者" variant="ghost" onClick={onClose} />
  </ResourceDialog>;
}
