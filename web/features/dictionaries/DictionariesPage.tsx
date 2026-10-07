import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import type {AppRoutePageProps} from '@eforge/app';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import {useApi, useApplicationControls} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {errorMessage} from '../../integration/errors';
import type {DictionaryResponse, DictionaryEntryResponse, DictionaryTypeOption, DictionaryValueOption} from '../../generated/api';
import {DictionaryEditor, type DictionaryEditorState} from './DictionaryEditor';
import {DictionaryPreview} from './DictionaryPreview';

type Row = DictionaryResponse | DictionaryEntryResponse;
const initialFilters = {name: '', code: '', status: '', from: '', to: ''};
const rowName = (row: Row) => 'name' in row ? row.name : row.label;
export function DictionariesPage() {return <DictionaryWorkspace />;}
export function DictionaryEntriesPage({params}: AppRoutePageProps) {return <DictionaryWorkspace key={params.dictionaryId ?? ''} dictionaryId={params.dictionaryId ?? ''} />;}
function DictionaryWorkspace({dictionaryId}: {dictionaryId?: string}) {
  const api = useApi(), controls = useApplicationControls(), entryMode = dictionaryId !== undefined;
  const [draft, setDraft] = useState(initialFilters), [filters, setFilters] = useState(initialFilters), [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1), [pageSize, setSize] = useState(10), [version, setVersion] = useState(0), [metadataVersion, setMetadataVersion] = useState(0);
  const [data, setData] = useState<{items: Row[]; total: number} | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [types, setTypes] = useState<DictionaryTypeOption[]>([]), [statusOptions, setStatusOptions] = useState<DictionaryValueOption[]>([]), [metadataError, setMetadataError] = useState(''), [metadataLoading, setMetadataLoading] = useState(true);
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const [editor, setEditor] = useState<DictionaryEditorState | null>(null), [deleting, setDeleting] = useState<string[] | null>(null), [preview, setPreview] = useState<DictionaryTypeOption | null>(null);
  const action = useRef<AbortController | null>(null);
  useEffect(() => {
    // A hidden Activity aborts editor reads but retains the page's busy state.
    if (action.current?.signal.aborted) {action.current = null; setBusy(false);}
    return () => action.current?.abort();
  }, []);
  const selectedType = types.find(type => type.id === dictionaryId);
  useEffect(() => {
    const controller = new AbortController(); setMetadataError(''); setMetadataLoading(true);
    Promise.all([api.getDictionaryOptions(controller.signal), api.getDictionaryValues('sys_normal_disable', controller.signal)])
      .then(([options, values]) => {if (!controller.signal.aborted) {setTypes(options); setStatusOptions(values); setMetadataLoading(false);}})
      .catch(cause => {if (!controller.signal.aborted) {setMetadataError(errorMessage(cause)); setMetadataLoading(false);}});
    return () => controller.abort();
  }, [api, metadataVersion]);
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, entryMode, dictionaryId, filters, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setData(null); setLoading(true); setSelection({}); setError('');
    const request = entryMode ? api.listDictionaryEntries(dictionaryId!, {label: filters.name, status: filters.status, page, pageSize}, controller.signal)
      : api.listDictionaries({name: filters.name, code: filters.code, status: filters.status, $from: filters.from || undefined, to: filters.to || undefined, page, pageSize}, controller.signal);
    request.then(result => {if (!controller.signal.aborted) {const lastPage = Math.max(1, Math.ceil(result.total / pageSize)); if (page > lastPage) {setPage(lastPage); return;} setData(result); setLoading(false);complete();}}).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);complete();}});
    return () => controller.abort();
  }, [api, entryMode, dictionaryId, filters, page, pageSize, version,read]);
  const refresh = useCallback((message = '') => {setFeedback(message); setSelection({}); setVersion(value => value + 1);}, []);
  const saved = () => {refresh('字典已保存。'); setMetadataVersion(value => value + 1);};
  const edit = useCallback(async (id: string) => {
    action.current?.abort(); const controller = new AbortController(); action.current = controller; setBusy(true); setActionError(''); setFeedback('');
    try {
      if (entryMode) {const row = await api.getDictionaryEntry(id, controller.signal); if (!controller.signal.aborted) setEditor({kind: 'entry', id, form: {dictionaryId: row.dictionaryId, label: row.label, value: row.value, sort: row.sort, style: row.style, cssClass: row.cssClass ?? '', defaultEntry: row.defaultEntry, status: row.status, remark: row.remark ?? ''}});}
      else {const row = await api.getDictionary(id, controller.signal); if (!controller.signal.aborted) setEditor({kind: 'type', id, form: {name: row.name, code: row.code, status: row.status, remark: row.remark ?? ''}});}
    } catch (cause) {if (!controller.signal.aborted) setActionError(errorMessage(cause));} finally {if (!controller.signal.aborted) {if (action.current === controller) action.current = null; setBusy(false);}}
  }, [api, entryMode]);
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {id: 'id', header: entryMode ? '字典编码' : '字典编号', cell: ({row}) => row.original.id},
    {id: 'name', header: entryMode ? '字典标签' : '字典名称', cell: ({row}) => 'name' in row.original ? <button className="dictionary-link" onClick={() => controls.navigate(`/dict/data/${row.original.id}`)}>{row.original.name}</button> : <DictionaryTag options={[row.original]} value={[row.original.value]} />},
    ...(entryMode ? [
      {id: 'value', header: '字典键值', cell: ({row}) => 'value' in row.original ? row.original.value : ''},
      {id: 'sort', header: '字典排序', cell: ({row}) => 'sort' in row.original ? row.original.sort : ''},
      {id: 'default', header: '默认项', cell: ({row}) => 'defaultEntry' in row.original && row.original.defaultEntry ? '是' : '否'}
    ] as ColumnDef<Row>[] : [{id: 'code', header: '字典类型', cell: ({row}) => 'code' in row.original ? row.original.code : ''}] as ColumnDef<Row>[]),
    {id: 'status', header: '状态', cell: ({row}) => <DictionaryTag options={statusOptions} value={row.original.status} />},
    {id: 'remark', header: '备注', cell: ({row}) => row.original.remark ?? ''},
    {id: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      {!entryMode && 'code' in row.original ? <Button label="预览" aria-label={`预览字典 ${row.original.name}`} size="sm" variant="ghost" isDisabled={busy} onClick={() => {const rowType = row.original as DictionaryResponse; setPreview({id: rowType.id, name: rowType.name, code: rowType.code, status: rowType.status});}} /> : null}
      <PermissionGate permission="system:dict:edit"><Button label="修改" aria-label={`修改字典 ${rowName(row.original)}`} size="sm" variant="ghost" isDisabled={busy || metadataLoading || !!metadataError} onClick={() => {void edit(row.original.id);}} /></PermissionGate>
      <PermissionGate permission="system:dict:remove"><Button label="删除" aria-label={`删除字典 ${rowName(row.original)}`} size="sm" variant="ghost" isDisabled={busy} onClick={() => {setActionError(''); setDeleting([row.original.id]);}} /></PermissionGate>
    </div>}
  ], [entryMode, controls, statusOptions, busy, metadataLoading, metadataError, edit]);
  const selected = Object.keys(selection).filter(id => selection[id]);
  function add() {
    setActionError(''); setFeedback(''); setEditor(entryMode ? {kind: 'entry', form: {dictionaryId: dictionaryId!, label: '', value: '', sort: 0, style: 'DEFAULT', cssClass: '', defaultEntry: false, status: '0', remark: ''}}
      : {kind: 'type', form: {name: '', code: '', status: '0', remark: ''}});
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setActionError('');
    try {if (entryMode) await api.deleteDictionaryEntries(deleting); else await api.deleteDictionaries(deleting); setDeleting(null); refresh('字典已删除。'); setMetadataVersion(value => value + 1);}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function exportFile() {
    if (busy) return; setBusy(true); setActionError('');
    try {
      const file = entryMode ? await api.exportDictionaryEntries(dictionaryId!, {label: filters.name, status: filters.status}) : await api.exportDictionaries({name: filters.name, code: filters.code, status: filters.status, $from: filters.from || undefined, to: filters.to || undefined});
      const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = entryMode ? '字典数据.xlsx' : '字典类型.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function cacheRefresh() {
    if (busy) return; setBusy(true); setActionError('');
    try {await api.refreshDictionaryCache(); setFeedback('字典缓存已刷新。'); setMetadataVersion(value => value + 1);}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  function query(event: FormEvent) {event.preventDefault(); if (draft.from && draft.to && draft.from > draft.to) {setActionError('开始日期不能晚于结束日期。'); return;} setActionError(''); setFilters({...draft}); setPage(1); setVersion(value => value + 1);}
  const labels: Record<string, string> = entryMode ? {id: '字典编码', name: '字典标签', value: '字典键值', sort: '字典排序', default: '默认项', status: '状态', remark: '备注', createdAt: '创建时间'} : {id: '字典编号', name: '字典名称', code: '字典类型', status: '状态', remark: '备注', createdAt: '创建时间'};
  return <section className="posts-page dictionaries-page"><PageHeader title={entryMode ? '字典数据' : '字典管理'} description={entryMode ? `${selectedType?.name ?? '字典'} · ${selectedType?.code ?? ''}` : '维护字典类型、数据和显示标签。'} eyebrow="系统管理" />
    {entryMode ? <div className="post-toolbar"><label>选择字典<select aria-label="选择字典" value={dictionaryId} disabled={busy || metadataLoading} onChange={event => controls.navigate(`/dict/data/${event.target.value}`)}>{!selectedType ? <option value={dictionaryId}>当前字典</option> : null}{types.map(type => <option key={type.id} value={type.id}>{type.name}（{type.code}）</option>)}</select></label><Button label="关闭字典数据" variant="secondary" onClick={() => (controls.closePage ?? controls.navigate)('/dict')} /></div> : null}
    <form hidden={!showFilters} className="post-filters" onSubmit={query}><Input label={entryMode ? '字典标签筛选' : '字典名称筛选'} value={draft.name} onChange={name => setDraft({...draft, name})} />
      {!entryMode ? <><Input label="字典类型筛选" value={draft.code} onChange={code => setDraft({...draft, code})} /><label>开始日期<input type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})} /></label><label>结束日期<input type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})} /></label></> : null}
      <label>状态筛选<select aria-label="状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option>{statusOptions.map((option, index) => <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>)}</select></label>
      <Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => {setDraft(initialFilters); setFilters(initialFilters); setPage(1); refresh();}} /></form>
    <div className="post-toolbar"><PermissionGate permission="system:dict:add"><Button label={entryMode ? '新增字典数据' : '新增字典类型'} isDisabled={busy || metadataLoading || !!metadataError || entryMode && !selectedType} onClick={add} /></PermissionGate>
      <PermissionGate permission="system:dict:edit"><Button label="修改所选字典" variant="secondary" isDisabled={busy || metadataLoading || !!metadataError || selected.length !== 1} onClick={() => {void edit(selected[0]!);}} /></PermissionGate>
      <PermissionGate permission="system:dict:remove"><Button label="删除所选字典" variant="secondary" isDisabled={busy || !selected.length} onClick={() => {setActionError(''); setDeleting(selected);}} /></PermissionGate>
      <PermissionGate permission="system:dict:export"><Button label="导出字典" variant="secondary" isDisabled={busy} onClick={() => {void exportFile();}} /></PermissionGate>
      {!entryMode ? <PermissionGate permission="system:dict:remove"><Button label="刷新字典缓存" variant="secondary" isDisabled={busy} onClick={() => {void cacheRefresh();}} /></PermissionGate> : null}
      <Button label="刷新列表" variant="ghost" isDisabled={loading || busy} onClick={() => refresh()} /><Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} />
      <ColumnVisibilityMenu labels={labels} visibility={visibility} onChange={setVisibility} />
    </div>
    {metadataError ? <div role="alert"><p>字典选项加载失败：{metadataError}</p><Button label="重试字典选项" onClick={() => setMetadataVersion(value => value + 1)} /></div> : null}
    {feedback ? <p role="status">{feedback}</p> : null}{error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => refresh()} /></div> : null}{actionError && !deleting ? <p role="alert">{actionError}</p> : null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无字典记录" pagination={false} sortable={false} selectable showColumnVisibility={false} rowSelection={selection} onRowSelectionChange={setSelection} columnVisibility={visibility} getRowId={row => row.id} getRowSelectionLabel={row => `选择字典 ${rowName(row)}`} /></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setSize} />
    {editor ? <DictionaryEditor initial={editor} statusOptions={statusOptions} code={selectedType?.code} onClose={() => setEditor(null)} onSaved={saved} /> : null}
    {preview ? <DictionaryPreview type={preview} statusOptions={statusOptions} onClose={() => setPreview(null)} /> : null}
    {deleting ? <ResourceDialog titleId="dictionary-delete-title" alert busy={busy} onCancel={() => {setDeleting(null); setActionError('');}}><h2 id="dictionary-delete-title">确认删除字典</h2><p>将删除所选的 {deleting.length} 条记录。{!entryMode ? '包含数据的类型不能删除。' : ''}</p>{actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => {void remove();}} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => {setDeleting(null); setActionError('');}} /></div></ResourceDialog> : null}
  </section>;
}
