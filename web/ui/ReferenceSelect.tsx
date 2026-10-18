import {useId} from 'react';
import {Selector, Button} from './controls';
import type {ChoiceOption} from './ChoiceGroup';
import type {SelectionFieldProps} from './FormField';

export type ReferenceSelectProps = SelectionFieldProps & {
  label: string;
  value: string | null;
  options: readonly ChoiceOption[];
  onChange: (value: string | null) => void;
  selectedLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

/** Selection presentation only: authorized records and loading remain caller-owned. */
export function ReferenceSelect({id, label, required, hint, fieldError, value, options, onChange, selectedLabel, placeholder='请选择', disabled, readOnly, loading, error, onRetry}: ReferenceSelectProps) {
  const generatedId=useId();
  const choices = value !== null && !options.some(option => option.value === value)
    ? [{value, label: selectedLabel ?? `${value}（当前配置）`}, ...options]
    : [...options];
  // The pinned Selector has no controlled-open API and only closes for readOnly.
  // Reset its transient panel when availability changes; the selected value stays controlled.
  const unavailable=Boolean(disabled||loading||error);
  return <div className="ui-reference-select">
    <Selector key={unavailable?'unavailable':'available'} id={id??generatedId} label={label} description={hint} isRequired={required} status={fieldError?{type:'error',message:fieldError}:undefined} statusVariant="detached" value={value} options={choices} onChange={next=>{if(!unavailable&&!readOnly)onChange(next);}}
      hasSearch hasClear placeholder={placeholder} searchPlaceholder={`搜索${label}`}
      isDisabled={disabled || loading || Boolean(error)} isReadOnly={readOnly}
      isLoading={loading} emptyText="暂无可选记录" emptySearchText="没有匹配记录"/>
    {loading ? <p role="status">正在加载{label}…</p> : null}
    {error ? <div role="alert">{error}{onRetry ? <Button label={`重试${label}`} variant="ghost" isDisabled={disabled || loading} onClick={onRetry}/> : null}</div> : null}
  </div>;
}
