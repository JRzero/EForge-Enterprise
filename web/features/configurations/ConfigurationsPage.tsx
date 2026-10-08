import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {ConfigurationRequest, ConfigurationResponse, PageResponseConfigurationResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {captureDraft, useDiscardChanges, usePageDraft} from '../../app/useDraftProtection';
import {errorMessage} from '../../integration/errors';

const emptyForm: ConfigurationRequest = {name: '', key: '', value: '', builtin: true, remark: ''};
const emptyFilters = {name: '', key: '', builtin: '', from: '', to: ''};
const columnLabels = {id: '参数主键', name: '参数名称', key: '参数键名', value: '参数键值', builtin: '系统内置', remark: '备注', createdAt: '创建时间'};

export function ConfigurationsPage() {
  const api = useApi(), dictionary = useDictionary('sys_yes_no');
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(true), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResponseConfigurationResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [feedback, setFeedback] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [editor, setEditor] = useState<{id?: string; form: ConfigurationRequest; initial: string} | null>(null), [deleting, setDeleting] = useState<string[] | null>(null);
  const editorDirty = !!editor && editor.initial !== JSON.stringify(editor.form);
  const pageDraft = usePageDraft(editorDirty), discard = useDiscardChanges(editorDirty, busy);
  function closeEditor() {pageDraft.setDirty(false); setEditor(null); setActionError('');}
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (detailRequest.current?.signal.aborted) {detailRequest.current = null; setBusy(false);}
    return () => detailRequest.current?.abort();
  }, []);
  const query = useMemo(() => ({name: filters.name, key: filters.key, builtin: filters.builtin ? filters.builtin === 'Y' : undefined, $from: filters.from || undefined, to: filters.to || undefined}), [filters]);
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, query, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSelection({});
    api.listConfigurations({...query, page, pageSize}, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(1, Math.ceil(result.total / pageSize));
      if (page > last) {setPage(last); return;}
      setData(result); setLoading(false);complete();
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);complete();}});
    return () => controller.abort();
  }, [api, query, page, pageSize, version,read]);
  const edit = useCallback(async (id: string) => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError(''); setFeedback('');
    try {const row = await api.getConfiguration(id, controller.signal); if (!controller.signal.aborted) setEditor({id, ...captureDraft({name: row.name, key: row.key, value: row.value, builtin: row.builtin, remark: row.remark ?? ''})});}
    catch (cause) {if (!controller.signal.aborted) setActionError(errorMessage(cause));}
    finally {if (!controller.signal.aborted) {detailRequest.current = null; setBusy(false);}}
  }, [api]);
  const columns = useMemo<ColumnDef<ConfigurationResponse>[]>(() => [
    {accessorKey: 'id', header: '参数主键'},
    ...(['name', 'key', 'value', 'remark'] as const).map(key => ({accessorKey: key, header: columnLabels[key], cell: ({row}: {row: {original: ConfigurationResponse}}) => <span title={row.original[key] ?? ''}>{row.original[key] || '—'}</span>})),
    {accessorKey: 'builtin', header: '系统内置', cell: ({row}) => <DictionaryTag options={dictionary.options} value={row.original.builtin ? 'Y' : 'N'} />},
    {accessorKey: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      <PermissionGate permission="system:config:edit"><Button label="修改" aria-label={`修改 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {void edit(row.original.id);}} /></PermissionGate>
      <PermissionGate permission="system:config:remove"><Button label="删除" aria-label={`删除 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {setActionError(''); setDeleting([row.original.id]);}} /></PermissionGate>
    </div>}
  ], [dictionary.options, edit, busy]);
  function refresh(message = '') {setFeedback(message); setSelection({}); setVersion(value => value + 1);}
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {setActionError('开始日期不能晚于结束日期。'); return;}
    setActionError(''); setPage(1); setFilters({...draft}); setVersion(value => value + 1);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || busy) return;
    const form = editor.form;
    if (!form.name.trim() || form.name.length > 100 || !form.key.trim() || form.key.length > 100 || !form.value.trim() || form.value.length > 500 || (form.remark?.length ?? 0) > 500) {setActionError('请填写参数名称、键名和键值，并检查长度。'); return;}
    setBusy(true); setActionError(''); const finishSave = pageDraft.beginSave();
    try {if (editor.id) await api.updateConfiguration(editor.id, form); else await api.createConfiguration(form); closeEditor(); refresh(editor.id ? '参数已修改。' : '参数已新增。');}
    catch (cause) {setActionError(errorMessage(cause));} finally {finishSave(); setBusy(false);}
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setActionError('');
    try {await api.deleteConfigurations(deleting); setDeleting(null); refresh('参数已删除。');}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function exportFile() {
    setBusy(true); setActionError('');
    try {const file = await api.exportConfigurations(query), url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = '参数数据.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function refreshCache() {
    setBusy(true); setActionError(''); setFeedback('');
    try {await api.refreshConfigurationCache(); setFeedback('参数缓存已刷新。');}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  const selectedIds = Object.keys(selection).filter(id => selection[id]);
  return <section className="posts-page">
    <PageHeader title="参数配置" description="维护应用参数与系统内置设置。" eyebrow="系统管理" /><DictionaryNotice dictionary={dictionary} />
    <form hidden={!showFilters} className="post-filters" onSubmit={applyFilters}>
      <Input label="参数名称筛选" value={draft.name} onChange={name => setDraft({...draft, name})} />
      <Input label="参数键名筛选" value={draft.key} onChange={key => setDraft({...draft, key})} />
      <label>系统内置筛选<select aria-label="系统内置筛选" value={draft.builtin} onChange={event => setDraft({...draft, builtin: event.target.value})}><option value="">全部</option><DictionaryOptions options={dictionary.options} current={draft.builtin} /></select></label>
      <label>开始日期<input aria-label="开始日期" type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})} /></label>
      <label>结束日期<input aria-label="结束日期" type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})} /></label>
      <Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => {setActionError(''); setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); refresh();}} />
    </form>
    <div className="post-toolbar">
      <PermissionGate permission="system:config:add"><Button label="新增参数" variant="primary" isDisabled={busy} onClick={() => {setActionError(''); setFeedback(''); setEditor(captureDraft({...emptyForm}));}} /></PermissionGate>
      <PermissionGate permission="system:config:edit"><Button label="修改所选参数" variant="secondary" isDisabled={busy || selectedIds.length !== 1} onClick={() => {void edit(selectedIds[0]!);}} /></PermissionGate>
      <PermissionGate permission="system:config:remove"><Button label="删除所选参数" variant="secondary" isDisabled={busy || !selectedIds.length} onClick={() => {setActionError(''); setDeleting(selectedIds);}} /><Button label="刷新参数缓存" variant="secondary" isDisabled={busy} onClick={() => {void refreshCache();}} /></PermissionGate>
      <PermissionGate permission="system:config:export"><Button label="导出参数" variant="secondary" isDisabled={busy} onClick={() => {void exportFile();}} /></PermissionGate>
      <Button label="刷新列表" variant="ghost" isDisabled={loading} onClick={() => refresh()} /><Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} />
      <ColumnVisibilityMenu labels={columnLabels} visibility={visibility} onChange={setVisibility} />
    </div>
    {feedback ? <p role="status">{feedback}</p> : null}
    {error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => refresh()} /></div> : null}
    {actionError && !editor && !deleting ? <p role="alert">{actionError}</p> : null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无参数" pagination={false} sortable={false} selectable showColumnVisibility={false}
      rowSelection={selection} onRowSelectionChange={setSelection} columnVisibility={visibility} getRowId={row => row.id} getRowSelectionLabel={row => `选择参数 ${row.name}`} /></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {editor ? <ResourceDialog titleId="configuration-editor-title" busy={busy} onCancel={() => discard.confirm(closeEditor)}><h2 id="configuration-editor-title">{editor.id ? '修改参数' : '新增参数'}</h2>
      <form onSubmit={event => {void save(event);}}>
        <Input label="参数名称" value={editor.form.name} aria-required="true" isDisabled={busy} onChange={name => setEditor({...editor, form: {...editor.form, name}})} />
        <Input label="参数键名" value={editor.form.key} aria-required="true" isDisabled={busy} onChange={key => setEditor({...editor, form: {...editor.form, key}})} />
        <label>参数键值<textarea aria-label="参数键值" aria-required="true" maxLength={500} value={editor.form.value} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, value: event.target.value}})} /></label>
        <label>系统内置<select aria-label="系统内置" value={editor.form.builtin ? 'Y' : 'N'} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, builtin: event.target.value === 'Y'}})}><DictionaryOptions options={dictionary.options} current={editor.form.builtin ? 'Y' : 'N'} /></select></label>
        <label>备注<textarea aria-label="备注" value={editor.form.remark ?? ''} disabled={busy} maxLength={500} onChange={event => setEditor({...editor, form: {...editor.form, remark: event.target.value}})} /></label>
        {actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label={busy ? '正在保存…' : '保存参数'} type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => discard.confirm(closeEditor)} /></div>
      </form></ResourceDialog> : null}
    {deleting ? <ResourceDialog titleId="configuration-delete-title" alert busy={busy} onCancel={() => {setDeleting(null); setActionError('');}}><h2 id="configuration-delete-title">确认删除参数</h2><p>将删除所选的 {deleting.length} 个参数。系统内置参数不能删除。</p>
      {actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => {void remove();}} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => {setDeleting(null); setActionError('');}} /></div>
    </ResourceDialog> : null}
    {discard.dialog}
  </section>;
}
