import {useEffect, useState} from 'react';
import {Button} from '../../ui/controls';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {errorMessage} from '../../integration/errors';
import type {DictionaryEntryResponse, DictionaryTypeOption, DictionaryValueOption} from '../../generated/api';
import {dictionaryPreview, DictionaryPreviewChangedError} from './preview';
export function DictionaryPreview({type, statusOptions, onClose}: {type: DictionaryTypeOption; statusOptions: DictionaryValueOption[]; onClose: () => void}) {
  const api = useApi(), [rows, setRows] = useState<DictionaryEntryResponse[] | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setRows(null); setError('');
    dictionaryPreview(page => api.listDictionaryEntries(type.id, {page, pageSize: 100}, controller.signal), controller.signal)
      .then(value => {if (!controller.signal.aborted) setRows(value);}).catch(cause => {if (!controller.signal.aborted) setError(cause instanceof DictionaryPreviewChangedError ? cause.message : errorMessage(cause));});
    return () => controller.abort();
  }, [api, type.id, version]);
  return <ResourceDialog titleId="dictionary-preview-title" busy={false} onCancel={onClose}><h2 id="dictionary-preview-title">字典预览：{type.name}</h2><p>{type.code}</p>
    {error ? <div role="alert"><p>{error}</p><Button label="重试预览" onClick={() => setVersion(value => value + 1)} /></div> : rows ? <>
      <p role="status">共计 {rows.length} 条，正常 {rows.filter(row => row.status === '0').length} 条，停用 {rows.filter(row => row.status === '1').length} 条</p>
      {!rows.length ? <p>暂无字典数据</p> : <dl className="dictionary-preview-items">{rows.map(row => <div key={row.id}><dt>标签</dt><dd><DictionaryTag options={[row]} value={[row.value]} /></dd><dt>键值</dt><dd>{row.value}</dd><dt>状态</dt><dd><DictionaryTag options={statusOptions} value={row.status} /></dd></div>)}</dl>}
    </> : <p role="status">正在加载预览…</p>}
    <Button label="关闭预览" variant="secondary" onClick={onClose} /></ResourceDialog>;
}
