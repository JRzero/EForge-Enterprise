import {NativeButton, NativeInput, Select, TextareaControl, Table} from '../../ui/native';
import {PageForm} from '../../ui/FormPage';
import {ListFilters, ListToolbar, ListPage} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {useCallback, useEffect, useMemo, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '../../ui/data';
import {PermissionGate} from '../../ui/patterns';
import {Button, Checkbox, Input} from '../../ui/controls';
import type {DepartmentResponse, PageResponseUserResponse, UserResponse, UserWriteRequest, UserOptionsResponseRead, UserOption, UserImportResponse} from '../../generated/api';
import {useApi, useBootstrap} from '../../app/context';
import {usePageDraft} from '../../app/useDraftProtection';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {PasswordField} from '../../app/components/PasswordField';
import {ApiError, errorMessage} from '../../integration/errors';
import {departmentTree, searchedDepartmentTree} from '../departments/tree';

const emptyFilters = {username: '', phone: '', status: '', beginDate: '', endDate: '', departmentId: undefined as string | undefined};
const emptyUser: UserWriteRequest = {username: '', displayName: '', email: '', phone: '', sex: '2', status: '0', remark: '', roleIds: [], postIds: []};
const columnLabels = {id: '用户编号', username: '登录账号', displayName: '用户昵称', departmentName: '部门', phone: '手机号码', status: '状态', createdAt: '创建时间'};
type Editor = {id?: string; form: UserWriteRequest; password: string; initial: string; options: UserOptionsResponseRead};
type Action = {kind: 'delete'; ids: string[]} | {kind: 'status'; user: UserResponse} | {kind: 'password'; user: UserResponse; password: string} | {kind: 'roles'; user: UserResponse; ids: string[]; options: UserOption[]};

function Choices({label, options, selected, disabled, onChange}: {label: string; options: UserOption[]; selected: string[]; disabled: boolean; onChange: (ids: string[]) => void}) {
  const known = new Set(options.map(option => option.id));
  return <fieldset className="user-choices" disabled={disabled}><legend>{label}</legend>
    {options.length === 0 && selected.length === 0 ? <p>暂无可分配的{label}。</p> : null}
    {options.map(option => <label key={option.id}><NativeInput type="checkbox" checked={selected.includes(option.id)} disabled={disabled || (option.status === '1' && !selected.includes(option.id))}
      onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />{option.name}{option.status === '1' ? '（停用）' : ''}</label>)}
    {selected.filter(id => !known.has(id)).map(id => <label key={id}><NativeInput type="checkbox" checked onChange={() => onChange(selected.filter(value => value !== id))} />当前已分配的{label}（{id}）</label>)}
  </fieldset>;
}

export function UsersPage() {
  const statusDictionary = useDictionary('sys_normal_disable'), sexDictionary = useDictionary('sys_user_sex');
  const api = useApi(); const bootstrap = useBootstrap();
  const [draft, setDraft] = useState(emptyFilters); const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(true); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [version, setVersion] = useState(0); const [data, setData] = useState<PageResponseUserResponse | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]); const [departmentError, setDepartmentError] = useState('');
  const [departmentVersion, setDepartmentVersion] = useState(0); const [departmentSearch, setDepartmentSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [feedback, setFeedback] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({}); const [visibility, setVisibility] = useState<VisibilityState>({});
  const [editor, setEditor] = useState<Editor | null>(null); const [action, setAction] = useState<Action | null>(null);
  const [discardEditor, setDiscardEditor] = useState(false);
  const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState(''); const [parentSearch, setParentSearch] = useState('');
  const [importing, setImporting] = useState<{file: File | null; updateExisting: boolean; result: UserImportResponse | null} | null>(null);
  const editorDirty = !!editor && editor.initial !== JSON.stringify([editor.form, editor.password]);
  const pageDraft = usePageDraft(editorDirty);

  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, filters, page, pageSize, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSelection({});
    api.listUsers({...filters, page, pageSize}, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData(result); setLoading(false);complete(); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false);complete(); } });
    return () => controller.abort();
  }, [api, filters, page, pageSize, version,read]);
  useEffect(() => {
    const controller = new AbortController(); setDepartmentError('');
    api.listUserDepartments(controller.signal).then(result => { if (!controller.signal.aborted) setDepartments(result); })
      .catch(cause => { if (!controller.signal.aborted) setDepartmentError(errorMessage(cause)); });
    return () => controller.abort();
  }, [api, departmentVersion]);

  const openEditor = useCallback(async (id?: string) => {
    setBusy(true); setActionError(''); setParentSearch('');
    try {
      const [options, detail] = await Promise.all([api.getUserOptions(), id ? api.getUser(id) : Promise.resolve(null)]);
      const form: UserWriteRequest = detail ? {username: detail.user.username, displayName: detail.user.displayName,
        departmentId: detail.user.departmentId, email: detail.user.email ?? '', phone: detail.user.phone ?? '',
        sex: detail.user.sex || '2', status: detail.user.status, remark: detail.user.remark ?? '', roleIds: detail.roleIds, postIds: detail.postIds}
        : {...emptyUser, departmentId: filters.departmentId, roleIds: [], postIds: []};
      const password = id ? '' : options.initialPassword;
      setDiscardEditor(false);
      setEditor({id, form, password, initial: JSON.stringify([form, password]), options});
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [api, filters.departmentId]);
  const openRoles = useCallback(async (user: UserResponse) => {
    setBusy(true); setActionError('');
    try {
      const [options, detail] = await Promise.all([api.getUserOptions(), api.getUserRoles(user.id)]);
      setAction({kind: 'roles', user, ids: detail.roleIds, options: options.roles});
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [api]);
  const columns = useMemo<ColumnDef<UserResponse>[]>(() => [
    {id: 'selection', enableHiding: false, enableSorting: false,
      header: () => <Checkbox label="选择当前页全部用户" isLabelHidden size="sm" isDisabled={busy || loading || !data?.items.length}
        value={data?.items.length && data.items.every(row => selection[row.id]) ? true : data?.items.some(row => selection[row.id]) ? 'indeterminate' : false}
        onChange={checked => setSelection(checked ? Object.fromEntries((data?.items ?? []).map(row => [row.id, true])) : {})} />,
      cell: ({row}) => <Checkbox label={`选择用户 ${row.original.username}`} isLabelHidden size="sm" isDisabled={busy} value={!!selection[row.original.id]}
        onChange={checked => setSelection(previous => ({...previous, [row.original.id]: checked}))} />},
    {accessorKey: 'id', header: '用户编号'}, {accessorKey: 'username', header: '登录账号'}, {accessorKey: 'displayName', header: '用户昵称'},
    {accessorKey: 'departmentName', header: '部门', cell: ({row}) => row.original.departmentName || '—'}, {accessorKey: 'phone', header: '手机号码'},
    {accessorKey: 'status', header: '状态', cell: ({row}) => <div><DictionaryTag options={statusDictionary.options} value={row.original.status} />
      {row.original.id !== '1' ? <PermissionGate permission="system:user:edit"><Button label={row.original.status === '0' ? '停用' : '启用'} size="sm" variant="ghost" isDisabled={busy}
        aria-label={`${row.original.status === '0' ? '停用' : '启用'}用户 ${row.original.username}`} onClick={() => { setActionError(''); setAction({kind: 'status', user: row.original}); }} /></PermissionGate> : null}</div>},
    {accessorKey: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => row.original.id === '1' ? <span>超级管理员</span> : <div className="post-row-actions">
      <PermissionGate permission="system:user:edit"><Button label="修改" size="sm" variant="ghost" aria-label={`修改用户 ${row.original.username}`} isDisabled={busy} onClick={() => { void openEditor(row.original.id); }} /></PermissionGate>
      <PermissionGate permission="system:user:remove"><Button label="删除" size="sm" variant="ghost" aria-label={`删除用户 ${row.original.username}`} isDisabled={busy} onClick={() => { setActionError(''); setAction({kind: 'delete', ids: [row.original.id]}); }} /></PermissionGate>
      <PermissionGate permission="system:user:resetPwd"><Button label="重置密码" size="sm" variant="ghost" aria-label={`重置密码 ${row.original.username}`} isDisabled={busy} onClick={() => { setActionError(''); setAction({kind: 'password', user: row.original, password: ''}); }} /></PermissionGate>
      <PermissionGate permission="system:user:edit"><Button label="分配角色" size="sm" variant="ghost" aria-label={`分配角色 ${row.original.username}`} isDisabled={busy} onClick={() => { void openRoles(row.original); }} /></PermissionGate>
    </div>}
  ], [busy, data, loading, selection, openEditor, openRoles, statusDictionary.options]);
  function refresh(message = '') { setFeedback(message); setSelection({}); setVersion(value => value + 1); }
  function close() { pageDraft.setDirty(false); setEditor(null); setDiscardEditor(false); setAction(null); setImporting(null); setActionError(''); }
  function cancelEditor() {
    if (busy) return;
    if (editorDirty) setDiscardEditor(true);
    else close();
  }
  function validPassword(password: string) { return password.length >= 5 && password.length <= 20 && !/[<>"'|\\]/.test(password); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor || busy) return;
    const form = editor.form;
    if (form.username.length < 2 || form.username.length > 20 || !form.displayName.trim() || form.displayName.length > 30 ||
      (form.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.email.length > 50)) ||
      (form.phone && !/^1[3-9][0-9]{9}$/.test(form.phone)) || (!editor.id && !validPassword(editor.password))) {
      setActionError('请检查账号（2–20 字符）、昵称、手机、邮箱和密码（5–20 字符，不含非法符号）。'); return;
    }
    setBusy(true); setActionError('');
    const finishSave = pageDraft.beginSave();
    try {
      if (editor.id) await api.updateUser(editor.id, form); else await api.createUser({user: form, password: editor.password});
      close(); refresh(editor.id ? '用户已更新。' : '用户已创建。');
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { finishSave(); setBusy(false); }
  }
  async function confirmAction() {
    if (!action || busy) return;
    if (action.kind === 'password' && !validPassword(action.password)) { setActionError('密码须为 5–20 字符，不能包含 < > " \' | 或反斜杠。'); return; }
    setBusy(true); setActionError('');
    try {
      if (action.kind === 'delete') { await api.deleteUsers(action.ids); setPage(1); }
      else if (action.kind === 'status') await api.setUserStatus(action.user.id, action.user.status === '0' ? '1' : '0');
      else if (action.kind === 'password') await api.resetUserPassword(action.user.id, action.password);
      else await api.setUserRoles(action.user.id, action.ids);
      close(); refresh('操作已完成。');
      // Refresh authoritative permissions after editing the current account.
      if (action.kind !== 'delete' && action.user.id === bootstrap.user.id) window.location.reload();
    } catch (cause) { setActionError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function exportFile() {
    setBusy(true); setActionError('');
    try { const file = await api.exportUsers(filters); const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = '用户数据.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function downloadTemplate() {
    setBusy(true); setActionError('');
    try { const file = await api.downloadUserImportTemplate(); const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = '用户导入模板.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function importFile() {
    if (!importing || busy) return;
    const file = importing.file;
    if (!file || !/\.xlsx?$/i.test(file.name) || file.size === 0 || file.size > 10 * 1024 * 1024) { setActionError('请选择不超过 10 MB 的 XLS 或 XLSX 文件。'); return; }
    setBusy(true); setActionError(''); setImporting({...importing, result: null});
    try { const result = await api.importUsers(file, importing.updateExisting); setImporting({...importing, result}); refresh(`导入完成：新增 ${result.created}，更新 ${result.updated}，失败 ${result.failed}。`); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  const selectedIds = Object.keys(selection).filter(id => selection[id]);
  const tree = useMemo(() => searchedDepartmentTree(departments, departmentSearch, collapsed), [departments, departmentSearch, collapsed]);
  const parentOptions = editor ? departmentTree(editor.options.departments).filter(row =>
    (row.department.status === '0' || row.department.id === editor.form.departmentId) && (row.path.toLowerCase().includes(parentSearch.trim().toLowerCase()) || row.department.id === editor.form.departmentId)) : [];
  return <ListPage className="posts-page users-page" title="用户管理" description="管理账号、部门归属与角色岗位分配。" eyebrow="系统管理"><DictionaryNotice dictionary={statusDictionary} /><DictionaryNotice dictionary={sexDictionary} />
    <div className="user-layout"><aside className="user-departments" aria-label="用户部门筛选">
      <Input label="搜索部门" value={departmentSearch} onChange={setDepartmentSearch} />
      <Button label="全部部门" variant="ghost" onClick={() => { setDraft({...draft, departmentId: undefined}); setFilters({...filters, departmentId: undefined}); setPage(1); }} />
      {departmentError ? <div role="alert">{departmentError}<Button label="重试部门" onClick={() => setDepartmentVersion(value => value + 1)} /></div> : null}
      <ul>{tree.map(row => <li key={row.department.id} style={{paddingLeft: row.depth * 12}}>
        {row.hasChildren ? <NativeButton aria-label={`${collapsed.has(row.department.id) ? '展开' : '折叠'}筛选部门 ${row.department.name}`} aria-expanded={!collapsed.has(row.department.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(row.department.id)) next.delete(row.department.id); else next.add(row.department.id); return next; })}>{collapsed.has(row.department.id) ? '▸' : '▾'}</NativeButton> : null}
        <NativeButton aria-label={`筛选部门 ${row.path}`} aria-pressed={filters.departmentId === row.department.id} onClick={() => { setDraft({...draft, departmentId: row.department.id}); setFilters({...filters, departmentId: row.department.id}); setPage(1); }}>{row.department.name}</NativeButton>
      </li>)}</ul>
    </aside><div className="user-content">
      <ListFilters hidden={!showFilters} actions={<><Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setDepartmentSearch(''); setPage(1); refresh(); }} /></>} onSubmit={event => { event.preventDefault(); if (draft.beginDate && draft.endDate && draft.beginDate > draft.endDate) { setActionError('开始日期不能晚于结束日期。'); return; } setActionError(''); setPage(1); setFilters({...draft}); setVersion(value => value + 1); }}>
        <Input label="登录账号筛选" value={draft.username} onChange={username => setDraft({...draft, username})} /><Input label="手机号码筛选" value={draft.phone} onChange={phone => setDraft({...draft, phone})} />
        <label>用户状态筛选<Select aria-label="用户状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option><DictionaryOptions options={statusDictionary.options} current={draft.status} /></Select></label>
        <label>开始日期<NativeInput aria-label="开始日期" type="date" value={draft.beginDate} onChange={event => setDraft({...draft, beginDate: event.target.value})} /></label><label>结束日期<NativeInput aria-label="结束日期" type="date" value={draft.endDate} onChange={event => setDraft({...draft, endDate: event.target.value})} /></label>

      </ListFilters>
      <ListToolbar >
        <PermissionGate permission="system:user:add"><Button label="新增用户" variant="primary" isDisabled={busy} onClick={() => { void openEditor(); }} /></PermissionGate>
        <PermissionGate permission="system:user:edit"><Button label="修改所选用户" variant="secondary" isDisabled={busy || selectedIds.length !== 1 || selectedIds[0] === '1'} onClick={() => { void openEditor(selectedIds[0]); }} /></PermissionGate>
        <PermissionGate permission="system:user:remove"><Button label="删除所选用户" variant="secondary" isDisabled={busy || selectedIds.length === 0} onClick={() => { setActionError(''); setAction({kind: 'delete', ids: selectedIds}); }} /></PermissionGate>
        <PermissionGate permission="system:user:export"><Button label="导出用户" variant="secondary" isDisabled={busy} onClick={() => { void exportFile(); }} /></PermissionGate>
        <PermissionGate permission="system:user:import"><Button label="导入用户" variant="secondary" isDisabled={busy} onClick={() => { setActionError(''); setImporting({file: null, updateExisting: false, result: null}); }} /></PermissionGate>
        <Button label="刷新列表" variant="ghost" onClick={() => refresh()} /><Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} />
        <ColumnVisibilityMenu labels={columnLabels} visibility={visibility} onChange={setVisibility} />
      </ListToolbar>
      {selectedIds.length ? <div className="user-selection"><span role="status">已选择 {selectedIds.length} 个用户</span><Button label="清空选择" variant="ghost" onClick={() => setSelection({})} /></div> : null}
      {feedback ? <p role="status">{feedback}</p> : null}{error ? <div role="alert">{error}<Button label="重试列表" onClick={() => refresh()} /></div> : null}{actionError && !editor && !action && !importing ? <p role="alert">{actionError}</p> : null}
      <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无用户" pagination={false} sortable={false} showColumnVisibility={false} rowSelection={selection} columnVisibility={visibility} getRowId={row => row.id} /></div>
      <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    </div></div>
    {editor ? <ResourceDialog titleId="user-editor-title" busy={busy} onCancel={cancelEditor}><h2 id="user-editor-title">{editor.id ? '修改用户' : '新增用户'}</h2>
      {discardEditor ? <div role="alert"><p>有未保存的修改，是否放弃？</p>
        <Button label="继续编辑" isDisabled={busy} onClick={()=>setDiscardEditor(false)} />
        <Button label="放弃修改" variant="secondary" isDisabled={busy} onClick={close} />
      </div> : null}<PageForm className="user-editor-form" noValidate onSubmit={event => { void save(event); }}>
      <Input label="登录账号" value={editor.form.username} isDisabled={busy || !!editor.id} aria-required="true" onChange={username => setEditor({...editor, form: {...editor.form, username}})} />
      <Input label="用户昵称" value={editor.form.displayName} isDisabled={busy} aria-required="true" onChange={displayName => setEditor({...editor, form: {...editor.form, displayName}})} />
      {!editor.id ? <PasswordField label="用户密码" autoComplete="new-password" value={editor.password} isDisabled={busy} aria-required="true" onChange={password => setEditor({...editor, password})} /> : null}
      <Input label="搜索归属部门" value={parentSearch} onChange={setParentSearch} />
      <label>归属部门<Select aria-label="归属部门" value={editor.form.departmentId ?? ''} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, departmentId: event.target.value || undefined}})}><option value="">未指定部门</option>{editor.form.departmentId && !parentOptions.some(row => row.department.id === editor.form.departmentId) ? <option value={editor.form.departmentId}>当前归属部门</option> : null}{parentOptions.map(row => <option key={row.department.id} value={row.department.id}>{row.path}{row.department.status === '1' ? '（停用）' : ''}</option>)}</Select></label>
      <Input label="手机号码" value={editor.form.phone ?? ''} isDisabled={busy} onChange={phone => setEditor({...editor, form: {...editor.form, phone}})} /><Input label="邮箱" value={editor.form.email ?? ''} isDisabled={busy} onChange={email => setEditor({...editor, form: {...editor.form, email}})} />
      <label>用户性别<Select aria-label="用户性别" value={editor.form.sex} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, sex: event.target.value}})}><DictionaryOptions options={sexDictionary.options} current={editor.form.sex} /></Select></label>
      <label>用户状态<Select aria-label="用户状态" value={editor.form.status} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, status: event.target.value}})}><DictionaryOptions options={statusDictionary.options} current={editor.form.status} /></Select></label>
      <Choices label="岗位" options={editor.options.posts} selected={editor.form.postIds} disabled={busy} onChange={postIds => setEditor({...editor, form: {...editor.form, postIds}})} /><Choices label="角色" options={editor.options.roles} selected={editor.form.roleIds} disabled={busy} onChange={roleIds => setEditor({...editor, form: {...editor.form, roleIds}})} />
      <label>备注<TextareaControl aria-label="备注" maxLength={500} value={editor.form.remark ?? ''} disabled={busy} onChange={event => setEditor({...editor, form: {...editor.form, remark: event.target.value}})} /></label>{actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="保存用户" type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={cancelEditor} /></div>
    </PageForm></ResourceDialog> : null}
    {action ? <ResourceDialog titleId="user-action-title" alert={action.kind === 'delete' || action.kind === 'status'} busy={busy} onCancel={close}><h2 id="user-action-title">{action.kind === 'delete' ? '确认删除用户' : action.kind === 'status' ? `确认${action.user.status === '0' ? '停用' : '启用'}用户` : action.kind === 'password' ? '重置用户密码' : '分配用户角色'}</h2>
      {action.kind === 'delete' ? <p>将删除所选的 {action.ids.length} 个用户。超级管理员和当前登录用户不能删除。</p> : <p>登录账号：{action.user.username}</p>}
      {action.kind === 'password' ? <Input label="新密码" type="password" value={action.password} isDisabled={busy} onChange={password => setAction({...action, password})} /> : null}
      {action.kind === 'roles' ? <Choices label="角色" options={action.options} selected={action.ids} disabled={busy} onChange={ids => setAction({...action, ids})} /> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label={action.kind === 'delete' ? '确认删除' : '确认保存'} isDisabled={busy} onClick={() => { void confirmAction(); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={close} /></div>
    </ResourceDialog> : null}
    {importing ? <ResourceDialog titleId="user-import-title" busy={busy} onCancel={close}><h2 id="user-import-title">导入用户</h2>
      <p>使用模板填写用户数据，一次最多 1000 条。更新已有用户时，部门、角色、岗位和密码保持原值。</p>
      <div className="user-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) setImporting({...importing, file: event.dataTransfer.files[0] ?? null, result: null}); }}>
        <label>导入文件<NativeInput aria-label="导入文件" type="file" accept=".xls,.xlsx" disabled={busy} onChange={event => setImporting({...importing, file: event.target.files?.[0] ?? null, result: null})} /></label><p>{importing.file ? importing.file.name : '拖放 Excel 文件或点击选择文件。'}</p>
      </div><label className="user-import-update"><NativeInput type="checkbox" checked={importing.updateExisting} disabled={busy} onChange={event => setImporting({...importing, updateExisting: event.target.checked})} />更新已存在的用户</label>
      <Button label="下载导入模板" variant="secondary" isDisabled={busy} onClick={() => { void downloadTemplate(); }} />
      {actionError ? <p role="alert">{actionError}</p> : null}{importing.result ? <section className="user-import-result" aria-label="导入结果"><p role="status">共 {importing.result.total} 条：新增 {importing.result.created}，更新 {importing.result.updated}，失败 {importing.result.failed}。成功条目已保存，可修改失败条目后重试。</p>
        <Table><thead><tr><th>记录</th><th>登录账号</th><th>结果</th></tr></thead><tbody>{importing.result.rows.map(row => <tr key={row.row}><td>{row.row}</td><td>{row.username}</td><td>{row.outcome === 'CREATED' ? '新增成功' : row.outcome === 'UPDATED' ? '更新成功' : errorMessage(new ApiError(400, row.code ?? 'USER_IMPORT_FAILED'))}</td></tr>)}</tbody></Table>
      </section> : null}<div className="post-row-actions"><Button label={busy ? '正在处理…' : '开始导入'} isDisabled={busy} onClick={() => { void importFile(); }} /><Button label="关闭" variant="secondary" isDisabled={busy} onClick={close} /></div>
    </ResourceDialog> : null}
  </ListPage>;
}
