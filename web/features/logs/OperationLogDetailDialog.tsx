import {useEffect, useState} from 'react';
import {Button} from '@eforge/ui';
import type {OperationLogDetail} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDictionary, DictionaryNotice} from '../../app/useDictionary';
import {DictionaryTag} from '../../app/components/DictionaryTag';
import {errorMessage} from '../../integration/errors';

export function formatLogJson(value?: string) {
  if (!value) return '（无数据）';
  try {return JSON.stringify(JSON.parse(value), null, 2);} catch {return value;}
}
async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(value); return;}
  const previous = document.activeElement, field = document.createElement('textarea');
  field.value = value; field.style.position = 'fixed'; field.style.left = '-10000px'; document.body.append(field);
  try {field.select(); if (!document.execCommand('copy')) throw new Error('Copy unavailable.');}
  finally {field.remove(); if (previous instanceof HTMLElement) previous.focus();}
}
function LogPayload({title, value}: {title: string; value?: string}) {
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const text = formatLogJson(value);
  async function copy() {
    setMessage(''); setError('');
    try {await copyText(text); setMessage('已复制。');} catch {setError('复制未完成，请选择下方文本手动复制。');}
  }
  return <section className="log-payload"><div><h3>{title}</h3><Button label={`复制${title}`} variant="ghost" size="sm" onClick={() => {void copy();}} /></div><pre tabIndex={0} aria-label={title}>{text}</pre>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</section>;
}
export function OperationLogDetailDialog({id, onClose}: {id: string; onClose: () => void}) {
  const api = useApi(), types = useDictionary('sys_oper_type'), statuses = useDictionary('sys_common_status');
  const [row, setRow] = useState<OperationLogDetail | null>(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setRow(null); setError('');
    api.getOperationLog(id, controller.signal).then(value => {if (!controller.signal.aborted) setRow(value);}).catch(cause => {if (!controller.signal.aborted) setError(errorMessage(cause));});
    return () => controller.abort();
  }, [api, id, version]);
  return <ResourceDialog titleId="log-detail-title" busy={false} onCancel={onClose}><h2 id="log-detail-title">操作日志详细</h2>
    <DictionaryNotice dictionary={types} /><DictionaryNotice dictionary={statuses} />
    {error ? <><p role="alert">{error}</p><Button label="重试详情" onClick={() => setVersion(value => value + 1)} /></> : !row ? <p role="status">正在加载日志…</p> : <>
      <dl className="log-metadata"><dt>操作模块</dt><dd>{row.entry.title}</dd><dt>业务类型</dt><dd><DictionaryTag options={types.options} value={row.entry.businessType?.toString() ?? ''} /></dd>
        <dt>操作时间</dt><dd>{row.entry.operatedAt ? new Date(row.entry.operatedAt).toLocaleString('zh-CN') : '—'}</dd><dt>执行状态</dt><dd><DictionaryTag options={statuses.options} value={row.entry.status ?? ''} /></dd>
        <dt>操作人员</dt><dd>{row.entry.operator || '—'}</dd><dt>所属部门</dt><dd>{row.departmentName || '—'}</dd><dt>操作地址</dt><dd>{row.entry.ip || '—'} {row.entry.location}</dd>
        <dt>请求地址</dt><dd><code>{row.requestMethod}</code> {row.url || '—'}</dd><dt>操作方法</dt><dd><code>{row.method || '—'}</code></dd><dt>消耗时间</dt><dd>{row.entry.duration ?? 0} 毫秒</dd>
      </dl><LogPayload title="请求参数" value={row.requestParameters} /><LogPayload title="返回参数" value={row.responseBody} />
      {row.entry.status !== '0' && <section className="log-payload"><h3>异常信息</h3><pre tabIndex={0} aria-label="异常信息">{row.errorMessage || '（无数据）'}</pre></section>}
    </>}
    <div className="post-row-actions"><Button label="关闭详情" variant="ghost" onClick={onClose} /></div>
  </ResourceDialog>;
}
