import {useId} from 'react';
import {NativeInput} from './native';

export type ChoiceOption = {value: string; label: string; disabled?: boolean};
type CommonProps = {label: string; options: ChoiceOption[]; disabled?: boolean; readOnly?: boolean; emptyText?: string; className?: string};

export function CheckboxGroup({label, options, value, onChange, disabled = false, readOnly = false, emptyText = '暂无选项', unknownLabel = id => id, className = ''}: CommonProps & {
  value: string[]; onChange: (value: string[]) => void; unknownLabel?: (value: string) => string;
}) {
  const known = new Set(options.map(option => option.value));
  const entries: ChoiceOption[] = [...options, ...value.filter(id => !known.has(id)).map(id => ({value: id, label: unknownLabel(id)}))];
  return <fieldset className={`ui-choice-group ${className}`} disabled={disabled}><legend>{label}</legend>
    <div className="ui-choice-options">{entries.length === 0 ? <p>{emptyText}</p> : entries.map(option => <label key={option.value}>
      <NativeInput type="checkbox" checked={value.includes(option.value)} disabled={readOnly || option.disabled}
        onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(id => id !== option.value))}/>{option.label}
    </label>)}</div>
  </fieldset>;
}

export function RadioGroup({label, options, value, onChange, disabled = false, readOnly = false, emptyText = '暂无选项', className = ''}: CommonProps & {
  value: string | null; onChange: (value: string) => void;
}) {
  const name = useId();
  return <fieldset className={`ui-choice-group ${className}`} disabled={disabled}><legend>{label}</legend>
    <div className="ui-choice-options">{options.length === 0 ? <p>{emptyText}</p> : options.map(option => <label key={option.value}>
      <NativeInput type="radio" name={name} value={option.value} checked={value === option.value} disabled={readOnly || option.disabled} onChange={() => onChange(option.value)}/>{option.label}
    </label>)}</div>
  </fieldset>;
}
