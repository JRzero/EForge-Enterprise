import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {NoticeRequest, NoticeResponse, PageResponseNoticeResponse} from '../../generated/api';
import {useApi, useNoticeRefresh} from '../../app/context';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {RichTextEditor} from './RichTextEditor';
import {sanitizeNoticeHtml} from './rich-text';
import {NoticeReaders} from './NoticeDialogs';
import {NoticePreview} from './NoticePreview';

const emptyForm: NoticeRequest = {title: '', type: '', content: '', status: '0', remark: ''};
const emptyFilters = {title: '', author: '', type: ''};
const labels = {id: '序号', title: '公告标题', type: '公告类型', status: '状态', createdBy: '创建者', createdAt: '创建时间'};

export function NoticesPage() {
  const api = useApi(), invalidateFeed = useNoticeRefresh(), types = useDictionary('sys_notice_type'), statuses = useDictionary('sys_notice_status');
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters), [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResponseNoticeResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [feedback, setFeedback] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false), [imageUploads, setImageUploads] = useState(0);
  const imageBusy = imageUploads > 0;
  const imageBusyChanged = useCallback((uploading: boolean) => setImageUploads(count => Math.max(0, count + (uploading ? 1 : -1))), []);
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [editor, setEditor] = useState<{id?: string; form: NoticeRequest} | null>(null), [deleting, setDeleting] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null), [readers, setReaders] = useState<string | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const query = useMemo(() => ({title: filters.title, author: filters.author, $type: filters.type || undefined}), [filters]);
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, query, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSelection({});
    api.listNotices({...query, page, pageSize}, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(1, Math.ceil(result.total / pageSize)); if (page > last) {setPage(last); return;}
      setData(result); setLoading(false);complete();
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);complete();}});
    return () => controller.abort();
  }, [api, query, page, pageSize, version,read]);
  const edit = useCallback(async (id: string) => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError(''); setFeedback('');
    try {const row = await api.getNotice(id, controller.signal); if (!controller.signal.aborted) setEditor({id, form: {title: row.title, type: row.type, content: row.content, status: row.status, remark: row.remark ?? ''}});}
    catch (cause) {if (!controller.signal.aborted) setActionError(errorMessage(cause));}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }, [api]);
  const columns = useMemo<ColumnDef<NoticeResponse>[]>(() => [
    {accessorKey: 'id', header: labels.id}, {accessorKey: 'title', header: labels.title, cell: ({row}) => <span title={row.original.title}>{row.original.title}</span>},
    {accessorKey: 'type', header: labels.type, cell: ({row}) => <DictionaryTag options={types.options} value={row.original.type} />},
    {accessorKey: 'status', header: labels.status, cell: ({row}) => <DictionaryTag options={statuses.options} value={row.original.status} />},
    {accessorKey: 'createdBy', header: labels.createdBy}, {accessorKey: 'createdAt', header: labels.createdAt, cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      <Button label="预览" aria-label={`预览 ${row.original.title}`} variant="ghost" size="sm" onClick={() => setPreview(row.original.id)} />
      <Button label="已读用户" aria-label={`已读用户 ${row.original.title}`} variant="ghost" size="sm" onClick={() => setReaders(row.original.id)} />
      <PermissionGate permission="system:notice:edit"><Button label="修改" aria-label={`修改 ${row.original.title}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {void edit(row.original.id);}} /></PermissionGate>
      <PermissionGate permission="system:notice:remove"><Button label="删除" aria-label={`删除 ${row.original.title}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {setActionError(''); setDeleting([row.original.id]);}} /></PermissionGate>
    </div>}
  ], [types.options, statuses.options, edit, busy]);
  function refresh(message = '') {setFeedback(message); setSelection({}); setVersion(value => value + 1); invalidateFeed();}
  function apply(event: FormEvent) {event.preventDefault(); setActionError(''); setPage(1); setFilters({...draft}); setVersion(value => value + 1);}
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || busy || imageBusy) return;
    const form = {...editor.form, content: sanitizeNoticeHtml(editor.form.content ?? '')};
    if (!form.title.trim() || form.title.length > 50 || !['1', '2'].includes(form.type) || !['0', '1'].includes(form.status) || (form.remark?.length ?? 0) > 255) {setActionError('请填写公告标题和类型，标题最多 50 个字符，备注最多 255 个字符。'); return;}
    setBusy(true); setActionError('');
    try {if (editor.id) await api.updateNotice(editor.id, form); else await api.createNotice(form); setEditor(null); refresh(editor.id ? '公告已修改。' : '公告已新增。');}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setActionError('');
    try {await api.deleteNotices(deleting); setDeleting(null); refresh('公告已删除。');}
    catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  const selected = Object.keys(selection).filter(id => selection[id]);
  return <section className="posts-page notices-page">
    <PageHeader title="通知公告" description="管理通知和公告，发布内容并查看已读用户。" />
    <DictionaryNotice dictionary={types} /><DictionaryNotice dictionary={statuses} />
    {showFilters && <form className="post-filters" onSubmit={apply}><Input label="公告标题筛选" value={draft.title} onChange={title => setDraft({...draft, title})} /><Input label="操作人员筛选" value={draft.author} onChange={author => setDraft({...draft, author})} />
      <label>公告类型筛选<select aria-label="公告类型筛选" value={draft.type} onChange={event => setDraft({...draft, type: event.target.value})}><option value="">全部</option><DictionaryOptions options={types.options} current={draft.type} /></select></label><Button label="查询" type="submit" /><Button label="重置" variant="ghost" onClick={() => {setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); setVersion(value => value + 1);}} /></form>}
    <div className="post-toolbar">
      <PermissionGate permission="system:notice:add"><Button label="新增公告" variant="primary" isDisabled={busy || types.loading || statuses.loading || !!types.error || !!statuses.error} onClick={() => {setActionError(''); setEditor({form: {...emptyForm}});}} /></PermissionGate>
      <PermissionGate permission="system:notice:edit"><Button label="修改所选公告" variant="secondary" isDisabled={busy || selected.length !== 1} onClick={() => {void edit(selected[0]!);}} /></PermissionGate>
      <PermissionGate permission="system:notice:remove"><Button label="删除所选公告" variant="secondary" isDisabled={busy || selected.length === 0} onClick={() => {setActionError(''); setDeleting(selected);}} /></PermissionGate>
      <Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} /><Button label="刷新列表" variant="ghost" onClick={() => refresh()} />
      <ColumnVisibilityMenu labels={labels} visibility={visibility} onChange={setVisibility} />
    </div>
    {feedback && <p role="status">{feedback}</p>}{actionError && !editor && !deleting && <p role="alert">{actionError}</p>}
    {error ? <><p role="alert">{error}</p><Button label="重试列表" onClick={() => refresh()} /></> : <div className="post-table"><DataTable columns={columns} data={data?.items ?? []} loading={loading} emptyText="暂无公告" pagination={false} sortable={false} selectable showColumnVisibility={false} rowSelection={selection} onRowSelectionChange={setSelection} columnVisibility={visibility} getRowId={row => row.id} getRowSelectionLabel={row => `选择公告 ${row.title}`} /></div>}
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {editor && <ResourceDialog titleId="notice-editor-title" busy={busy} onCancel={() => setEditor(null)}><h2 id="notice-editor-title">{editor.id ? '修改公告' : '新增公告'}</h2>
      <form onSubmit={event => {void save(event);}}><Input label="公告标题" value={editor.form.title} onChange={title => setEditor({...editor, form: {...editor.form, title}})} isDisabled={busy} />
        <label>公告类型<select aria-label="公告类型" value={editor.form.type} disabled={busy || types.loading || !!types.error} onChange={event => setEditor({...editor, form: {...editor.form, type: event.target.value}})}><option value="">请选择公告类型</option><DictionaryOptions options={types.options} current={editor.form.type} /></select></label>
        <fieldset disabled={busy || statuses.loading || !!statuses.error}><legend>公告状态</legend>{statuses.options.map(option => <label key={option.value}><input type="radio" name="notice-status" value={option.value} checked={editor.form.status === option.value} onChange={() => setEditor({...editor, form: {...editor.form, status: option.value}})} />{option.label}</label>)}</fieldset>
        <RichTextEditor value={editor.form.content ?? ''} onChange={content => setEditor(current => current ? {...current, form: {...current.form, content}} : null)} uploadImage={async (file, signal) => (await api.uploadNoticeImage(file, signal)).imageUrl} disabled={busy} onBusyChange={imageBusyChanged} />
        <label>备注<textarea aria-label="备注" value={editor.form.remark ?? ''} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, remark: event.target.value}})} /></label>
        {actionError && <p role="alert">{actionError}</p>}<div className="post-row-actions"><Button label={imageBusy ? '图片上传中…' : '保存公告'} type="submit" isDisabled={busy || imageBusy || types.loading || statuses.loading || !!types.error || !!statuses.error} /><Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setEditor(null)} /></div>
      </form></ResourceDialog>}
    {deleting && <ResourceDialog titleId="notice-delete-title" alert busy={busy} onCancel={() => setDeleting(null)}><h2 id="notice-delete-title">删除公告</h2><p>确认删除所选 {deleting.length} 个公告？已读记录也将删除。</p>{actionError && <p role="alert">{actionError}</p>}<div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => {void remove();}} /><Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setDeleting(null)} /></div></ResourceDialog>}
    {preview && <NoticePreview id={preview} onClose={() => setPreview(null)} />}{readers && <NoticeReaders id={readers} onClose={() => setReaders(null)} />}
  </section>;
}
