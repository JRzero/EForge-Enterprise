import {useEffect, useState, type KeyboardEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useApi} from '../../app/context';
import type {CronPreviewResponse} from '../../generated/api';
import {errorMessage} from '../../integration/errors';
import {cronFields, defaultCron, parseCron, cronToken, cronExpression, replaceCronField, type CronField, type CronMode} from './cron-model';
function fieldToken(field: CronField, index: number) {try {return cronToken(field, index) || '（省略）';} catch {return '（无效）';}}
const modeLabels: Record<CronMode, string> = {every: '每个值', none: '不指定', omit: '省略年份', range: '区间', step: '间隔', list: '指定值', nearest: '最近工作日', last: '本月最后一天', weekdayLast: '本月最后一个星期', nth: '本月第几个星期', custom: '自定义字段'};
export function CronEditor({value, onConfirm, onCancel}: {value: string; onConfirm: (expression: string) => void; onCancel: () => void}) {
  const api = useApi();
  const [expression, setExpression] = useState(value || defaultCron), [fields, setFields] = useState(() => parseCron(value) ?? parseCron(defaultCron)!);
  const [active, setActive] = useState(0), [localError, setLocalError] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true), [preview, setPreview] = useState<{expression: string; result: CronPreviewResponse} | null>(null);
  const normalized = expression.trim().replace(/\s+/g, ' ');
  useEffect(() => {
    const controller = new AbortController(); setPreview(null); setError(''); setLoading(true);
    const timer = setTimeout(() => {
      if (localError) {setLoading(false); return;}
      api.previewJobCron(normalized, controller.signal).then(result => {if (!controller.signal.aborted) {setPreview({expression: normalized, result}); setLoading(false);}})
        .catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false);}});
    }, 350);
    return () => {clearTimeout(timer); controller.abort();};
  }, [api, normalized, localError, version]);
  function editText(next: string) {setExpression(next); setLocalError(''); setPreview(null); setVersion(value => value + 1);}
  function fill() {
    const parsed = parseCron(expression); setPreview(null);
    if (!parsed) {setLocalError('表达式须包含六个字段，或包含年份的七个字段。'); return;}
    setFields(parsed); setLocalError(''); setExpression(normalized); setVersion(value => value + 1);
  }
  function editField(next: CronField) {
    const updated = replaceCronField(fields, active, next); setFields(updated); setPreview(null);
    try {setExpression(cronExpression(updated)); setLocalError(''); setVersion(value => value + 1);} catch (cause) {setLocalError(cause instanceof Error ? cause.message : '字段值无效。');}
  }
  function reset() {setFields(parseCron(defaultCron)!); setActive(0); setExpression(defaultCron); setLocalError(''); setPreview(null); setVersion(value => value + 1);}
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'ArrowRight' ? (index + 1) % 7 : event.key === 'ArrowLeft' ? (index + 6) % 7 : event.key === 'Home' ? 0 : event.key === 'End' ? 6 : null;
    if (target === null) return; event.preventDefault(); setActive(target); (event.currentTarget.parentElement?.children[target] as HTMLButtonElement | undefined)?.focus();
  }
  const valid = !loading && !localError && preview?.expression === normalized;
  return <ResourceDialog titleId="cron-editor-title" busy={false} onCancel={onCancel}><div className="cron-editor"><h2 id="cron-editor-title">Cron表达式编辑</h2><p>确认后返回表达式，不修改任务计划。</p>
    <label>Cron表达式<textarea aria-label="Cron表达式" maxLength={255} value={expression} onChange={event => editText(event.target.value)} /></label><Button label="回填字段" variant="ghost" onClick={fill} />
    <div role="tablist" aria-label="Cron字段">{cronFields.map((field, index) => <button key={field.label} type="button" role="tab" id={`cron-tab-${index}`} aria-controls="cron-field-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => tabKey(event, index)}>{field.label}</button>)}</div>
    <section role="tabpanel" id="cron-field-panel" aria-labelledby={`cron-tab-${active}`}><CronFieldControls index={active} field={fields[active]!} onChange={editField} /></section>
    <dl className="cron-summary">{cronFields.map((field, index) => <div key={field.label}><dt>{field.label}</dt><dd>{fieldToken(fields[index]!, index)}</dd></div>)}</dl>
    {localError && <p role="alert">{localError}</p>}{error && !localError && <><p role="alert">{error}</p><Button label="重试预览" onClick={() => setVersion(value => value + 1)} /></>}
    {loading && !localError && <p role="status">正在计算执行时间…</p>}{preview?.expression === normalized && !localError && <section aria-label="执行时间预览"><h3>最近五次执行时间</h3><p>服务器时区：{preview.result.zone}</p>{preview.result.times.length ? <ol>{preview.result.times.map(instant => <li key={instant}><time dateTime={instant}>{new Intl.DateTimeFormat('zh-CN', {timeZone: preview.result.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).format(new Date(instant))}</time></li>)}</ol> : <p>该有效表达式没有后续执行时间。</p>}</section>}
    <div className="post-row-actions"><Button label="确认表达式" isDisabled={!valid} onClick={() => {if (valid) onConfirm(normalized);}} /><Button label="重置表达式" variant="secondary" onClick={reset} /><Button label="取消" variant="ghost" onClick={onCancel} /></div>
  </div></ResourceDialog>;
}
function CronFieldControls({index, field, onChange}: {index: number; field: CronField; onChange: (next: CronField) => void}) {
  const {label, min, max} = cronFields[index]!, modes: CronMode[] = ['every', 'range', 'step', 'list'];
  if (index === 3) modes.push('none', 'nearest', 'last'); if (index === 5) modes.push('none', 'nth', 'weekdayLast'); if (index === 6) modes.unshift('omit'); modes.push('custom');
  const numeric = (key: 'start' | 'end' | 'interval' | 'ordinal', caption: string, lower: number = min, upper: number = max) => <label>{caption}<input type="number" aria-label={`${label}${caption}`} min={lower} max={upper} value={Number.isNaN(field[key]) ? '' : field[key]} onChange={event => onChange({...field, [key]: event.target.value === '' ? NaN : Number(event.target.value)})} /></label>;
  return <fieldset><legend>{label}字段</legend><label>模式<select aria-label={`${label}模式`} value={field.mode} onChange={event => onChange({...field, mode: event.target.value as CronMode})}>{modes.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
    {['range', 'step', 'nearest', 'weekdayLast', 'nth'].includes(field.mode) && numeric('start', field.mode === 'nearest' ? '日期' : field.mode === 'weekdayLast' || field.mode === 'nth' ? '星期' : '开始值')}
    {field.mode === 'range' && numeric('end', '结束值')}{field.mode === 'step' && numeric('interval', '间隔值', 1, max - min + 1)}{field.mode === 'nth' && numeric('ordinal', '序号', 1, 5)}
    {field.mode === 'list' && <div className="cron-values" role="group" aria-label={`${label}指定值`}>{Array.from({length: max - min + 1}, (_, offset) => offset + min).map(value => <label key={value}><input type="checkbox" aria-label={`${label}取值 ${value}`} checked={field.values.includes(value)} onChange={event => onChange({...field, values: event.target.checked ? [...field.values, value] : field.values.filter(entry => entry !== value)})} />{index === 5 ? ['日', '一', '二', '三', '四', '五', '六'][value - 1] : value}</label>)}</div>}
    {field.mode === 'custom' && <Input label={`${label}自定义字段`} value={field.raw} onChange={raw => onChange({...field, raw})} />}{index === 5 && <p>星期编号：1 为星期日，2 为星期一，7 为星期六。</p>}
  </fieldset>;
}
