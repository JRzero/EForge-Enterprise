import {Select, NativeInput} from '../../ui/native';
import {ListFilters, ListToolbar, ListPage} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '../../ui/data';
import {PermissionGate} from '../../ui/patterns';
import {Button, Checkbox, Input} from '../../ui/controls';
import type {PageResponseRoleResponse, RoleResponse, RoleEditorResponse, RoleMenuOption, RoleScopeResponse} from '../../generated/api';
import {useApi, useApplicationControls} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {RoleEditor, RoleScopeDialog} from './RoleDialogs';
import {grantForest} from './grants';
import {useRoleSnapshot} from './useRoleSnapshot';

const emptyFilters = {name: '', key: '', status: '', beginDate: '', endDate: ''};
const labels = {id: '角色编号', name: '角色名称', key: '权限字符', sort: '显示顺序', status: '状态', createdAt: '创建时间'};
type Action = {kind: 'delete'; ids: string[]} | {kind: 'status'; role: RoleResponse};
export function RolesPage() {
  const statusDictionary = useDictionary('sys_normal_disable');
  const api = useApi(), controls = useApplicationControls();
  const snapshot = useRoleSnapshot();
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(true), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResponseRoleResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [feedback, setFeedback] = useState(''), [actionError, setActionError] = useState(''), [requestBusy, setBusy] = useState(false);
  const busy = requestBusy || snapshot.busy;
  const [selection, setSelection] = useState<RowSelectionState>({}), [visibility, setVisibility] = useState<VisibilityState>({});
  const [editor, setEditor] = useState<{detail: RoleEditorResponse | null; menus: RoleMenuOption[]} | null>(null);
  const [scope, setScope] = useState<{role: RoleResponse; snapshot: RoleScopeResponse} | null>(null), [action, setAction] = useState<Action | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (detailRequest.current?.signal.aborted) {detailRequest.current = null; setBusy(false);}
    return () => detailRequest.current?.abort();
  }, []);
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, filters, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSelection({});
    api.listRoles({...filters, page, pageSize}, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false);complete(); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false);complete(); } });
    return () => controller.abort();
  }, [api, filters, page, pageSize, version,read]);
  function refresh(message = '') { setFeedback(message); setSelection({}); setVersion(previous => previous + 1); }
  async function saved(message: string) { refresh(message); await snapshot.refresh(); }
  const openEditor = useCallback(async (id?: string) => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError(''); setFeedback('');
    try {
      const [menus, detail] = await Promise.all([api.getRoleMenuOptions(controller.signal), id ? api.getRole(id, controller.signal) : Promise.resolve(null)]);
      if (!controller.signal.aborted) {grantForest(menus); setEditor({detail, menus});}
    } catch (cause) { if (!controller.signal.aborted) setActionError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) {detailRequest.current = null; setBusy(false);} }
  }, [api]);
  const openScope = useCallback(async (role: RoleResponse) => {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setBusy(true); setActionError('');
    try { const snapshot = await api.getRoleDataScope(role.id, controller.signal); if (!controller.signal.aborted) {grantForest(snapshot.departments.map(node => ({key: node.id, parentKey: node.parentId, label: node.name}))); setScope({role, snapshot});} }
    catch (cause) { if (!controller.signal.aborted) setActionError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) {detailRequest.current = null; setBusy(false);} }
  }, [api]);
  const selectedIds = Object.keys(selection).filter(id => selection[id] && id !== '1');
  const columns = useMemo<ColumnDef<RoleResponse>[]>(() => [
    {id: 'selection', enableHiding: false, header: () => <Checkbox label="选择当前页全部角色" isLabelHidden size="sm" isDisabled={busy || loading || !data?.items.some(role => role.id !== '1')}
      value={data?.items.some(role => role.id !== '1') && data.items.filter(role => role.id !== '1').every(role => selection[role.id]) ? true : data?.items.some(role => selection[role.id]) ? 'indeterminate' : false}
      onChange={checked => setSelection(checked ? Object.fromEntries((data?.items ?? []).filter(role => role.id !== '1').map(role => [role.id, true])) : {})} />,
      cell: ({row}) => <Checkbox label={`选择角色 ${row.original.name}`} isLabelHidden size="sm" isDisabled={busy || row.original.id === '1'} value={!!selection[row.original.id]} onChange={checked => setSelection(previous => ({...previous, [row.original.id]: checked}))} />},
    {accessorKey: 'id', header: '角色编号'}, {accessorKey: 'name', header: '角色名称'}, {accessorKey: 'key', header: '权限字符'}, {accessorKey: 'sort', header: '显示顺序'},
    {accessorKey: 'status', header: '状态', cell: ({row}) => <div className="post-row-actions"><DictionaryTag options={statusDictionary.options} value={row.original.status} />{row.original.id !== '1' ? <PermissionGate permission="system:role:edit"><Button label={row.original.status === '0' ? '停用' : '启用'} aria-label={`${row.original.status === '0' ? '停用' : '启用'}角色 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { setActionError(''); setAction({kind: 'status', role: row.original}); }} /></PermissionGate> : null}</div>},
    {accessorKey: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => row.original.id === '1' ? <span>受保护</span> : <div className="post-row-actions">
      <PermissionGate permission="system:role:edit"><Button label="修改" aria-label={`修改角色 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openEditor(row.original.id); }} />
        <Button label="数据权限" aria-label={`数据权限 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openScope(row.original); }} />
        <Button label="分配用户" aria-label={`分配用户 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => controls.navigate(`/role/users/${row.original.id}`)} /></PermissionGate>
      <PermissionGate permission="system:role:remove"><Button label="删除" aria-label={`删除角色 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { setActionError(''); setAction({kind: 'delete', ids: [row.original.id]}); }} /></PermissionGate>
    </div>}
  ], [busy, loading, data, selection, openEditor, openScope, controls, statusDictionary.options]);
  async function confirm() {
    if (!action || busy) return; setBusy(true); setActionError('');
    try {
      if (action.kind === 'delete') { await api.deleteRoles(action.ids); setPage(1); }
      else await api.setRoleStatus(action.role.id, action.role.status === '0' ? '1' : '0');
      setAction(null); await saved('角色操作已完成。');
    } catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function exportFile() {
    setBusy(true); setActionError('');
    try { const file = await api.exportRoles(filters); const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = '角色数据.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  function query(event: FormEvent) {
    event.preventDefault(); if (draft.beginDate && draft.endDate && draft.beginDate > draft.endDate) { setActionError('开始日期不能晚于结束日期。'); return; }
    setActionError(''); setPage(1); setFilters({...draft}); setVersion(previous => previous + 1);
  }
  return <ListPage className="posts-page roles-page" title="角色管理" description="管理角色、菜单权限、数据范围与用户授权。" eyebrow="系统管理"><DictionaryNotice dictionary={statusDictionary} />
    <ListFilters hidden={!showFilters} actions={<><Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); refresh(); }} /></>} onSubmit={query}><Input label="角色名称筛选" value={draft.name} onChange={name => setDraft({...draft, name})} />
      <Input label="权限字符筛选" value={draft.key} onChange={key => setDraft({...draft, key})} /><label>状态筛选<Select aria-label="状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option><DictionaryOptions options={statusDictionary.options} current={draft.status} /></Select></label>
      <label>开始日期<NativeInput type="date" aria-label="开始日期" value={draft.beginDate} onChange={event => setDraft({...draft, beginDate: event.target.value})} /></label><label>结束日期<NativeInput type="date" aria-label="结束日期" value={draft.endDate} onChange={event => setDraft({...draft, endDate: event.target.value})} /></label>

    </ListFilters><ListToolbar ><PermissionGate permission="system:role:add"><Button label="新增角色" variant="primary" isDisabled={busy} onClick={() => { void openEditor(); }} /></PermissionGate>
      <PermissionGate permission="system:role:edit"><Button label="修改所选角色" variant="secondary" isDisabled={busy || selectedIds.length !== 1} onClick={() => { void openEditor(selectedIds[0]); }} /></PermissionGate>
      <PermissionGate permission="system:role:remove"><Button label="删除所选角色" variant="secondary" isDisabled={busy || !selectedIds.length} onClick={() => { setActionError(''); setAction({kind: 'delete', ids: selectedIds}); }} /></PermissionGate>
      <PermissionGate permission="system:role:export"><Button label="导出角色" variant="secondary" isDisabled={busy} onClick={() => { void exportFile(); }} /></PermissionGate>
      <Button label="刷新列表" variant="ghost" isDisabled={loading} onClick={() => refresh()} /><Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(previous => !previous)} />
      <ColumnVisibilityMenu labels={labels} visibility={visibility} onChange={setVisibility} />
    </ListToolbar>{feedback ? <p role="status">{feedback}</p> : null}{busy && !action ? <p role="status">正在处理角色信息…</p> : null}
    {error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => refresh()} /></div> : null}{actionError && !action ? <p role="alert">{actionError}</p> : null}
    {snapshot.error ? <div role="alert"><p>角色操作已保存，权限信息刷新失败：{snapshot.error}</p><Button label="重试权限刷新" isDisabled={snapshot.busy} onClick={() => { void snapshot.refresh(); }} /></div> : null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无角色" pagination={false} sortable={false} showColumnVisibility={false} columnVisibility={visibility} getRowId={row => row.id} /></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {editor ? <RoleEditor statusOptions={statusDictionary.options} detail={editor.detail} menus={editor.menus} onClose={() => setEditor(null)} onSaved={() => saved('角色已保存。')} /> : null}
    {scope ? <RoleScopeDialog id={scope.role.id} name={scope.role.name} snapshot={scope.snapshot} onClose={() => setScope(null)} onSaved={() => saved('数据权限已保存。')} /> : null}
    {action ? <ResourceDialog titleId="role-action-title" alert busy={busy} onCancel={() => { setAction(null); setActionError(''); }}><h2 id="role-action-title">{action.kind === 'delete' ? '确认删除角色' : `确认${action.role.status === '0' ? '停用' : '启用'}角色`}</h2><p>{action.kind === 'delete' ? `将删除所选的 ${action.ids.length} 个角色。已分配给用户的角色无法删除。` : `角色：${action.role.name}`}</p>{actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label={action.kind === 'delete' ? '确认删除' : '确认状态变更'} isDisabled={busy} onClick={() => { void confirm(); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => { setAction(null); setActionError(''); }} /></div></ResourceDialog> : null}
  </ListPage>;
}
