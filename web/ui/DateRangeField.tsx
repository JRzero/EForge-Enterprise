import {useId, useImperativeHandle, useRef, type Ref} from 'react';
import {NativeButton, NativeInput} from './native';

export type DateRangeValue = {from: string; to: string};
export type DateRangeFieldHandle = {focus: (part?: keyof DateRangeValue) => void};
/** Date-only strings stay unchanged. Required is descriptive; validation belongs to the caller. */
export function DateRangeField({id, value, onChange, label = '日期范围', startLabel = '开始日期', endLabel = '结束日期', disabled, readOnly, error, fieldError, hint, required, clearable = true, ref}: {
  id?: string; value: DateRangeValue; onChange: (value: DateRangeValue) => void; label?: string; startLabel?: string; endLabel?: string;
  disabled?: boolean; readOnly?: boolean; error?: string; fieldError?: string; hint?: string; required?: boolean; clearable?: boolean;
  ref?: Ref<DateRangeFieldHandle>;
}) {
  const generatedId = useId(), fieldId = id ?? generatedId;
  const from = useRef<HTMLInputElement>(null), to = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({focus(part = 'from') {
    const input = (part === 'to' ? to : from).current;
    if (!disabled && input?.getClientRects().length) input.focus();
  }}), [disabled]);
  const extraError = fieldError && fieldError !== error ? fieldError : undefined;
  const description = [hint && `${fieldId}-hint`, error && `${fieldId}-error`, extraError && `${fieldId}-field-error`].filter(Boolean).join(' ') || undefined;
  const invalid = error || fieldError ? true : undefined;
  const change = (part: keyof DateRangeValue, next: string) => {if (!disabled && !readOnly) onChange({...value, [part]: next});};
  return <div className="ui-date-range" role="group" aria-label={label} aria-describedby={description} aria-invalid={invalid}>
    <div className="ui-date-part"><label htmlFor={`${fieldId}-from`}>{required && <span className="ui-required" aria-hidden="true">*</span>}<span id={`${fieldId}-from-label`}>{startLabel}</span></label><NativeInput ref={from} id={`${fieldId}-from`} type="date" value={value.from} disabled={disabled} readOnly={readOnly}
      aria-labelledby={`${fieldId}-from-label`} aria-required={required || undefined} aria-invalid={invalid} aria-describedby={description} onChange={event => change('from', event.target.value)}/></div>
    <div className="ui-date-part"><label htmlFor={`${fieldId}-to`}>{required && <span className="ui-required" aria-hidden="true">*</span>}<span id={`${fieldId}-to-label`}>{endLabel}</span></label><NativeInput ref={to} id={`${fieldId}-to`} type="date" value={value.to} disabled={disabled} readOnly={readOnly}
      aria-labelledby={`${fieldId}-to-label`} aria-required={required || undefined} aria-invalid={invalid} aria-describedby={description} onChange={event => change('to', event.target.value)}/></div>
    {clearable && !readOnly && (value.from || value.to) && <NativeButton type="button" className="ui-date-range-clear" disabled={disabled} onClick={() => {if (!disabled) onChange({from:'',to:''});}}>清空{label}</NativeButton>}
    {hint && <span id={`${fieldId}-hint`} className="ui-field-hint">{hint}</span>}
    {error && <span id={`${fieldId}-error`} role="alert" className="ui-field-error">{error}</span>}
    {extraError && <span id={`${fieldId}-field-error`} role="alert" className="ui-field-error">{extraError}</span>}
  </div>;
}
