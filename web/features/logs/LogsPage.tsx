import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {LoginLogResponse, OperationLogResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {errorMessage} from '../../integration/errors';
import {OperationLogDetailDialog} from './OperationLogDetailDialog';

type Row = OperationLogResponse | LoginLogResponse;
type Kind = 'operations' | 'logins';
const emptyFilters = {ip: '', title: '', person: '', businessType: '', status: '', from: '', to: ''};
const formatTime = (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '—';
const noTypes: ReturnType<typeof useDictionary>['options'] = [];
export function OperationLogsPage() {const types = useDictionary('sys_oper_type'); return <LogsPage kind="operations" types={types} />;}
export function LoginLogsPage() {return <LogsPage kind="logins" />;}

function LogsPage({kind, types}: {kind: Kind; types?: ReturnType<typeof useDictionary>}) {
  const api = useApi(), operation = kind === 'operations', title = operation ? '操作日志' : '登录日志';
  const permission = operation ? 'monitor:operlog' : 'monitor:logininfor';
  const statuses = useDictionary('sys_common_status'), typeOptions = types?.options ?? noTypes;
  const timeField = operation ? 'operatedAt' : 'loggedInAt';
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters), [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{id: timeField, desc: true}]);
  const [data, setData] = useState<{items: Row[]; total: number} | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [detail, setDetail] = useState<string | null>(null), [confirmation, setConfirmation] = useState<{action: 'delete' | 'clear' | 'unlock'; ids: string[]; username?: string} | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const query = useMemo(() => ({ip: filters.ip, status: filters.status ? Number(filters.status) : undefined,
    $from: filters.from || undefined, to: filters.to || undefined, direction: sorting[0]?.desc ? 'desc' as const : 'asc' as const}), [filters, sorting]);
  const operationQuery = useMemo(() => ({...query, title: filters.title, operator: filters.person, businessType: filters.businessType ? Number(filters.businessType) : undefined,
    sort: sorting[0]?.id === 'operator' ? 'operator' as const : sorting[0]?.id === 'duration' ? 'duration' as const : 'time' as const}), [query, filters, sorting]);
  const loginQuery = useMemo(() => ({...query, username: filters.person, sort: sorting[0]?.id === 'username' ? 'username' as const : 'time' as const}), [query, filters, sorting]);
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, operation, operationQuery, loginQuery, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSelection({});
    const request = operation ? api.listOperationLogs({...operationQuery, page, pageSize}, controller.signal) : api.listLoginLogs({...loginQuery, page, pageSize}, controller.signal);
    request.then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(1, Math.ceil(result.total / pageSize)); if (page > last) {setPage(last); return;}
      setData(result); setLoading(false);complete();
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);complete();}});
    return () => controller.abort();
  }, [api, operation, operationQuery, loginQuery, page, pageSize, version,read]);
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const common: ColumnDef<Row>[] = [{accessorKey: 'id', header: operation ? '日志编号' : '访问编号', enableSorting: false}];
    if (operation) common.push({accessorKey: 'title', header: '系统模块', enableSorting: false},
      {accessorKey: 'businessType', header: '操作类型', enableSorting: false, cell: ({row}) => <DictionaryTag options={typeOptions} value={(row.original as OperationLogResponse).businessType?.toString() ?? ''} />},
      {accessorKey: 'operator', header: '操作人员', sortDescFirst: true});
    else common.push({accessorKey: 'username', header: '用户名称', sortDescFirst: true});
    common.push({accessorKey: 'ip', header: operation ? '操作地址' : '登录地址', enableSorting: false},
      {accessorKey: 'location', header: operation ? '操作地点' : '登录地点', enableSorting: false});
    if (!operation) common.push({accessorKey: 'browser', header: '浏览器', enableSorting: false}, {accessorKey: 'operatingSystem', header: '操作系统', enableSorting: false});
    common.push({accessorKey: 'status', header: operation ? '操作状态' : '登录状态', enableSorting: false, cell: ({row}) => <DictionaryTag options={statuses.options} value={row.original.status ?? ''} />});
    if (!operation) common.push({accessorKey: 'message', header: '操作信息', enableSorting: false, cell: ({row}) => <span title={(row.original as LoginLogResponse).message}>{(row.original as LoginLogResponse).message}</span>});
    common.push({accessorKey: timeField, header: operation ? '操作日期' : '登录日期', sortDescFirst: true, cell: ({row}) => formatTime(operation ? (row.original as OperationLogResponse).operatedAt : (row.original as LoginLogResponse).loggedInAt)});
    if (operation) common.push({accessorKey: 'duration', header: '消耗时间', sortDescFirst: true, cell: ({row}) => `${(row.original as OperationLogResponse).duration ?? 0}毫秒`},
      {id: 'actions', header: '操作', enableSorting: false, cell: ({row}) => <PermissionGate permission="monitor:operlog:query"><Button label="详细" aria-label={`详细日志 ${row.original.id}`} variant="ghost" size="sm" onClick={() => setDetail(row.original.id)} /></PermissionGate>});
    return common;
  }, [operation, timeField, statuses.options, typeOptions]);
  const selectedIds = Object.keys(selection).filter(id => selection[id]), selected = data?.items.find(row => row.id === selectedIds[0]);
  function apply(event: FormEvent) {
    event.preventDefault(); setActionError('');
    if (draft.from && draft.to && draft.from > draft.to) {setActionError('开始日期不能晚于结束日期。'); return;}
    setFilters(draft); setPage(1); setVersion(value => value + 1);
  }
  function reset() {setDraft(emptyFilters); setFilters(emptyFilters); setSorting([{id: timeField, desc: true}]); setPage(1); setActionError(''); setVersion(value => value + 1);}
  function confirm(action: 'delete' | 'clear' | 'unlock') {
    setActionError(''); setFeedback(''); setConfirmation({action, ids: selectedIds, username: selected && !operation ? (selected as LoginLogResponse).username : undefined});
  }
  async function perform() {
    if (!confirmation || busy) return; setBusy(true); setActionError('');
    try {
      if (confirmation.action === 'delete') {if (operation) await api.deleteOperationLogs(confirmation.ids); else await api.deleteLoginLogs(confirmation.ids);}
      else if (confirmation.action === 'clear') {if (operation) await api.clearOperationLogs(); else await api.clearLoginLogs(); setPage(1);}
      else await api.unlockLoginAccount(confirmation.username ?? '');
      setFeedback(confirmation.action === 'unlock' ? `账号 ${confirmation.username} 已解锁。` : confirmation.action === 'clear' ? '日志已清空。' : '所选日志已删除。');
      setConfirmation(null); setSelection({}); setVersion(value => value + 1);
    } catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function download() {
    setBusy(true); setActionError(''); setFeedback('');
    try {const file = operation ? await api.exportOperationLogs(operationQuery) : await api.exportLoginLogs(loginQuery), url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = `${title}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <section className="logs-page"><PageHeader title={title} description={operation ? '查看系统操作记录和执行详情。' : '查看登录记录并管理账号解锁。'} />
    <DictionaryNotice dictionary={statuses} />{types && <DictionaryNotice dictionary={types} />}
    {showFilters && <form className="post-filters" onSubmit={apply}><Input label={operation ? '操作地址' : '登录地址'} value={draft.ip} onChange={ip => setDraft({...draft, ip})} />
      {operation && <Input label="系统模块" value={draft.title} onChange={title => setDraft({...draft, title})} />}<Input label={operation ? '操作人员' : '用户名称'} value={draft.person} onChange={person => setDraft({...draft, person})} />
      {operation && <label>操作类型<select aria-label="操作类型" value={draft.businessType} onChange={event => setDraft({...draft, businessType: event.target.value})}><option value="">全部类型</option><DictionaryOptions options={typeOptions} current={draft.businessType} /></select></label>}
      <label>{operation ? '操作状态' : '登录状态'}<select aria-label={operation ? '操作状态' : '登录状态'} value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部状态</option><DictionaryOptions options={statuses.options} current={draft.status} /></select></label>
      <label>开始日期<input aria-label="开始日期" type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})} /></label><label>结束日期<input aria-label="结束日期" type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})} /></label>
      <Button label="搜索" type="submit" /><Button label="重置" variant="ghost" onClick={reset} /></form>}
    <div className="post-toolbar"><PermissionGate permission={`${permission}:remove`}><Button label="删除" variant="secondary" isDisabled={busy || !selectedIds.length} onClick={() => confirm('delete')} /><Button label="清空" variant="secondary" isDisabled={busy} onClick={() => confirm('clear')} /></PermissionGate>
      {!operation && <PermissionGate permission="monitor:logininfor:unlock"><Button label="解锁" isDisabled={busy || selectedIds.length !== 1 || !(selected as LoginLogResponse | undefined)?.username} onClick={() => confirm('unlock')} /></PermissionGate>}
      <PermissionGate permission={`${permission}:export`}><Button label="导出" variant="ghost" isDisabled={busy || loading} onClick={() => {void download();}} /></PermissionGate>
      <Button label={showFilters ? '隐藏搜索' : '显示搜索'} variant="ghost" onClick={() => setShowFilters(value => !value)} /><Button label="刷新" variant="ghost" isDisabled={loading} onClick={() => setVersion(value => value + 1)} />
      <ColumnVisibilityMenu labels={Object.fromEntries(columns.filter(column => column.id !== 'actions').map(column => ['accessorKey' in column ? String(column.accessorKey) : column.id ?? '', String(column.header)]))} visibility={visibility} onChange={setVisibility} title="列显示" className="post-column-menu" />
    </div>
    {feedback && <p role="status">{feedback}</p>}{actionError && !confirmation && <p role="alert">{actionError}</p>}
    {error ? <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></> : <div className="post-table"><DataTable columns={columns} data={data?.items ?? []} getRowId={row => row.id} getRowSelectionLabel={row => `选择日志 ${row.id}`} loading={loading} emptyText="暂无日志" pagination={false} sortable manualSorting sorting={sorting} onSortingChange={updater => {setSorting(current => {const next = typeof updater === 'function' ? updater(current) : updater; return next.length ? [next[0]!] : [{id: current[0]?.id ?? timeField, desc: true}];}); setPage(1);}} columnVisibility={visibility} onColumnVisibilityChange={setVisibility} showColumnVisibility={false} selectable rowSelection={selection} onRowSelectionChange={setSelection} /></div>}
    <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {confirmation && <ResourceDialog titleId="log-confirm-title" alert busy={busy} onCancel={() => setConfirmation(null)}><h2 id="log-confirm-title">{confirmation.action === 'unlock' ? '确认解锁' : confirmation.action === 'clear' ? '确认清空日志' : '确认删除日志'}</h2><p>{confirmation.action === 'unlock' ? `解锁账号 ${confirmation.username}？` : confirmation.action === 'clear' ? `清空全部${title}？此操作无法撤销。` : `删除所选 ${confirmation.ids.length} 条日志？`}</p>{actionError && <p role="alert">{actionError}</p>}<div className="post-row-actions"><Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setConfirmation(null)} /><Button label={confirmation.action === 'unlock' ? '确认解锁' : confirmation.action === 'clear' ? '确认清空' : '确认删除'} variant={confirmation.action === 'unlock' ? 'primary' : 'secondary'} isDisabled={busy} onClick={() => {void perform();}} /></div></ResourceDialog>}
    {detail && <OperationLogDetailDialog id={detail} onClose={() => setDetail(null)} />}
  </section>;
}
