import {useId, useImperativeHandle, useRef, type Ref} from 'react';
import {NativeInput} from './native';

export type ChoiceOption = {value: string; label: string; disabled?: boolean};
export type ChoiceGroupHandle = {focus: () => void};
type CommonProps = {
  id?: string; label: string; options: ChoiceOption[]; disabled?: boolean; readOnly?: boolean;
  emptyText?: string; className?: string; hint?: string; fieldError?: string; required?: boolean;
  ref?: Ref<ChoiceGroupHandle>;
};

function useChoiceFocus(ref: Ref<ChoiceGroupHandle> | undefined, disabled: boolean, readOnly: boolean) {
  const group = useRef<HTMLFieldSetElement>(null);
  useImperativeHandle(ref, () => ({focus() {
    if (disabled || !group.current) return;
    const target = readOnly ? group.current : group.current.querySelector<HTMLInputElement>('input:checked:not(:disabled)')
      ?? group.current.querySelector<HTMLInputElement>('input:not(:disabled)') ?? group.current;
    target.focus();
  }}), [disabled, readOnly]);
  return group;
}

function ChoiceMessages({id, hint, fieldError, required}: {id: string; hint?: string; fieldError?: string; required?: boolean}) {
  return <>{required && <span id={`${id}-required`} className="ui-field-visually-hidden">必填</span>}
    {hint && <p id={`${id}-hint`} className="ui-field-hint ui-choice-message">{hint}</p>}
    {fieldError && <p id={`${id}-error`} role="alert" className="ui-field-error ui-choice-message">{fieldError}</p>}</>;
}

/** Required describes the group; choosing every checkbox is never implied. */
export function CheckboxGroup({id, label, options, value, onChange, disabled = false, readOnly = false, emptyText = '暂无选项', unknownLabel = id => id, className = '', hint, fieldError, required, ref}: CommonProps & {
  value: string[]; onChange: (value: string[]) => void; unknownLabel?: (value: string) => string;
}) {
  const generatedId = useId(), fieldId = id ?? generatedId, group = useChoiceFocus(ref, disabled, readOnly);
  const description = [required && `${fieldId}-required`, hint && `${fieldId}-hint`, fieldError && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;
  const known = new Set(options.map(option => option.value));
  const entries: ChoiceOption[] = [...options, ...value.filter(id => !known.has(id)).map(id => ({value: id, label: unknownLabel(id)}))];
  return <fieldset ref={group} id={fieldId} className={`ui-choice-group ${className}`} disabled={disabled}
    tabIndex={disabled ? undefined : readOnly || !entries.some(option => !option.disabled) ? 0 : -1}
    aria-describedby={description} aria-invalid={fieldError ? true : undefined}>
    <legend>{required && <span className="ui-required" aria-hidden="true">*</span>}{label}</legend>
    <div className="ui-choice-options">{entries.length === 0 ? <p>{emptyText}</p> : entries.map(option => <label key={option.value}>
      <NativeInput type="checkbox" checked={value.includes(option.value)} disabled={readOnly || option.disabled}
        aria-describedby={description} aria-invalid={fieldError ? true : undefined}
        onChange={event => {if (!disabled && !readOnly && !option.disabled) onChange(event.target.checked ? [...value, option.value] : value.filter(id => id !== option.value));}}/>{option.label}
    </label>)}</div>
    <ChoiceMessages id={fieldId} required={required} hint={hint} fieldError={fieldError}/>
  </fieldset>;
}

export function RadioGroup({id, label, options, value, onChange, disabled = false, readOnly = false, emptyText = '暂无选项', unknownLabel = id => id, className = '', hint, fieldError, required, ref}: CommonProps & {
  value: string | null; onChange: (value: string) => void; unknownLabel?: (value:string)=>string;
}) {
  // A caller's field ID must not couple the native radio names of separate instances.
  const name = useId(), fieldId = id ?? name, group = useChoiceFocus(ref, disabled, readOnly);
  const description = [hint && `${fieldId}-hint`, fieldError && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;
  const entries = value !== null && !options.some(option => option.value === value) ? [...options, {value, label: unknownLabel(value)}] : options;
  return <fieldset ref={group} id={fieldId} role="radiogroup" className={`ui-choice-group ${className}`} disabled={disabled}
    tabIndex={disabled ? undefined : readOnly || !entries.some(option => !option.disabled) ? 0 : -1}
    aria-required={required || undefined} aria-readonly={readOnly || undefined} aria-describedby={description} aria-invalid={fieldError ? true : undefined}>
    <legend>{required && <span className="ui-required" aria-hidden="true">*</span>}{label}</legend>
    <div className="ui-choice-options">{entries.length === 0 ? <p>{emptyText}</p> : entries.map(option => <label key={option.value}>
      <NativeInput type="radio" name={name} value={option.value} checked={value === option.value} disabled={readOnly || option.disabled}
        aria-describedby={description} aria-invalid={fieldError ? true : undefined}
        onChange={() => {if (!disabled && !readOnly && !option.disabled) onChange(option.value);}}/>{option.label}
    </label>)}</div>
    <ChoiceMessages id={fieldId} hint={hint} fieldError={fieldError}/>
  </fieldset>;
}
