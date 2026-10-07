import {Pagination} from '../../app/components/Pagination';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useDictionary, DictionaryNotice} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import type {AppRoutePageProps} from '@eforge/app';
import {DataTable, type ColumnDef, type RowSelectionState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Checkbox, Input} from '@eforge/ui';
import type {PageResponseUserResponse, UserResponse} from '../../generated/api';
import {useApi, useApplicationControls} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {useRoleSnapshot} from './useRoleSnapshot';

function RoleUserList({roleId, assigned, version, busy, onAction}: {roleId: string; assigned: boolean; version: number; busy: boolean; onAction: (ids: string[]) => void}) {
  const api = useApi(), statusDictionary = useDictionary('sys_normal_disable');
  const [draft, setDraft] = useState({username: '', phone: ''}), [filters, setFilters] = useState({username: '', phone: ''});
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [reload, setReload] = useState(0), [showFilters, setShowFilters] = useState(true);
  const [data, setData] = useState<PageResponseUserResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selection, setSelection] = useState<RowSelectionState>({});
  const read=useRetainedRead();
  useEffect(() => {
    const complete=read([api, roleId, filters, assigned, page, pageSize, reload, version]);if(!complete)return;
    const controller = new AbortController(); setLoading(true); setData(null); setSelection({}); setError('');
    api.listRoleUsers(roleId, {...filters, assigned, page, pageSize}, controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false);complete(); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false);complete(); } });
    return () => controller.abort();
  }, [api, roleId, filters, assigned, page, pageSize, reload, version,read]);
  const selected = Object.keys(selection).filter(id => selection[id] && id !== '1');
  const columns = useMemo<ColumnDef<UserResponse>[]>(() => [
    {id: 'selection', header: () => <Checkbox label="选择当前页全部授权用户" isLabelHidden size="sm" isDisabled={busy || loading || !data?.items.some(user => user.id !== '1')}
      value={data?.items.some(user => user.id !== '1') && data.items.filter(user => user.id !== '1').every(user => selection[user.id]) ? true : data?.items.some(user => selection[user.id]) ? 'indeterminate' : false}
      onChange={checked => setSelection(checked ? Object.fromEntries((data?.items ?? []).filter(user => user.id !== '1').map(user => [user.id, true])) : {})} />,
      cell: ({row}) => <Checkbox label={`选择授权用户 ${row.original.username}`} isLabelHidden size="sm" isDisabled={busy || row.original.id === '1'} value={!!selection[row.original.id]} onChange={checked => setSelection(previous => ({...previous, [row.original.id]: checked}))} />},
    {accessorKey: 'username', header: '登录账号'}, {accessorKey: 'displayName', header: '用户昵称'}, {accessorKey: 'email', header: '邮箱'}, {accessorKey: 'phone', header: '手机'},
    {accessorKey: 'status', header: '状态', cell: ({row}) => <DictionaryTag options={statusDictionary.options} value={row.original.status} />},
    {accessorKey: 'createdAt', header: '创建时间', cell: ({row}) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('zh-CN') : '—'},
    ...(assigned ? [{id: 'actions', header: '操作', cell: ({row}: {row: {original: UserResponse}}) => row.original.id === '1' ? <span>受保护</span> : <PermissionGate permission="system:role:edit"><Button label="取消授权" aria-label={`取消授权 ${row.original.username}`} variant="ghost" size="sm" isDisabled={busy || roleId === '1'} onClick={() => onAction([row.original.id])} /></PermissionGate>}] : [])
  ], [busy, loading, data, selection, assigned, roleId, onAction, statusDictionary.options]);
  function query(event: FormEvent) { event.preventDefault(); setPage(1); setFilters({...draft}); setReload(previous => previous + 1); }
  return <div className="role-user-list"><DictionaryNotice dictionary={statusDictionary} /><form hidden={!showFilters} className="post-filters" onSubmit={query}>
    <Input label="用户账号筛选" value={draft.username} isDisabled={busy} onChange={username => setDraft({...draft, username})} /><Input label="手机号码筛选" value={draft.phone} isDisabled={busy} onChange={phone => setDraft({...draft, phone})} />
    <Button label="查询用户" type="submit" isDisabled={busy} /><Button label="重置用户筛选" variant="secondary" isDisabled={busy} onClick={() => { setDraft({username: '', phone: ''}); setFilters({username: '', phone: ''}); setPage(1); setReload(previous => previous + 1); }} />
  </form><div className="post-toolbar"><PermissionGate permission="system:role:edit"><Button label={assigned ? '批量取消授权' : '确认添加用户'} isDisabled={busy || !selected.length || roleId === '1'} onClick={() => onAction(selected)} /></PermissionGate>
    <Button label="刷新用户列表" variant="ghost" isDisabled={busy || loading} onClick={() => setReload(previous => previous + 1)} /><Button label={showFilters ? '隐藏用户筛选' : '显示用户筛选'} variant="ghost" isDisabled={busy} onClick={() => setShowFilters(previous => !previous)} />
  </div>{error ? <div role="alert"><p>{error}</p><Button label="重试用户列表" onClick={() => setReload(previous => previous + 1)} /></div> : null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText={assigned ? '暂无已授权用户' : '暂无可添加用户'} pagination={false} sortable={false} showColumnVisibility={false} getRowId={row => row.id} /></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} loading={loading} onPage={setPage} onSize={setPageSize} busy={busy} previousLabel="用户上一页" nextLabel="用户下一页" sizeLabel="用户每页条数" />
  </div>;
}
export function RoleUsersPage({params}: AppRoutePageProps) {
  return <RoleUsersWorkspace key={params.roleId ?? ''} roleId={params.roleId ?? ''} />;
}
function RoleUsersWorkspace({roleId}: {roleId: string}) {
  const valid = /^[1-9][0-9]{0,18}$/.test(roleId) && BigInt(roleId) <= 9223372036854775807n;
  const api = useApi(), controls = useApplicationControls();
  const snapshot = useRoleSnapshot();
  const [picker, setPicker] = useState(false), [cancelling, setCancelling] = useState<string[] | null>(null);
  const [requestBusy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState(''), [version, setVersion] = useState(0);
  const busy = requestBusy || snapshot.busy;
  async function mutate(ids: string[], assign: boolean) {
    if (busy || !valid) return; setBusy(true); setError('');
    try {
      if (assign) await api.assignRoleUsers(roleId, ids); else await api.cancelRoleUsers(roleId, ids);
      setPicker(false); setCancelling(null); setFeedback(assign ? '用户已授权。' : '用户授权已取消。'); setVersion(previous => previous + 1); await snapshot.refresh();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <section className="posts-page role-users-page"><PageHeader title="用户授权" description={`角色编号：${roleId}`} eyebrow="角色管理" />
    <div className="post-toolbar"><PermissionGate permission="system:role:edit"><Button label="添加用户" isDisabled={busy || !valid || roleId === '1'} onClick={() => { setError(''); setPicker(true); }} /></PermissionGate><Button label="关闭授权页" variant="secondary" isDisabled={busy} onClick={() => (controls.closePage ?? controls.navigate)('/role')} /></div>
    {!valid ? <p role="alert">角色编号无效，请返回角色列表。</p> : <RoleUserList key={roleId} roleId={roleId} assigned version={version} busy={busy} onAction={ids => { setError(''); setCancelling(ids); }} />}
    {feedback ? <p role="status">{feedback}</p> : null}{error && !picker && !cancelling ? <p role="alert">{error}</p> : null}
    {snapshot.error ? <div role="alert"><p>用户授权操作已保存，权限信息刷新失败：{snapshot.error}</p><Button label="重试权限刷新" isDisabled={snapshot.busy} onClick={() => { void snapshot.refresh(); }} /></div> : null}
    {picker ? <ResourceDialog titleId="role-user-picker-title" busy={busy} onCancel={() => { setPicker(false); setError(''); }}><h2 id="role-user-picker-title">添加角色用户</h2><RoleUserList roleId={roleId} assigned={false} version={0} busy={busy} onAction={ids => { void mutate(ids, true); }} />{error ? <p role="alert">{error}</p> : null}<Button label="关闭选择" variant="secondary" isDisabled={busy} onClick={() => { setPicker(false); setError(''); }} /></ResourceDialog> : null}
    {cancelling ? <ResourceDialog titleId="role-user-cancel-title" alert busy={busy} onCancel={() => { setCancelling(null); setError(''); }}><h2 id="role-user-cancel-title">确认取消授权</h2><p>将取消所选的 {cancelling.length} 个用户的当前角色授权。</p>{error ? <p role="alert">{error}</p> : null}<div className="post-row-actions"><Button label="确认取消授权" isDisabled={busy} onClick={() => { void mutate(cancelling, false); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => { setCancelling(null); setError(''); }} /></div></ResourceDialog> : null}
  </section>;
}
