import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import type {AppRoutePageProps} from '@eforge/app';
import {DataTable, type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import {useApi, useApplicationControls} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import type {JobResponse, JobLogResponse, JobLogDetail} from '../../generated/api';
import {errorMessage} from '../../integration/errors';

type Row = JobResponse | JobLogResponse;
const empty = {name: '', group: '', target: '', status: '', from: '', to: ''};
const time = (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '—';
export function JobsPage() {return <JobsWorkspace />;}
export function JobLogsPage({params}: AppRoutePageProps) {return <JobsWorkspace key={params.jobId} jobId={params.jobId ?? '0'} />;}
function JobsWorkspace({jobId}: {jobId?: string}) {
  const api = useApi(), controls = useApplicationControls(), logs = jobId !== undefined;
  const groups = useDictionary('sys_job_group'), statuses = useDictionary(logs ? 'sys_common_status' : 'sys_job_status');
  const [draft, setDraft] = useState(empty), [filters, setFilters] = useState(empty), [showSearch, setShowSearch] = useState(true);
  const [ready, setReady] = useState(!logs || jobId === '0'), [contextError, setContextError] = useState(''), [contextVersion, setContextVersion] = useState(0);
  const [page, setPage] = useState(1), [size, setSize] = useState(10), [version, setVersion] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{id: logs ? 'createdAt' : 'id', desc: logs}]);
  const [data, setData] = useState<{items: Row[]; total: number} | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [detail, setDetail] = useState<string | null>(null), [confirmation, setConfirmation] = useState<{clear: boolean; ids: string[]} | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const action = useRef<AbortController | null>(null); useEffect(() => () => action.current?.abort(), []);
  useEffect(() => {
    if (!logs || jobId === '0') return;
    const controller = new AbortController(); setReady(false); setContextError('');
    api.getJob(jobId!, controller.signal).then(row => {if (!controller.signal.aborted) {const value = {...empty, name: row.name ?? '', group: row.group ?? ''}; setDraft(value); setFilters(value); setReady(true);}})
      .catch(cause => {if (!controller.signal.aborted) setContextError(errorMessage(cause));});
    return () => controller.abort();
  }, [api, jobId, logs, contextVersion]);
  const query = useMemo(() => ({name: filters.name, group: filters.group, invokeTarget: filters.target, status: filters.status ? Number(filters.status) : undefined,
    direction: sorting[0]?.desc ? 'desc' as const : 'asc' as const}), [filters, sorting]);
  const jobQuery = useMemo(() => ({...query, sort: sorting[0]?.id === 'name' ? 'name' as const : sorting[0]?.id === 'createdAt' ? 'createdAt' as const : 'id' as const}), [query, sorting]);
  const logQuery = useMemo(() => ({...query, $from: filters.from || undefined, to: filters.to || undefined}), [query, filters.from, filters.to]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController(); setData(null); setLoading(true); setError(''); setSelection({});
    const request = logs ? api.listJobLogs({...logQuery, page, pageSize: size}, controller.signal) : api.listJobs({...jobQuery, page, pageSize: size}, controller.signal);
    request.then(result => {if (!controller.signal.aborted) {const last = Math.max(1, Math.ceil(result.total / size)); if (page > last) {setPage(last); return;} setData(result); setLoading(false);}})
      .catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);}});
    return () => controller.abort();
  }, [api, ready, logs, logQuery, jobQuery, page, size, version]);
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {accessorKey: 'id', header: logs ? '日志编号' : '任务编号', enableSorting: !logs},
    {accessorKey: 'name', header: '任务名称', enableSorting: !logs},
    {id: 'group', header: '任务组名', enableSorting: false, cell: ({row}) => <DictionaryTag options={groups.options} value={row.original.group ?? ''} />},
    {accessorKey: 'invokeTarget', header: '调用目标字符串', enableSorting: false},
    logs ? {accessorKey: 'message', header: '日志信息', enableSorting: false} : {accessorKey: 'cronExpression', header: 'Cron表达式', enableSorting: false},
    {id: 'status', header: logs ? '执行状态' : '任务状态', enableSorting: false, cell: ({row}) => <DictionaryTag options={statuses.options} value={row.original.status ?? ''} />},
    {accessorKey: 'createdAt', header: logs ? '执行时间' : '创建时间', sortDescFirst: logs, cell: ({row}) => time(row.original.createdAt)},
    {id: 'actions', header: '操作', enableSorting: false, cell: ({row}) => <div className="post-row-actions"><PermissionGate permission="monitor:job:query"><Button label="详细" aria-label={`详细${logs ? '日志' : '任务'} ${row.original.id}`} size="sm" variant="ghost" onClick={() => setDetail(row.original.id)} />
      {!logs && <Button label="日志" aria-label={`任务日志 ${row.original.id}`} size="sm" variant="ghost" onClick={() => controls.navigate(`/job/log/${row.original.id}`)} />}</PermissionGate></div>}
  ], [logs, groups.options, statuses.options, controls]);
  const selected = Object.keys(selection).filter(id => selection[id]);
  function search(event: FormEvent) {event.preventDefault(); setActionError(''); if (draft.from && draft.to && draft.from > draft.to) {setActionError('开始日期不能晚于结束日期。'); return;} setFilters({...draft}); setPage(1); setVersion(value => value + 1);}
  function reset() {setDraft(empty); setFilters(empty); setPage(1); setSorting([{id: logs ? 'createdAt' : 'id', desc: logs}]); setActionError(''); setVersion(value => value + 1);}
  async function mutate() {
    if (!confirmation || busy) return;
    const controller = new AbortController(); action.current = controller; setBusy(true); setActionError('');
    try {if (confirmation.clear) await api.clearJobLogs(controller.signal); else await api.deleteJobLogs(confirmation.ids, controller.signal);
      if (!controller.signal.aborted) {if (confirmation.clear) setPage(1); setConfirmation(null); setFeedback(confirmation.clear ? '日志已清空。' : '日志已删除。'); setVersion(value => value + 1);}}
    catch (cause) {if (!controller.signal.aborted) setActionError(errorMessage(cause));} finally {if (!controller.signal.aborted) setBusy(false);}
  }
  async function download() {
    if (busy) return;
    const controller = new AbortController(); action.current = controller; setBusy(true); setActionError('');
    try {const file = logs ? await api.exportJobLogs(logQuery, controller.signal) : await api.exportJobs(jobQuery, controller.signal); if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = logs ? '任务调度日志.xlsx' : '定时任务.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
    catch (cause) {if (!controller.signal.aborted) setActionError(errorMessage(cause));} finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <section className="posts-page"><PageHeader title={logs ? '调度日志' : '定时任务'} eyebrow="系统监控" description={logs ? '查询任务执行结果和异常信息。' : '查看任务计划与执行记录。'} />
    <DictionaryNotice dictionary={groups} /><DictionaryNotice dictionary={statuses} />
    {contextError ? <><p role="alert">{contextError}</p><Button label="重试任务信息" onClick={() => setContextVersion(value => value + 1)} /></> : !ready ? <p role="status">正在加载任务信息…</p> : <>
    <form className="post-filters" hidden={!showSearch} onSubmit={search}><Input label="任务名称" value={draft.name} onChange={name => setDraft({...draft, name})} isDisabled={busy} />
      <label>任务组名<select aria-label="任务组名" value={draft.group} disabled={busy} onChange={event => setDraft({...draft, group: event.target.value})}><option value="">全部组名</option><DictionaryOptions options={groups.options} current={draft.group} /></select></label>
      <Input label="调用目标" value={draft.target} onChange={target => setDraft({...draft, target})} isDisabled={busy} />
      <label>{logs ? '执行状态' : '任务状态'}<select aria-label={logs ? '执行状态' : '任务状态'} value={draft.status} disabled={busy} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部状态</option><DictionaryOptions options={statuses.options} current={draft.status} /></select></label>
      {logs && <><label>开始日期<input type="date" aria-label="开始日期" value={draft.from} disabled={busy} onChange={event => setDraft({...draft, from: event.target.value})} /></label><label>结束日期<input type="date" aria-label="结束日期" value={draft.to} disabled={busy} onChange={event => setDraft({...draft, to: event.target.value})} /></label></>}
      <Button label="搜索" type="submit" isDisabled={busy} /><Button label="重置" variant="ghost" isDisabled={busy} onClick={reset} /></form>
    <div className="post-toolbar">{logs ? <PermissionGate permission="monitor:job:remove"><Button label="删除" isDisabled={busy || !selected.length} onClick={() => {setActionError(''); setConfirmation({clear: false, ids: selected});}} /><Button label="清空" variant="secondary" isDisabled={busy} onClick={() => {setActionError(''); setConfirmation({clear: true, ids: []});}} /></PermissionGate> : <Button label="全部调度日志" variant="secondary" onClick={() => controls.navigate('/job/log/0')} />}
      <PermissionGate permission="monitor:job:export"><Button label="导出" variant="ghost" isDisabled={busy || loading} onClick={() => {void download();}} /></PermissionGate>
      <Button label={showSearch ? '隐藏搜索' : '显示搜索'} variant="ghost" onClick={() => setShowSearch(value => !value)} /><Button label="刷新" variant="ghost" isDisabled={busy || loading} onClick={() => setVersion(value => value + 1)} />
      <details className="post-column-menu"><summary>列显示</summary>{columns.filter(column => column.id !== 'actions').map(column => {const id = 'accessorKey' in column ? String(column.accessorKey) : column.id ?? ''; return <label key={id}><input type="checkbox" checked={visibility[id] !== false} onChange={event => setVisibility({...visibility, [id]: event.target.checked})} />{String(column.header)}</label>;})}</details>
    </div>
    {feedback && <p role="status">{feedback}</p>}{actionError && !confirmation && <p role="alert">{actionError}</p>}
    {error ? <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></> : <div className="post-table"><DataTable columns={columns} data={data?.items ?? []} loading={loading} pagination={false} emptyText="暂无记录" getRowId={row => row.id} selectable={logs} rowSelection={selection} onRowSelectionChange={setSelection} getRowSelectionLabel={row => `选择日志 ${row.id}`} sortable manualSorting sorting={sorting} onSortingChange={updater => {setSorting(current => {const next = typeof updater === 'function' ? updater(current) : updater; return next.length ? [next[0]!] : [{id: logs ? 'createdAt' : 'id', desc: logs}];}); setPage(1);}} columnVisibility={visibility} showColumnVisibility={false} /></div>}
    <div className="post-pagination"><span>共 {data?.total ?? 0} 条，第 {page} 页</span><label>每页条数<select aria-label="每页条数" value={size} disabled={busy} onChange={event => {setSize(Number(event.target.value)); setPage(1);}}>{[10, 20, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label><Button label="上一页" variant="ghost" isDisabled={busy || loading || page === 1} onClick={() => setPage(value => value - 1)} /><Button label="下一页" variant="ghost" isDisabled={busy || loading || page * size >= (data?.total ?? 0)} onClick={() => setPage(value => value + 1)} /></div>
    </>}
    {logs && <Button label="关闭调度日志" variant="ghost" onClick={() => controls.navigate('/job')} />}
    {confirmation && <ResourceDialog titleId="job-log-confirm" alert busy={busy} onCancel={() => setConfirmation(null)}><h2 id="job-log-confirm">{confirmation.clear ? '确认清空调度日志' : '确认删除调度日志'}</h2><p>{confirmation.clear ? '将清空全部调度日志，此操作无法撤销。' : `将删除所选的 ${confirmation.ids.length} 条日志。`}</p>{actionError && <p role="alert">{actionError}</p>}<Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setConfirmation(null)} /><Button label={confirmation.clear ? '确认清空' : '确认删除'} isDisabled={busy} onClick={() => {void mutate();}} /></ResourceDialog>}
    {detail && <JobDetailDialog id={detail} logs={logs} onClose={() => setDetail(null)} />}
  </section>;
}
function JobDetailDialog({id, logs, onClose}: {id: string; logs: boolean; onClose: () => void}) {
  const api = useApi(), groups = useDictionary('sys_job_group'), statuses = useDictionary(logs ? 'sys_common_status' : 'sys_job_status');
  const [row, setRow] = useState<JobResponse | JobLogDetail | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {const controller = new AbortController(); setRow(null); setError('');
    (logs ? api.getJobLog(id, controller.signal) : api.getJob(id, controller.signal)).then(value => {if (!controller.signal.aborted) setRow(value);}).catch(cause => {if (!controller.signal.aborted) setError(errorMessage(cause));});
    return () => controller.abort();
  }, [api, id, logs, version]);
  const entry = row && ('entry' in row ? row.entry : row);
  return <ResourceDialog titleId="job-detail-title" busy={false} onCancel={onClose}><h2 id="job-detail-title">{logs ? '调度日志详细' : '任务详细'}</h2><DictionaryNotice dictionary={groups} /><DictionaryNotice dictionary={statuses} />
    {error ? <><p role="alert">{error}</p><Button label="重试详情" onClick={() => setVersion(value => value + 1)} /></> : !entry ? <p role="status">正在加载详情…</p> : <>
      <dl className="log-metadata"><dt>{logs ? '日志编号' : '任务编号'}</dt><dd>{entry.id}</dd><dt>任务名称</dt><dd>{entry.name}</dd><dt>任务组名</dt><dd><DictionaryTag options={groups.options} value={entry.group ?? ''} /></dd><dt>调用目标</dt><dd>{entry.invokeTarget}</dd><dt>状态</dt><dd><DictionaryTag options={statuses.options} value={entry.status ?? ''} /></dd><dt>{logs ? '执行时间' : '创建时间'}</dt><dd>{time(entry.createdAt)}</dd>
      {row && 'entry' in row ? <><dt>开始时间</dt><dd>{time(row.entry.startedAt)}</dd><dt>结束时间</dt><dd>{time(row.entry.endedAt)}</dd><dt>日志信息</dt><dd>{row.entry.message}</dd></> : row && <><dt>Cron表达式</dt><dd>{row.cronExpression}</dd><dt>下次执行</dt><dd>{time(row.nextExecutionAt)}</dd><dt>计划策略</dt><dd>{['默认', '立即触发执行', '触发一次执行', '不触发立即执行'][Number(row.misfirePolicy)] ?? row.misfirePolicy}</dd><dt>并发执行</dt><dd>{row.concurrent ? '允许' : '禁止'}</dd><dt>备注</dt><dd>{row.remark || '—'}</dd></>}
      </dl>{row && 'entry' in row && row.entry.status !== '0' && <section className="log-payload"><h3>异常信息</h3><pre tabIndex={0} aria-label="异常信息">{row.exceptionInfo || '（无数据）'}</pre></section>}
    </>}
    <Button label="关闭详情" variant="ghost" onClick={onClose} />
  </ResourceDialog>;
}