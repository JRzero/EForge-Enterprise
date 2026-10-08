import {ListFilters, ListToolbar, ListPage} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '@eforge/data';
import {PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {PostRequest, PostResponse, PageResponsePostResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {ResourceDialog as PostDialog} from '../../app/components/ResourceDialog';
import {captureDraft, useDiscardChanges, usePageDraft} from '../../app/useDraftProtection';

const emptyForm: PostRequest = {code: '', name: '', sort: 0, status: '0', remark: ''};
const emptyFilters = {code: '', name: '', status: ''};
const columnLabels = {id: '岗位编号', code: '岗位编码', name: '岗位名称', sort: '显示顺序', status: '状态', createdAt: '创建时间'};

export function PostsPage() {
  const statusDictionary = useDictionary('sys_normal_disable');
  const api = useApi();
  const [draft, setDraft] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResponsePostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [editor, setEditor] = useState<{id?: string; form: PostRequest; initial: string} | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const editorDirty = !!editor && editor.initial !== JSON.stringify(editor.form);
  const pageDraft = usePageDraft(editorDirty), discard = useDiscardChanges(editorDirty, busy);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (detailRequest.current?.signal.aborted) {detailRequest.current = null; setBusy(false);}
    return () => detailRequest.current?.abort();
  }, []);
  function closeEditor() {pageDraft.setDirty(false); setEditor(null); setActionError('');}

  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, filters, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null); setSelection({});
    api.listPosts({...filters, page, pageSize}, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setLoading(false);complete(); }
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false);complete(); }
    });
    return () => controller.abort();
  }, [api, filters, page, pageSize, version,read]);

  const edit = useCallback(async (id: string) => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError(''); setFeedback('');
    try {
      const post = await api.getPost(id, controller.signal);
      if (!controller.signal.aborted) setEditor({id, ...captureDraft({code: post.code, name: post.name, sort: post.sort, status: post.status, remark: post.remark ?? ''})});
    } catch (cause) { if (!controller.signal.aborted) setActionError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) {detailRequest.current = null; setBusy(false);} }
  }, [api]);
  const columns = useMemo<ColumnDef<PostResponse>[]>(() => [
    {accessorKey: 'id', header: '岗位编号'}, {accessorKey: 'code', header: '岗位编码'},
    {accessorKey: 'name', header: '岗位名称'}, {accessorKey: 'sort', header: '显示顺序'},
    {accessorKey: 'status', header: '状态', cell: ({row}) => <DictionaryTag options={statusDictionary.options} value={row.original.status} />},
    {accessorKey: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      <PermissionGate permission="system:post:edit"><Button label="修改" aria-label={`修改 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void edit(row.original.id); }} /></PermissionGate>
      <PermissionGate permission="system:post:remove"><Button label="删除" aria-label={`删除 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { setActionError(''); setDeleting([row.original.id]); }} /></PermissionGate>
    </div>}
  ], [edit, busy, statusDictionary.options]);

  function refresh(message = '') {
    setFeedback(message); setSelection({}); setVersion(value => value + 1);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || busy) return;
    const form = editor.form;
    if (!form.code.trim() || form.code.length > 64 || !form.name.trim() || form.name.length > 50 ||
        !Number.isInteger(form.sort) || form.sort < 0 || form.sort > 2147483647 || (form.remark?.length ?? 0) > 500) {
      setActionError('请填写岗位编码和名称，检查长度与显示顺序。'); return;
    }
    setBusy(true); setActionError(''); const finishSave = pageDraft.beginSave();
    try {
      if (editor.id) await api.updatePost(editor.id, form); else await api.createPost(form);
      closeEditor(); refresh(editor.id ? '岗位已修改。' : '岗位已新增。');
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { finishSave(); setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setActionError('');
    try { await api.deletePosts(deleting); setDeleting(null); setPage(1); refresh('岗位已删除。'); }
    catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function exportFile() {
    setBusy(true); setActionError('');
    try {
      const file = await api.exportPosts(filters);
      const url = URL.createObjectURL(file); const link = document.createElement('a');
      link.href = url; link.download = '岗位数据.xlsx'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const selectedIds = Object.keys(selection).filter(id => selection[id]);
  return <ListPage className="posts-page" title="岗位管理" description="维护岗位信息与显示顺序。" eyebrow="系统管理">
    <DictionaryNotice dictionary={statusDictionary} />
    <ListFilters hidden={!showFilters} actions={<><Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); setVersion(value => value + 1); }} /></>} onSubmit={event => { event.preventDefault(); setPage(1); setFilters({...draft}); setVersion(value => value + 1); }}>
      <Input label="岗位编码筛选" value={draft.code} onChange={code => setDraft({...draft, code})} />
      <Input label="岗位名称筛选" value={draft.name} onChange={name => setDraft({...draft, name})} />
      <label>状态筛选<select aria-label="状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option><DictionaryOptions options={statusDictionary.options} current={draft.status} /></select></label>

    </ListFilters>
    <ListToolbar >
      <PermissionGate permission="system:post:add"><Button label="新增岗位" variant="primary" isDisabled={busy} onClick={() => { setActionError(''); setFeedback(''); setEditor(captureDraft({...emptyForm})); }} /></PermissionGate>
      <PermissionGate permission="system:post:remove"><Button label="删除所选岗位" variant="secondary" isDisabled={busy || !selectedIds.length} onClick={() => { setActionError(''); setDeleting(selectedIds); }} /></PermissionGate>
      <PermissionGate permission="system:post:export"><Button label="导出岗位" variant="secondary" isDisabled={busy} onClick={() => { void exportFile(); }} /></PermissionGate>
      <Button label="刷新列表" variant="ghost" isDisabled={loading} onClick={() => refresh()} />
      <Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} />
      <ColumnVisibilityMenu labels={columnLabels} visibility={visibility} onChange={setVisibility} />
    </ListToolbar>
    {feedback ? <p role="status">{feedback}</p> : null}
    {error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => refresh()} /></div> : null}
    {actionError && !editor && !deleting ? <p role="alert">{actionError}</p> : null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无岗位" pagination={false} sortable={false}
      selectable showColumnVisibility={false} rowSelection={selection} onRowSelectionChange={setSelection} columnVisibility={visibility} getRowId={row => row.id} getRowSelectionLabel={row => `选择岗位 ${row.name}`} /></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {editor ? <PostDialog titleId="post-editor-title" busy={busy} onCancel={() => discard.confirm(closeEditor)}><h2 id="post-editor-title">{editor.id ? '修改岗位' : '新增岗位'}</h2>
      <form onSubmit={event => { void save(event); }}>
        <Input label="岗位编码" value={editor.form.code} aria-required="true" isDisabled={busy} onChange={code => setEditor({...editor, form: {...editor.form, code}})} />
        <Input label="岗位名称" value={editor.form.name} aria-required="true" isDisabled={busy} onChange={name => setEditor({...editor, form: {...editor.form, name}})} />
        <label>显示顺序<input type="number" min={0} max={2147483647} step={1} value={editor.form.sort} required disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, sort: Number(event.target.value)}})} /></label>
        <label>岗位状态<select aria-label="岗位状态" value={editor.form.status} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, status: event.target.value}})}><DictionaryOptions options={statusDictionary.options} current={editor.form.status} /></select></label>
        <label>备注<textarea aria-label="备注" value={editor.form.remark ?? ''} disabled={busy} maxLength={500} onChange={event => setEditor({...editor, form: {...editor.form, remark: event.target.value}})} /></label>
        {actionError ? <p role="alert">{actionError}</p> : null}
        <div className="post-row-actions"><Button label={busy ? '正在保存…' : '保存岗位'} type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => discard.confirm(closeEditor)} /></div>
      </form></PostDialog> : null}
    {deleting ? <PostDialog titleId="post-delete-title" alert busy={busy} onCancel={() => { setDeleting(null); setActionError(''); }}><h2 id="post-delete-title">确认删除岗位</h2><p>将删除所选的 {deleting.length} 个岗位。已分配给用户的岗位无法删除。</p>
      {actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => { void remove(); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => { setDeleting(null); setActionError(''); }} /></div>
    </PostDialog> : null}
    {discard.dialog}
  </ListPage>;
}
