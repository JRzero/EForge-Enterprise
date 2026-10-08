import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {DepartmentRequest, DepartmentResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {departmentTree} from './tree';
import {captureDraft, useDiscardChanges, usePageDraft} from '../../app/useDraftProtection';
import {useRetainedRead} from '../../app/useRetainedRead';

const emptyFilters = {name: '', status: ''};
const blank: DepartmentRequest = {parentId: '', name: '', sort: 0, status: '0', leader: '', phone: '', email: ''};
type TreeRow = ReturnType<typeof departmentTree>[number];

export function DepartmentsPage() {
  const statusDictionary = useDictionary('sys_normal_disable');
  const api = useApi();
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState<DepartmentResponse[]>([]), [version, setVersion] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sorts, setSorts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [editor, setEditor] = useState<{id?: string; form: DepartmentRequest; initial: string; options: DepartmentResponse[]; search: string} | null>(null);
  const [deleting, setDeleting] = useState<DepartmentResponse | null>(null);
  const editorDirty = !!editor && editor.initial !== JSON.stringify(editor.form);
  const sortDirty = rows.some(row => sorts[row.id] !== undefined && sorts[row.id] !== row.sort);
  const pageDraft = usePageDraft(editorDirty || sortDirty), discard = useDiscardChanges(editorDirty, busy);
  const {setDirty: setDraftDirty} = pageDraft;
  const {confirm: confirmSortDiscard, dialog: sortDiscardDialog} = useDiscardChanges(sortDirty, busy);
  function closeEditor() {pageDraft.setDirty(sortDirty); setEditor(null); setActionError('');}
  const discardSorts = useCallback((action: () => void) => {
    confirmSortDiscard(() => {setDraftDirty(editorDirty); setSorts({}); action();});
  }, [confirmSortDiscard, setDraftDirty, editorDirty]);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (detailRequest.current?.signal.aborted) {detailRequest.current = null; setBusy(false);}
    return () => detailRequest.current?.abort();
  }, []);
  const read = useRetainedRead();
  useEffect(() => {
    const complete = read([api, filters, version]); if (!complete) return;
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]); setSorts({});
    api.listDepartments(filters, controller.signal).then(value => {
      if (!controller.signal.aborted) { setRows(value); setLoading(false); complete(); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false); complete(); } });
    return () => controller.abort();
  }, [api, filters, version, read]);
  const tree = useMemo(() => departmentTree(rows, collapsed), [rows, collapsed]);
  function refresh(message = '') { setFeedback(message); setSorts({}); setVersion(value => value + 1); }
  const loadEditor = useCallback(async (id?: string, parentId = '') => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError(''); setFeedback('');
    try {
      const [department, options] = await Promise.all([id ? api.getDepartment(id, controller.signal) : Promise.resolve(null), api.listDepartments(id ? {excludeId: id} : {}, controller.signal)]);
      if (!controller.signal.aborted) setEditor({id, options, search: '', ...captureDraft(department ? {parentId: department.parentId, name: department.name, sort: department.sort,
        status: department.status, leader: department.leader ?? '', phone: department.phone ?? '', email: department.email ?? ''}
        : {...blank, parentId})});
    } catch (cause) { if (!controller.signal.aborted) setActionError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) {detailRequest.current = null; setBusy(false);} }
  }, [api]);
  const openEditor = useCallback((id?: string, parentId = '') => {
    discardSorts(() => {void loadEditor(id, parentId);});
  }, [discardSorts, loadEditor]);
  const columns = useMemo<ColumnDef<TreeRow>[]>(() => [
    {id: 'name', header: '部门名称', cell: ({row}) => <div className="department-name" style={{paddingInlineStart: row.original.depth * 20}}>
      {row.original.hasChildren ? <button type="button" aria-expanded={!collapsed.has(row.original.department.id)} aria-label={`${collapsed.has(row.original.department.id) ? '展开' : '折叠'} ${row.original.department.name}`}
        onClick={() => setCollapsed(value => { const next = new Set(value); if (next.has(row.original.department.id)) next.delete(row.original.department.id); else next.add(row.original.department.id); return next; })}>{collapsed.has(row.original.department.id) ? '▸' : '▾'}</button> : <span className="department-leaf" />}
      <span>{row.original.department.name}</span></div>},
    {id: 'sort', header: '显示顺序', cell: ({row}) => <PermissionGate permission="system:dept:edit" fallback={<span>{row.original.department.sort}</span>}>
      <input type="number" min={0} max={2147483647} step={1} className="department-sort" aria-label={`排序 ${row.original.department.name}`} disabled={busy}
        value={sorts[row.original.department.id] ?? row.original.department.sort} onChange={event => setSorts(value => ({...value, [row.original.department.id]: Number(event.target.value)}))} /></PermissionGate>},
    {id: 'status', header: '状态', cell: ({row}) => <DictionaryTag options={statusDictionary.options} value={row.original.department.status} />},
    {id: 'createdAt', header: '创建时间', cell: ({row}) => row.original.department.createdAt ? new Date(row.original.department.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      <PermissionGate permission="system:dept:edit"><Button label="修改" aria-label={`修改部门 ${row.original.department.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openEditor(row.original.department.id); }} /></PermissionGate>
      <PermissionGate permission="system:dept:add"><Button label="新增" aria-label={`新增子部门 ${row.original.department.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openEditor(undefined, row.original.department.id); }} /></PermissionGate>
      {row.original.department.parentId !== '0' ? <PermissionGate permission="system:dept:remove"><Button label="删除" aria-label={`删除部门 ${row.original.department.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => discardSorts(() => { setActionError(''); setDeleting(row.original.department); })} /></PermissionGate> : null}
    </div>}
  ], [collapsed, sorts, busy, openEditor, discardSorts, statusDictionary.options]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || busy) return;
    const form = editor.form;
    if (!form.parentId || !form.name.trim() || form.name.length > 30 || !Number.isInteger(form.sort) || form.sort < 0 || form.sort > 2147483647 ||
      (form.leader?.length ?? 0) > 20 || (form.phone && !/^1[3-9][0-9]{9}$/.test(form.phone)) ||
      (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) || (form.email?.length ?? 0) > 50) {
      setActionError('请检查上级部门、部门名称、显示顺序和联系信息。'); return;
    }
    setBusy(true); setActionError(''); const finishSave = pageDraft.beginSave();
    try {
      if (editor.id) await api.updateDepartment(editor.id, form); else await api.createDepartment(form);
      closeEditor(); refresh(editor.id ? '部门已修改。' : '部门已新增。');
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { finishSave(); setBusy(false); }
  }
  async function saveSort() {
    const items = rows.filter(row => sorts[row.id] !== undefined && sorts[row.id] !== row.sort).map(row => ({id: row.id, sort: sorts[row.id] ?? row.sort}));
    if (!items.length || busy) return;
    if (items.some(item => !Number.isInteger(item.sort) || item.sort < 0 || item.sort > 2147483647)) { setActionError('显示顺序必须是有效的非负整数。'); return; }
    setBusy(true); setActionError(''); const finishSave = pageDraft.beginSave();
    try { await api.sortDepartments({items}); pageDraft.setDirty(false); refresh('部门排序已保存。'); }
    catch (cause) { setActionError(errorMessage(cause)); }
    finally { finishSave(); setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setActionError('');
    try { await api.deleteDepartment(deleting.id); setDeleting(null); refresh('部门已删除。'); }
    catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const options = useMemo(() => departmentTree(editor?.options ?? []), [editor?.options]);
  return <section className="posts-page departments-page">
    <PageHeader title="部门管理" description="维护组织层级、部门状态与显示顺序。" eyebrow="系统管理" /><DictionaryNotice dictionary={statusDictionary} />
    <form hidden={!showFilters} className="post-filters" onSubmit={event => { event.preventDefault(); discardSorts(() => {setFilters({...draft}); setVersion(value => value + 1);}); }}>
      <Input label="部门名称筛选" value={draft.name} onChange={name => setDraft({...draft, name})} />
      <label>部门状态筛选<select aria-label="部门状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option><DictionaryOptions options={statusDictionary.options} current={draft.status} /></select></label>
      <Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => discardSorts(() => { setDraft(emptyFilters); setFilters(emptyFilters); setVersion(value => value + 1); })} />
    </form>
    <div className="post-toolbar">
      <PermissionGate permission="system:dept:add"><Button label="新增部门" isDisabled={busy} onClick={() => { void openEditor(); }} /></PermissionGate>
      <PermissionGate permission="system:dept:edit"><Button label="保存部门排序" variant="secondary" isDisabled={busy || !rows.some(row => sorts[row.id] !== undefined && sorts[row.id] !== row.sort)} onClick={() => { void saveSort(); }} /></PermissionGate>
      <Button label={collapsed.size ? '展开全部' : '折叠全部'} variant="secondary" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(rows.map(row => row.id)))} />
      <Button label="刷新列表" variant="ghost" isDisabled={loading || busy} onClick={() => discardSorts(() => refresh())} />
      <Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} />
    </div>
    {feedback ? <p role="status">{feedback}</p> : null}
    {error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => discardSorts(() => refresh())} /></div> : null}
    {actionError && !editor && !deleting ? <p role="alert">{actionError}</p> : null}
    <div className="post-table"><DataTable data={tree} columns={columns} loading={loading} emptyText="暂无部门" pagination={false} sortable={false} showColumnVisibility={false} getRowId={row => row.department.id} /></div>
    {editor ? <ResourceDialog titleId="department-editor-title" busy={busy} onCancel={() => discard.confirm(closeEditor)}>
      <h2 id="department-editor-title">{editor.id ? '修改部门' : '新增部门'}</h2><form noValidate onSubmit={event => { void save(event); }}>
        {editor.form.parentId !== '0' ? <><Input label="查找上级部门" value={editor.search} isDisabled={busy} onChange={search => setEditor({...editor, search})} />
          <label>上级部门<select aria-label="上级部门" value={editor.form.parentId} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, parentId: event.target.value}})}>
          <option value="">请选择上级部门</option>
          {editor.form.parentId && !options.some(row => row.department.id === editor.form.parentId) ? <option value={editor.form.parentId}>当前上级部门</option> : null}
          {options.filter(row => row.path.toLocaleLowerCase().includes(editor.search.trim().toLocaleLowerCase()) || row.department.id === editor.form.parentId)
            .map(row => <option key={row.department.id} value={row.department.id}>{row.path}</option>)}
        </select></label></> : null}
        <Input label="部门名称" aria-required="true" value={editor.form.name} isDisabled={busy} onChange={name => setEditor({...editor, form: {...editor.form, name}})} />
        <label>部门显示顺序<input type="number" min={0} max={2147483647} step={1} required value={editor.form.sort} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, sort: Number(event.target.value)}})} /></label>
        <Input label="负责人" value={editor.form.leader ?? ''} isDisabled={busy} onChange={leader => setEditor({...editor, form: {...editor.form, leader}})} />
        <Input label="联系电话" value={editor.form.phone ?? ''} isDisabled={busy} onChange={phone => setEditor({...editor, form: {...editor.form, phone}})} />
        <Input label="邮箱" type="email" value={editor.form.email ?? ''} isDisabled={busy} onChange={email => setEditor({...editor, form: {...editor.form, email}})} />
        <label>部门状态<select aria-label="部门状态" value={editor.form.status} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, status: event.target.value}})}><DictionaryOptions options={statusDictionary.options} current={editor.form.status} /></select></label>
        {actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="保存部门" type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => discard.confirm(closeEditor)} /></div>
      </form></ResourceDialog> : null}
    {deleting ? <ResourceDialog titleId="department-delete-title" alert busy={busy} onCancel={() => { setDeleting(null); setActionError(''); }}><h2 id="department-delete-title">确认删除部门</h2>
      <p>将删除“{deleting.name}”。存在下级部门或用户时无法删除。</p>{actionError ? <p role="alert">{actionError}</p> : null}
      <div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => { void remove(); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => { setDeleting(null); setActionError(''); }} /></div>
    </ResourceDialog> : null}
    {discard.dialog}{sortDiscardDialog}
  </section>;
}
