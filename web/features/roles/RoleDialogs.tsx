import {NativeInput, Select, TextareaControl} from '../../ui/native';
import {PageForm} from '../../ui/FormPage';
import {DictionaryOptions} from '../../app/useDictionary';
import type {DictionaryValueOption} from '../../generated/api';
import {useMemo, useState, type FormEvent} from 'react';
import {Button, Input} from '../../ui/controls';
import type {RoleEditorResponse, RoleMenuOption, RoleScopeResponse, RoleWriteRequest} from '../../generated/api';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {GrantTree} from './GrantTree';
import {linkedSeeds, submittedGrants, type GrantNode} from './grants';
import {useDiscardChanges, usePageDraft} from '../../app/useDraftProtection';

function sameSelection(left: string[], right: string[]) { return left.length === right.length && left.every(key => right.includes(key)); }

export function RoleEditor({statusOptions, detail, menus, onClose, onSaved}: {statusOptions: DictionaryValueOption[]; detail: RoleEditorResponse | null; menus: RoleMenuOption[]; onClose: () => void; onSaved: () => Promise<void>}) {
  const api = useApi();
  const [form, setForm] = useState<RoleWriteRequest>(() => detail ? {name: detail.role.name, key: detail.role.key, sort: detail.role.sort, status: detail.role.status, remark: detail.role.remark ?? '', menuLinked: detail.role.menuLinked, menuKeys: detail.role.menuLinked ? linkedSeeds(menus, [...new Set([...detail.checkedMenuKeys, ...detail.menuKeys.filter(key => !menus.some(node => node.key === key))])]) : detail.menuKeys}
    : {name: '', key: '', sort: 0, status: '0', remark: '', menuLinked: true, menuKeys: []});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selectionDirty, setSelectionDirty] = useState(false);
  const value = JSON.stringify({...form, menuKeys: [...form.menuKeys].sort()});
  const [initial] = useState(value);
  const draft = usePageDraft(value !== initial), discard = useDiscardChanges(value !== initial, busy);
  function close() {draft.setDirty(false); onClose();}
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!form.name.trim() || form.name.length > 30 || !form.key.trim() || form.key.length > 100 || !Number.isInteger(form.sort) || form.sort < 0 || form.sort > 9999 || (form.remark?.length ?? 0) > 500) { setError('请检查角色名称（最多 30 字符）、权限字符（最多 100 字符）和显示顺序（0–9999）。'); return; }
    setBusy(true); setError(''); const finishSave = draft.beginSave();
    try {
      const original = detail ? (form.menuLinked ? linkedSeeds(menus, detail.menuKeys) : detail.menuKeys) : [];
      const menuKeys = detail && (!selectionDirty || sameSelection(form.menuKeys, original)) ? detail.menuKeys : submittedGrants(menus, form.menuKeys, form.menuLinked);
      const request = {...form, menuKeys};
      if (detail) await api.updateRole(detail.role.id, request); else await api.createRole(request);
      close(); await onSaved();
    } catch (cause) { setError(errorMessage(cause)); } finally { finishSave(); setBusy(false); }
  }
  return <><ResourceDialog titleId="role-editor-title" busy={busy} onCancel={() => discard.confirm(close)}><h2 id="role-editor-title">{detail ? '修改角色' : '新增角色'}</h2><PageForm onSubmit={event => { void save(event); }}>
    <Input label="角色名称" value={form.name} aria-required="true" isDisabled={busy} onChange={name => setForm({...form, name})} />
    <Input label="权限字符" value={form.key} aria-required="true" isDisabled={busy} onChange={key => setForm({...form, key})} />
    <label>角色顺序<NativeInput type="number" min={0} max={9999} required disabled={busy} value={form.sort} onChange={event => setForm({...form, sort: Number(event.target.value)})} /></label>
    <label>角色状态<Select aria-label="角色状态" disabled={busy} value={form.status} onChange={event => setForm({...form, status: event.target.value})}><DictionaryOptions options={statusOptions} current={form.status} /></Select></label>
    <GrantTree label="菜单权限" kind="菜单" nodes={menus} selected={form.menuKeys} linked={form.menuLinked} disabled={busy}
      onChange={menuKeys => { setSelectionDirty(true); setForm({...form, menuKeys}); }} onLinkedChange={(menuLinked, keys) => {
        const menuKeys = detail && !selectionDirty ? (menuLinked ? linkedSeeds(menus, detail.menuKeys) : detail.menuKeys) : keys;
        setForm({...form, menuLinked, menuKeys});
      }} />
    <label>备注<TextareaControl aria-label="备注" maxLength={500} disabled={busy} value={form.remark ?? ''} onChange={event => setForm({...form, remark: event.target.value})} /></label>
    {error ? <p role="alert">{error}</p> : null}<div className="post-row-actions"><Button label={busy ? '正在保存…' : '保存角色'} type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => discard.confirm(close)} /></div>
  </PageForm></ResourceDialog>{discard.dialog}</>;
}
export function RoleScopeDialog({id, name, snapshot, onClose, onSaved}: {id: string; name: string; snapshot: RoleScopeResponse; onClose: () => void; onSaved: () => Promise<void>}) {
  const api = useApi();
  const nodes = useMemo<GrantNode[]>(() => snapshot.departments.map(department => ({key: department.id, parentKey: department.parentId, label: department.name, status: department.status})), [snapshot.departments]);
  const [mode, setMode] = useState(snapshot.mode), [linked, setLinked] = useState(snapshot.departmentLinked);
  const [selected, setSelected] = useState(() => snapshot.departmentLinked ? linkedSeeds(nodes, [...new Set([...snapshot.checkedDepartmentIds, ...snapshot.departmentIds.filter(key => !nodes.some(node => node.key === key))])]) : snapshot.departmentIds);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selectionDirty, setSelectionDirty] = useState(false);
  const value = JSON.stringify({mode, linked, selected: [...selected].sort()});
  const [initial] = useState(value);
  const draft = usePageDraft(value !== initial), discard = useDiscardChanges(value !== initial, busy);
  function close() {draft.setDirty(false); onClose();}
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); const finishSave = draft.beginSave();
    try {
      const original = linked ? linkedSeeds(nodes, snapshot.departmentIds) : snapshot.departmentIds;
      const departmentIds = mode !== '2' ? [] : !selectionDirty || sameSelection(selected, original) ? snapshot.departmentIds : submittedGrants(nodes, selected, linked);
      await api.setRoleDataScope(id, {mode, departmentLinked: linked, departmentIds}); close(); await onSaved();
    }
    catch (cause) { setError(errorMessage(cause)); } finally { finishSave(); setBusy(false); }
  }
  return <><ResourceDialog titleId="role-scope-title" busy={busy} onCancel={() => discard.confirm(close)}><h2 id="role-scope-title">分配数据权限</h2><p>角色：{name}</p><PageForm onSubmit={event => { void save(event); }}>
    <label>权限范围<Select aria-label="权限范围" value={mode} disabled={busy} onChange={event => { setMode(event.target.value); if (event.target.value !== '2') { setSelected([]); setSelectionDirty(true); } }}>
      <option value="1">全部数据权限</option><option value="2">自定数据权限</option><option value="3">本部门数据权限</option><option value="4">本部门及以下数据权限</option><option value="5">仅本人数据权限</option>
    </Select></label>{mode === '2' ? <GrantTree label="数据权限" kind="部门" nodes={nodes} selected={selected} linked={linked} disabled={busy} initiallyExpanded
      onChange={keys => { setSelectionDirty(true); setSelected(keys); }} onLinkedChange={(next, keys) => {
        setLinked(next); setSelected(!selectionDirty ? (next ? linkedSeeds(nodes, snapshot.departmentIds) : snapshot.departmentIds) : keys);
      }} /> : null}
    {error ? <p role="alert">{error}</p> : null}<div className="post-row-actions"><Button label="保存数据权限" type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={() => discard.confirm(close)} /></div>
  </PageForm></ResourceDialog>{discard.dialog}</>;
}
