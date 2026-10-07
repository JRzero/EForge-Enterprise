import {Pagination} from '../../app/components/Pagination';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {OnlineSessionResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {useRetainedRead} from '../../app/useRetainedRead';

export function OnlineSessionsPage() {
  const api = useApi();
  const [draft, setDraft] = useState({username: '', ip: ''}), [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [data, setData] = useState<{items: OnlineSessionResponse[]; total: number} | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState<OnlineSessionResponse | null>(null), [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const read = useRetainedRead();
  useEffect(() => {
    const complete = read([api, filters, page, pageSize, version]); if (!complete) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    api.listOnlineSessions({...filters, page, pageSize}, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(1, Math.ceil(result.total / pageSize));
      if (page > last) {setPage(last); return;}
      setData(result); setLoading(false); complete();
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false); complete();}});
    return () => controller.abort();
  }, [api, filters, page, pageSize, version, read]);
  const columns = useMemo<ColumnDef<OnlineSessionResponse>[]>(() => [
    {id: 'index', header: '序号', cell: ({row}) => (page - 1) * pageSize + row.index + 1},
    {accessorKey: 'id', header: '会话编号', cell: ({row}) => <span title={row.original.id}>{row.original.id}</span>},
    {accessorKey: 'username', header: '登录名称'}, {accessorKey: 'departmentName', header: '部门名称'},
    {accessorKey: 'ip', header: '主机'}, {accessorKey: 'location', header: '登录地点'},
    {accessorKey: 'browser', header: '浏览器'}, {accessorKey: 'operatingSystem', header: '操作系统'},
    {accessorKey: 'loggedInAt', header: '登录时间', cell: ({row}) => row.original.loggedInAt ? new Date(row.original.loggedInAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <PermissionGate permission="monitor:online:forceLogout"><Button label="强退" aria-label={`强退会话 ${row.original.id}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {setActionError(''); setFeedback(''); setSelected(row.original);}} /></PermissionGate>}
  ], [page, pageSize, busy]);
  function apply(event: FormEvent) {event.preventDefault(); setFilters(draft); setPage(1); setVersion(value => value + 1);}
  function reset() {const empty = {username: '', ip: ''}; setDraft(empty); setFilters(empty); setPage(1); setVersion(value => value + 1);}
  async function revoke() {
    if (!selected || busy) return; setBusy(true); setActionError('');
    try {await api.revokeOnlineSession(selected.id); setFeedback(`账号 ${selected.username} 的所选会话已强退。`); setSelected(null); setVersion(value => value + 1);}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <section className="online-sessions-page"><PageHeader title="在线用户" description="查看当前登录会话，按账号和登录地址精确查询。" />
    <form className="post-filters" onSubmit={apply}><Input label="登录地址" value={draft.ip} onChange={ip => setDraft({...draft, ip})} /><Input label="用户名称" value={draft.username} onChange={username => setDraft({...draft, username})} /><Button label="搜索" type="submit" /><Button label="重置" variant="ghost" onClick={reset} /></form>
    <div className="post-toolbar"><Button label="刷新" variant="ghost" isDisabled={loading || busy} onClick={() => setVersion(value => value + 1)} /></div>
    {feedback && <p role="status">{feedback}</p>}
    {error ? <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></> : <div className="post-table"><DataTable columns={columns} data={data?.items ?? []} getRowId={row => row.id} loading={loading} emptyText="暂无在线会话" pagination={false} showColumnVisibility={false} /></div>}
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {selected && <ResourceDialog titleId="online-confirm-title" alert busy={busy} onCancel={() => setSelected(null)}><h2 id="online-confirm-title">确认强退会话</h2><p>强退账号 {selected.username} 的此会话？</p><p>会话编号：{selected.id}</p>{actionError && <p role="alert">{actionError}</p>}<div className="post-row-actions"><Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setSelected(null)} /><Button label="确认强退" variant="secondary" isDisabled={busy} onClick={() => {void revoke();}} /></div></ResourceDialog>}
  </section>;
}
