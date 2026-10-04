import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {DataTable, type ColumnDef} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {MenuResponse, MenuRouteOption} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useAuthorizationRefresh} from '../../app/useAuthorizationRefresh';
import {errorMessage} from '../../integration/errors';
import {menuTree} from './tree';
import {MenuEditor, menuTypeLabels} from './MenuEditor';
import {MenuIcon} from './IconPicker';

const emptyFilters = {name: '', status: '', visible: ''};
type TreeRow = ReturnType<typeof menuTree>[number];
export function MenusPage() {
  const api = useApi(), snapshot = useAuthorizationRefresh();
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters), [showFilters, setShowFilters] = useState(true);
  const [rows, setRows] = useState<MenuResponse[]>([]), [version, setVersion] = useState(0), [collapsed, setCollapsed] = useState<Set<string>>(new Set()), [sorts, setSorts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true), [requestBusy, setBusy] = useState(false), [error, setError] = useState(''), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const [editor, setEditor] = useState<{detail: MenuResponse | null; parentId: string; options: MenuResponse[]; routes: MenuRouteOption[]} | null>(null), [deleting, setDeleting] = useState<MenuResponse | null>(null);
  const request = useRef<AbortController | null>(null); const busy = requestBusy || snapshot.busy;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setRows([]); setSorts({});
    api.listMenus({name: filters.name, status: filters.status, visible: filters.visible ? filters.visible === 'show' : undefined}, controller.signal).then(value => {
      if (!controller.signal.aborted) { menuTree(value); setRows(value); setLoading(false); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false); } });
    return () => controller.abort();
  }, [api, filters, version]);
  const tree = useMemo(() => menuTree(rows, collapsed), [rows, collapsed]);
  function reload(message = '') { setFeedback(message); setSorts({}); setVersion(value => value + 1); }
  async function saved(message: string) { reload(message); await snapshot.refresh(); }
  const openEditor = useCallback(async (id?: string, parentId = '0') => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setActionError(''); setFeedback('');
    try {
      const [detail, options, routes] = await Promise.all([id ? api.getMenu(id, controller.signal) : Promise.resolve(null), api.getMenuOptions(controller.signal, id), api.getMenuRouteOptions(controller.signal)]);
      if (!controller.signal.aborted) { menuTree(options); setEditor({detail, parentId, options, routes}); }
    } catch (cause) { if (!controller.signal.aborted) setActionError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [api]);
  const columns = useMemo<ColumnDef<TreeRow>[]>(() => [
    {id: 'name', header: '菜单名称', cell: ({row}) => <div className="department-name" style={{paddingInlineStart: row.original.depth * 20}}>
      {row.original.hasChildren ? <button type="button" aria-expanded={!collapsed.has(row.original.menu.id)} aria-label={`${collapsed.has(row.original.menu.id) ? '展开' : '折叠'}菜单 ${row.original.menu.name}`} onClick={() => setCollapsed(value => { const next = new Set(value); if (next.has(row.original.menu.id)) next.delete(row.original.menu.id); else next.add(row.original.menu.id); return next; })}>{collapsed.has(row.original.menu.id) ? '▸' : '▾'}</button> : <span className="department-leaf" />}
      <span>{row.original.menu.name}</span></div>},
    {id: 'icon', header: '图标', cell: ({row}) => <MenuIcon name={row.original.menu.icon} />},
    {id: 'sort', header: '显示顺序', cell: ({row}) => <PermissionGate permission="system:menu:edit" fallback={<span>{row.original.menu.sort}</span>}><input type="number" min={0} max={9999} step={1} className="department-sort" aria-label={`排序菜单 ${row.original.menu.name}`} disabled={busy} value={sorts[row.original.menu.id] ?? row.original.menu.sort} onChange={event => setSorts(value => ({...value, [row.original.menu.id]: Number(event.target.value)}))} /></PermissionGate>},
    {id: 'permission', header: '权限标识', cell: ({row}) => row.original.menu.permission || '—'},
    {id: 'type', header: '类型', cell: ({row}) => menuTypeLabels[row.original.menu.type]},
    {id: 'status', header: '状态', cell: ({row}) => <span className={`post-status status-${row.original.menu.status}`}>{row.original.menu.status === '0' ? '正常' : '停用'}</span>},
    {id: 'visible', header: '显示', cell: ({row}) => row.original.menu.visible ? '显示' : '隐藏'},
    {id: 'createdAt', header: '创建时间', cell: ({row}) => row.original.menu.createdAt ? new Date(row.original.menu.createdAt).toLocaleString('zh-CN') : '—'},
    {id: 'actions', header: '操作', cell: ({row}) => <div className="post-row-actions">
      <PermissionGate permission="system:menu:edit"><Button label="修改" aria-label={`修改菜单 ${row.original.menu.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openEditor(row.original.menu.id); }} /></PermissionGate>
      {['GROUP', 'ROUTE'].includes(row.original.menu.type) ? <PermissionGate permission="system:menu:add"><Button label="新增" aria-label={`新增子菜单 ${row.original.menu.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { void openEditor(undefined, row.original.menu.id); }} /></PermissionGate> : null}
      <PermissionGate permission="system:menu:remove"><Button label="删除" aria-label={`删除菜单 ${row.original.menu.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => { setActionError(''); setDeleting(row.original.menu); }} /></PermissionGate>
    </div>}
  ], [busy, collapsed, openEditor, sorts]);
  async function saveSort() {
    if (busy) return; const items = rows.filter(row => sorts[row.id] !== undefined && sorts[row.id] !== row.sort).map(row => ({id: row.id, sort: sorts[row.id] ?? row.sort}));
    if (!items.length) return;
    if (items.length > 2000 || items.some(item => !Number.isInteger(item.sort) || item.sort < 0 || item.sort > 9999)) { setActionError('显示顺序必须是 0–9999 的整数，每次最多保存 2000 条。'); return; }
    setBusy(true); setActionError('');
    try { await api.sortMenus({items}); await saved('菜单排序已保存。'); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setActionError('');
    try { await api.deleteMenu(deleting.id); setDeleting(null); await saved('菜单已删除。'); }
    catch (cause) { setActionError(errorMessage(cause)); } finally { setBusy(false); }
  }
  function query(event: FormEvent) { event.preventDefault(); setFilters({...draft}); setVersion(value => value + 1); }
  return <section className="posts-page menus-page"><PageHeader title="菜单管理" description="维护目录、页面、外链和按钮权限。" eyebrow="系统管理" />
    <form hidden={!showFilters} className="post-filters" onSubmit={query}><Input label="菜单名称筛选" value={draft.name} onChange={name => setDraft({...draft, name})} />
      <label>菜单状态筛选<select aria-label="菜单状态筛选" value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="">全部</option><option value="0">正常</option><option value="1">停用</option></select></label>
      <label>显示状态筛选<select aria-label="显示状态筛选" value={draft.visible} onChange={event => setDraft({...draft, visible: event.target.value})}><option value="">全部</option><option value="show">显示</option><option value="hide">隐藏</option></select></label>
      <Button label="查询" type="submit" /><Button label="重置" variant="secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setVersion(value => value + 1); }} /></form>
    <div className="post-toolbar"><PermissionGate permission="system:menu:add"><Button label="新增菜单" isDisabled={busy} onClick={() => { void openEditor(); }} /></PermissionGate>
      <PermissionGate permission="system:menu:edit"><Button label="保存菜单排序" variant="secondary" isDisabled={busy || !rows.some(row => sorts[row.id] !== undefined && sorts[row.id] !== row.sort)} onClick={() => { void saveSort(); }} /></PermissionGate>
      <Button label={collapsed.size ? '展开全部菜单' : '折叠全部菜单'} variant="secondary" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(rows.map(row => row.id)))} />
      <Button label="刷新列表" variant="ghost" isDisabled={busy || loading} onClick={() => reload()} /><Button label={showFilters ? '隐藏筛选' : '显示筛选'} variant="ghost" onClick={() => setShowFilters(value => !value)} /></div>
    {feedback ? <p role="status">{feedback}</p> : null}{snapshot.error ? <div role="alert"><p>菜单操作已保存，权限信息刷新失败：{snapshot.error}</p><Button label="重试权限刷新" isDisabled={snapshot.busy} onClick={() => { void snapshot.refresh(); }} /></div> : null}
    {error ? <div role="alert"><p>{error}</p><Button label="重试列表" onClick={() => reload()} /></div> : null}{actionError && !deleting ? <p role="alert">{actionError}</p> : null}
    <div className="post-table"><DataTable data={tree} columns={columns} loading={loading} emptyText="暂无菜单" pagination={false} sortable={false} showColumnVisibility={false} getRowId={row => row.menu.id} /></div>
    {editor ? <MenuEditor {...editor} onClose={() => setEditor(null)} onSaved={() => saved('菜单已保存。')} /> : null}
    {deleting ? <ResourceDialog titleId="menu-delete-title" busy={busy} onCancel={() => { setDeleting(null); setActionError(''); }}><h2 id="menu-delete-title">确认删除菜单</h2><p>确定删除「{deleting.name}」？</p>{actionError ? <p role="alert">{actionError}</p> : null}<div className="post-row-actions"><Button label="确认删除" isDisabled={busy} onClick={() => { void remove(); }} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => { setDeleting(null); setActionError(''); }} /></div></ResourceDialog> : null}
  </section>;
}
