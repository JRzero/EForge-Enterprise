import {useMemo, useState, type FormEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import type {MenuResponse, MenuRouteOption, MenuWriteRequest} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {menuParents} from './tree';
import {IconPicker} from './IconPicker';

export const menuTypeLabels = {GROUP: '目录', ROUTE: '菜单', EXTERNAL: '外链', FUNCTION: '按钮'};
export function MenuEditor({detail, parentId, options, routes, onClose, onSaved}: {detail: MenuResponse | null; parentId: string; options: MenuResponse[]; routes: MenuRouteOption[]; onClose: () => void; onSaved: () => Promise<void>}) {
  const api = useApi(); const [form, setForm] = useState<MenuWriteRequest>(() => detail ? {key: detail.key ?? '', name: detail.name, parentId: detail.parentId, sort: detail.sort, type: detail.type, status: detail.status, visible: detail.visible, routeId: detail.routeId ?? '', externalUrl: detail.externalUrl ?? '', permission: detail.permission ?? '', icon: detail.icon ?? '', remark: detail.remark ?? '', groupPath: detail.groupPath ?? '', queryText: detail.queryText ?? '', cached: detail.cached}
    : {key: '', name: '', parentId, sort: 0, type: 'GROUP', status: '0', visible: true, groupPath: '', cached: true, permission: '', icon: '', remark: '', queryText: ''});
  const [search, setSearch] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const parents = useMemo(() => menuParents(options, detail?.id), [options, detail?.id]);
  const filtered = parents.filter(row => row.path.toLowerCase().includes(search.trim().toLowerCase()) || row.menu.id === form.parentId);
  function changeType(type: MenuWriteRequest['type']) {
    const routeId = type === 'ROUTE' ? form.routeId ?? '' : '';
    setForm({...form, type, routeId, externalUrl: type === 'EXTERNAL' ? form.externalUrl ?? '' : '', groupPath: type === 'GROUP' ? form.groupPath || form.key : ''});
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const route = routes.find(route => route.id === form.routeId);
    let valid = !!form.name.trim() && form.name.length <= 50 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(form.key) && form.key.length <= 100 && !!form.parentId && Number.isInteger(form.sort) && form.sort >= 0 && form.sort <= 9999 && (form.permission?.length ?? 0) <= 100 && (form.icon?.length ?? 0) <= 100 && (form.remark?.length ?? 0) <= 500 && (form.queryText?.length ?? 0) <= 255;
    if (form.type === 'GROUP') valid &&= /^[a-zA-Z0-9_-]{1,200}$/.test(form.groupPath ?? '');
    if (form.type === 'ROUTE') valid &&= !!route || !!detail && detail.type === 'ROUTE' && !detail.routeId && !form.routeId;
    if (form.type === 'EXTERNAL') {
      try { const url = new URL(form.externalUrl ?? ''); valid &&= ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password && (form.externalUrl?.length ?? 0) <= 200; } catch { valid = false; }
    }
    if (!valid) { setError('请检查菜单名称、稳定标识、上级菜单、显示顺序和关联页面或地址。'); return; }
    const request = {...form, routeId: form.type === 'ROUTE' ? form.routeId || undefined : undefined, externalUrl: form.type === 'EXTERNAL' ? form.externalUrl : undefined, groupPath: form.type === 'GROUP' ? form.groupPath : undefined, permission: form.type === 'ROUTE' && route ? route.permission ?? '' : form.permission};
    setBusy(true); setError('');
    try { if (detail) await api.updateMenu(detail.id, request); else await api.createMenu(request); onClose(); await onSaved(); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <ResourceDialog titleId="menu-editor-title" busy={busy} onCancel={onClose}><h2 id="menu-editor-title">{detail ? '修改菜单' : '新增菜单'}</h2><form noValidate onSubmit={event => { void save(event); }}>
    <Input label="查找上级菜单" value={search} isDisabled={busy} onChange={setSearch} />
    <label>上级菜单<select aria-label="上级菜单" value={form.parentId} disabled={busy} onChange={event => setForm({...form, parentId: event.target.value})}><option value="0">顶级菜单</option>
      {form.parentId !== '0' && !parents.some(row => row.menu.id === form.parentId) ? <option value={form.parentId}>当前上级菜单</option> : null}
      {filtered.map(row => <option key={row.menu.id} value={row.menu.id}>{row.path}</option>)}</select></label>
    <label>菜单类型<select aria-label="菜单类型" value={form.type} disabled={busy} onChange={event => changeType(event.target.value as MenuWriteRequest['type'])}>{Object.entries(menuTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Input label="菜单名称" value={form.name} aria-required="true" isDisabled={busy} onChange={name => setForm({...form, name})} />
    <Input label="稳定标识" value={form.key} aria-required="true" isDisabled={busy || !!detail?.key} onChange={key => setForm({...form, key, groupPath: form.groupPath === form.key ? key : form.groupPath})} />
    <label>显示顺序<input type="number" min={0} max={9999} disabled={busy} value={form.sort} onChange={event => setForm({...form, sort: Number(event.target.value)})} /></label>
    {form.type === 'GROUP' ? <Input label="目录地址" value={form.groupPath ?? ''} isDisabled={busy} onChange={groupPath => setForm({...form, groupPath})} /> : null}
    {form.type === 'ROUTE' ? <><label>关联页面<select aria-label="关联页面" value={form.routeId ?? ''} disabled={busy} onChange={event => { const route = routes.find(route => route.id === event.target.value); setForm({...form, routeId: event.target.value, permission: route?.permission ?? ''}); }}><option value="">{detail?.type === 'ROUTE' && !detail.routeId ? '保留尚未接入的页面' : '请选择页面'}</option>{routes.map(route => <option key={route.id} value={route.id}>{options.find(menu => menu.routeId === route.id)?.name ?? route.path}（{route.path}）</option>)}</select></label>
      <Input label="路由参数" value={form.queryText ?? ''} isDisabled={busy} onChange={queryText => setForm({...form, queryText})} />
      <label>是否缓存<select aria-label="是否缓存" disabled={busy} value={form.cached ? 'yes' : 'no'} onChange={event => setForm({...form, cached: event.target.value === 'yes'})}><option value="yes">缓存</option><option value="no">不缓存</option></select></label></> : null}
    {form.type === 'EXTERNAL' ? <Input label="外链地址" value={form.externalUrl ?? ''} isDisabled={busy} onChange={externalUrl => setForm({...form, externalUrl})} /> : null}
    <Input label="权限标识" value={form.permission ?? ''} isDisabled={busy || form.type === 'ROUTE' && !!form.routeId} onChange={permission => setForm({...form, permission})} />
    {form.type !== 'FUNCTION' ? <><IconPicker value={form.icon ?? ''} disabled={busy} onChange={icon => setForm({...form, icon})} />
      <label>显示状态<select aria-label="显示状态" disabled={busy} value={form.visible ? 'show' : 'hide'} onChange={event => setForm({...form, visible: event.target.value === 'show'})}><option value="show">显示</option><option value="hide">隐藏</option></select></label></> : null}
    <label>菜单状态<select aria-label="菜单状态" disabled={busy} value={form.status} onChange={event => setForm({...form, status: event.target.value})}><option value="0">正常</option><option value="1">停用</option></select></label>
    <label>备注<textarea aria-label="备注" maxLength={500} disabled={busy} value={form.remark ?? ''} onChange={event => setForm({...form, remark: event.target.value})} /></label>
    {error ? <p role="alert">{error}</p> : null}<div className="post-row-actions"><Button label={busy ? '正在保存…' : '保存菜单'} type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={onClose} /></div>
  </form></ResourceDialog>;
}
