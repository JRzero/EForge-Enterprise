import {useState, type FormEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import type {DictionaryRequest, EntryRequest, DictionaryValueOption} from '../../generated/api';
import {errorMessage} from '../../integration/errors';
export type DictionaryEditorState = {kind: 'type'; id?: string; form: DictionaryRequest} | {kind: 'entry'; id?: string; form: EntryRequest};
export function DictionaryEditor({initial, statusOptions, code, onClose, onSaved}: {initial: DictionaryEditorState; statusOptions: DictionaryValueOption[]; code?: string; onClose: () => void; onSaved: () => void}) {
  const api = useApi(), [state, setState] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function shared(patch: Partial<Pick<DictionaryRequest, 'status' | 'remark'>>) {setState(previous => previous.kind === 'type' ? {...previous, form: {...previous.form, ...patch}} : {...previous, form: {...previous.form, ...patch}});}
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const form = state.form;
    const valid = (form.remark?.length ?? 0) <= 500 && ['0', '1'].includes(form.status) && (state.kind === 'type'
      ? !!state.form.name.trim() && state.form.name.length <= 100 && /^[a-z][a-z0-9_]*$/.test(state.form.code) && state.form.code.length <= 100
      : !!state.form.label.trim() && state.form.label.length <= 100 && !!state.form.value.trim() && state.form.value.length <= 100 && Number.isInteger(state.form.sort) && state.form.sort >= 0 && state.form.sort <= 2147483647 && (state.form.cssClass?.length ?? 0) <= 100 && /^[a-zA-Z0-9_\- ]*$/.test(state.form.cssClass ?? ''));
    if (!valid) {setError('请检查名称或标签、字典标识或键值、顺序、样式属性和备注。'); return;}
    setBusy(true); setError('');
    try {
      if (state.kind === 'type') {if (state.id) await api.updateDictionary(state.id, state.form); else await api.createDictionary(state.form);}
      else {if (state.id) await api.updateDictionaryEntry(state.id, state.form); else await api.createDictionaryEntry(state.form);}
      onClose(); onSaved();
    } catch (cause) {setError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <ResourceDialog titleId="dictionary-editor-title" busy={busy} onCancel={onClose}><h2 id="dictionary-editor-title">{state.id ? '修改' : '新增'}字典{state.kind === 'type' ? '类型' : '数据'}</h2><form noValidate onSubmit={event => {void save(event);}}>
    {state.kind === 'type' ? <><Input label="字典名称" value={state.form.name} isDisabled={busy} aria-required="true" onChange={name => setState({...state, form: {...state.form, name}})} />
      <Input label="字典类型标识" value={state.form.code} isDisabled={busy} aria-required="true" onChange={code => setState({...state, form: {...state.form, code}})} /></> : <>
      <p>字典类型：{code}</p><Input label="数据标签" value={state.form.label} isDisabled={busy} aria-required="true" onChange={label => setState({...state, form: {...state.form, label}})} />
      <Input label="数据键值" value={state.form.value} isDisabled={busy} aria-required="true" onChange={value => setState({...state, form: {...state.form, value}})} />
      <Input label="样式属性" value={state.form.cssClass ?? ''} isDisabled={busy} onChange={cssClass => setState({...state, form: {...state.form, cssClass}})} />
      <label>显示顺序<input type="number" min={0} max={2147483647} step={1} value={state.form.sort} disabled={busy} onChange={event => setState({...state, form: {...state.form, sort: Number(event.target.value)}})} /></label>
      <label>回显样式<select aria-label="回显样式" value={state.form.style} disabled={busy} onChange={event => setState({...state, form: {...state.form, style: event.target.value as EntryRequest['style']}})}>{Object.entries({DEFAULT: '默认', PRIMARY: '主要', SUCCESS: '成功', INFO: '信息', WARNING: '警告', DANGER: '危险'}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><input type="checkbox" checked={state.form.defaultEntry} disabled={busy} onChange={event => setState({...state, form: {...state.form, defaultEntry: event.target.checked}})} />默认项</label>
    </>}
    <label>字典状态<select aria-label="字典状态" value={state.form.status} disabled={busy} onChange={event => shared({status: event.target.value})}>
      {!statusOptions.some(option => option.value === state.form.status) ? <option value={state.form.status}>{state.form.status}</option> : null}{statusOptions.map((option, index) => <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>)}</select></label>
    <label>备注<textarea aria-label="备注" value={state.form.remark ?? ''} maxLength={500} disabled={busy} onChange={event => shared({remark: event.target.value})} /></label>
    {error ? <p role="alert">{error}</p> : null}<div className="post-row-actions"><Button label="保存字典" type="submit" isDisabled={busy} /><Button label="取消" variant="secondary" isDisabled={busy} onClick={onClose} /></div>
  </form></ResourceDialog>;
}
