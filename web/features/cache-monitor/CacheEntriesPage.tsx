import {useCallback, useEffect, useMemo, useState} from 'react';
import {DataTable, type ColumnDef} from '../../ui/data';
import {PageHeader} from '../../ui/patterns';
import {Button, Input} from '../../ui/controls';
import type {CacheName, CacheValue} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {useRetainedRead} from '../../app/useRetainedRead';
type ClearAction = {type: 'key'; name: string; key: string} | {type: 'name'; name: string} | {type: 'all'};
export function CacheEntriesPage() {
  const api = useApi(); const [names, setNames] = useState<CacheName[]>([]), [keys, setKeys] = useState<string[]>([]), [value, setValue] = useState<CacheValue | null>(null);
  const [name, setName] = useState(''), [key, setKey] = useState('');
  const [namesVersion, setNamesVersion] = useState(0), [keysVersion, setKeysVersion] = useState(0), [valueVersion, setValueVersion] = useState(0);
  const [namesLoading, setNamesLoading] = useState(true), [keysLoading, setKeysLoading] = useState(false), [valueLoading, setValueLoading] = useState(false);
  const [namesError, setNamesError] = useState(''), [keysError, setKeysError] = useState(''), [valueError, setValueError] = useState('');
  const [action, setAction] = useState<ClearAction | null>(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [feedback, setFeedback] = useState('');
  const namesRead = useRetainedRead(), keysRead = useRetainedRead(), valueRead = useRetainedRead();
  useEffect(() => {
    const complete = namesRead([api, namesVersion]); if (!complete) return;
    const controller = new AbortController(); setNamesLoading(true); setNamesError(''); setNames([]);
    api.listCacheNames(controller.signal).then(result => {if (!controller.signal.aborted) {setNames(result); setNamesLoading(false); setName(current => result.some(item => item.name === current) ? current : ''); complete();}})
      .catch(cause => {if (!controller.signal.aborted) {setNamesError(errorMessage(cause)); setNamesLoading(false); complete();}});
    return () => controller.abort();
  }, [api, namesVersion, namesRead]);
  useEffect(() => {
    const complete = keysRead([api, name, keysVersion]); if (!complete) return;
    const controller = new AbortController(); setKeys([]); setKeysError(''); setKeysLoading(!!name);
    if (!name) complete();
    if (name) api.listCacheKeys(name, controller.signal).then(result => {if (!controller.signal.aborted) {setKeys(result); setKeysLoading(false); setKey(current => result.includes(current) ? current : ''); complete();}})
      .catch(cause => {if (!controller.signal.aborted) {setKeysError(errorMessage(cause)); setKeysLoading(false); complete();}});
    return () => controller.abort();
  }, [api, name, keysVersion, keysRead]);
  useEffect(() => {
    const complete = valueRead([api, name, key, valueVersion, keysVersion]); if (!complete) return;
    const controller = new AbortController(); setValue(null); setValueError(''); const selected = !!name && !!key && key.startsWith(name); setValueLoading(selected);
    if (!selected) complete();
    if (selected) api.getCacheValue(name, key, controller.signal).then(result => {if (!controller.signal.aborted) {setValue(result); setValueLoading(false); complete();}})
      .catch(cause => {if (!controller.signal.aborted) {setValueError(errorMessage(cause)); setValueLoading(false); complete();}});
    return () => controller.abort();
  }, [api, name, key, valueVersion, keysVersion, valueRead]);
  const selectName = useCallback((next: string) => {setName(next); setKey(''); setValue(null); setFeedback(''); setKeysVersion(version => version + 1);}, []);
  const confirm = useCallback((next: ClearAction) => {setAction(next); setActionError(''); setFeedback('');}, []);
  const nameColumns = useMemo<ColumnDef<CacheName>[]>(() => [
    {id: 'index', header: '序号', cell: ({row}) => row.index + 1},
    {accessorKey: 'name', header: '缓存名称', cell: ({row}) => <Button label={row.original.name.replace(':', '')} aria-label={`查看缓存 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => selectName(row.original.name)} />},
    {accessorKey: 'description', header: '备注'}, {id: 'actions', header: '操作', cell: ({row}) => <Button label="清理" aria-label={`清理类别 ${row.original.name}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => confirm({type: 'name', name: row.original.name})} />}
  ], [busy, selectName, confirm]);
  const keyColumns = useMemo<ColumnDef<{key: string}>[]>(() => [
    {id: 'index', header: '序号', cell: ({row}) => row.index + 1},
    {accessorKey: 'key', header: '缓存键名', cell: ({row}) => <span title={row.original.key}><Button label={row.original.key.slice(name.length) || row.original.key} aria-label={`查看键 ${row.original.key}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => {setKey(row.original.key); setValueVersion(version => version + 1); setFeedback('');}} /></span>},
    {id: 'actions', header: '操作', cell: ({row}) => <Button label="清理" aria-label={`清理键 ${row.original.key}`} variant="ghost" size="sm" isDisabled={busy} onClick={() => confirm({type: 'key', name, key: row.original.key})} />}
  ], [name, busy, confirm]);
  async function clear() {
    if (!action || busy) return; setBusy(true); setActionError('');
    try {
      if (action.type === 'all') await api.clearAllCache(); else if (action.type === 'name') await api.clearCacheName(action.name); else await api.clearCacheKey({name: action.name, key: action.key});
      setFeedback(action.type === 'all' ? '全部缓存已清理。' : action.type === 'name' ? `缓存类别 ${action.name} 已清理。` : `缓存键 ${action.key} 已清理。`);
      setKey(''); setValue(null); setAction(null); setKeysVersion(version => version + 1);
      // Reloads revalidate authentication: the selected namespace/key may be this session.
      setNamesVersion(version => version + 1);
    } catch (cause) {setActionError(errorMessage(cause));} finally {setBusy(false);}
  }
  return <section className="cache-entries-page"><PageHeader title="缓存列表" description="按缓存类别查看键与内容，清理所选缓存。" />
    {feedback && <p role="status">{feedback}</p>}
    <div className="cache-entries-grid">
      <section className="server-card" aria-labelledby="cache-names-title"><div className="cache-panel-header"><h2 id="cache-names-title">缓存名称</h2><Button label="刷新名称" variant="ghost" isDisabled={namesLoading || busy} onClick={() => setNamesVersion(version => version + 1)} /></div>
        {namesError ? <><p role="alert">{namesError}</p><Button label="重试名称" onClick={() => setNamesVersion(version => version + 1)} /></> : <div className="post-table cache-list-table"><DataTable columns={nameColumns} data={names} getRowId={row => row.name} loading={namesLoading} pagination={false} showColumnVisibility={false} emptyText="暂无缓存类别" /></div>}
      </section>
      <section className="server-card" aria-labelledby="cache-keys-title"><div className="cache-panel-header"><h2 id="cache-keys-title">键名列表</h2><Button label="刷新键名" variant="ghost" isDisabled={!name || keysLoading || busy} onClick={() => setKeysVersion(version => version + 1)} /></div>
        {name ? <><p>当前缓存：{name.replace(':', '')}</p>{keysError ? <><p role="alert">{keysError}</p><Button label="重试键名" onClick={() => setKeysVersion(version => version + 1)} /></> : <div className="post-table cache-list-table"><DataTable columns={keyColumns} data={keys.map(key => ({key}))} getRowId={row => row.key} loading={keysLoading} pagination={false} showColumnVisibility={false} emptyText="暂无缓存键" /></div>}</> : <p>请选择缓存名称。</p>}
      </section>
      <section className="server-card" aria-labelledby="cache-value-title"><div className="cache-panel-header"><h2 id="cache-value-title">缓存内容</h2><Button label="清理全部" variant="secondary" isDisabled={busy} onClick={() => confirm({type: 'all'})} /></div>
        <Input label="缓存名称" value={name.replace(':', '')} isReadOnly /><Input label="缓存键名" value={key.startsWith(name) ? key.slice(name.length) : ''} isReadOnly />
        {valueLoading && <p role="status">正在加载缓存内容…</p>}{valueError && <><p role="alert">{valueError}</p><Button label="重试内容" onClick={() => setValueVersion(version => version + 1)} /></>}
        {value ? <pre aria-label="缓存值" className="cache-value">{value.value}</pre> : !valueLoading && !valueError ? <p>请选择缓存键。</p> : null}
        <Button label="刷新内容" variant="ghost" isDisabled={!key || valueLoading || busy} onClick={() => setValueVersion(version => version + 1)} />
      </section>
    </div>
    {action && <ResourceDialog titleId="cache-clear-title" alert busy={busy} onCancel={() => setAction(null)}><h2 id="cache-clear-title">确认清理缓存</h2>
      {action.type === 'all' ? <p>清理全部缓存？这会移除所有缓存键和所有登录会话，包括当前会话，需要重新登录。</p> : action.type === 'name' ? <p>清理缓存类别 {action.name} 中的全部键？{action.name === 'login_tokens:' && '这会移除所有登录会话，包括当前会话，需要重新登录。'}</p> : <p>清理缓存键 {action.key}？{action.name === 'login_tokens:' && '对应登录会话将失效；清理当前会话后需要重新登录。'}</p>}
      {actionError && <p role="alert">{actionError}</p>}<div className="post-row-actions"><Button label="取消" variant="ghost" isDisabled={busy} onClick={() => setAction(null)} /><Button label="确认清理" variant="secondary" isDisabled={busy} onClick={() => {void clear();}} /></div>
    </ResourceDialog>}
  </section>;
}
