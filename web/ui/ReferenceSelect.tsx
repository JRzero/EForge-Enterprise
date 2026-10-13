import {Selector, Button} from './controls';
import type {ChoiceOption} from './ChoiceGroup';

export type ReferenceSelectProps = {
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
export function ReferenceSelect({label, value, options, onChange, selectedLabel, placeholder='请选择', disabled, readOnly, loading, error, onRetry}: ReferenceSelectProps) {
  const choices = value !== null && !options.some(option => option.value === value)
    ? [{value, label: selectedLabel ?? `${value}（当前配置）`}, ...options]
    : [...options];
  return <div className="ui-reference-select">
    <Selector label={label} value={value} options={choices} onChange={onChange}
      hasSearch hasClear placeholder={placeholder} searchPlaceholder={`搜索${label}`}
      isDisabled={disabled || loading || Boolean(error)} isReadOnly={readOnly}
      isLoading={loading} emptyText="暂无可选记录" emptySearchText="没有匹配记录"/>
    {loading ? <p role="status">正在加载{label}…</p> : null}
    {error ? <div role="alert">{error}{onRetry ? <Button label={`重试${label}`} variant="ghost" isDisabled={disabled || loading} onClick={onRetry}/> : null}</div> : null}
  </div>;
}
