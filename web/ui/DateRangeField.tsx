import {useId} from 'react';
import {NativeButton, NativeInput} from './native';

export type DateRangeValue = {from: string; to: string};
/** Date-only strings stay unchanged. Timezone conversion and query validation belong to the caller. */
export function DateRangeField({value, onChange, label = '日期范围', startLabel = '开始日期', endLabel = '结束日期', disabled, readOnly, error, clearable = true}: {
  value: DateRangeValue; onChange: (value: DateRangeValue) => void; label?: string; startLabel?: string; endLabel?: string;
  disabled?: boolean; readOnly?: boolean; error?: string; clearable?: boolean;
}) {
  const id = useId();
  return <div className="ui-date-range" role="group" aria-label={label}>
    <div className="ui-date-part"><label htmlFor={`${id}-from`}>{startLabel}</label><NativeInput id={`${id}-from`} type="date" value={value.from} disabled={disabled} readOnly={readOnly}
      aria-invalid={error?true:undefined} aria-describedby={error?`${id}-error`:undefined} onChange={event=>onChange({...value,from:event.target.value})}/></div>
    <div className="ui-date-part"><label htmlFor={`${id}-to`}>{endLabel}</label><NativeInput id={`${id}-to`} type="date" value={value.to} disabled={disabled} readOnly={readOnly}
      aria-invalid={error?true:undefined} aria-describedby={error?`${id}-error`:undefined} onChange={event=>onChange({...value,to:event.target.value})}/></div>
    {clearable&&!readOnly&&(value.from||value.to)&&<NativeButton type="button" className="ui-date-range-clear" disabled={disabled} onClick={()=>onChange({from:'',to:''})}>清空{label}</NativeButton>}
    {error&&<span id={`${id}-error`} role="alert" className="ui-field-error">{error}</span>}
  </div>;
}
