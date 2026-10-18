import {useId, type ReactNode} from 'react';

export type FieldControlProps = {id: string; 'aria-labelledby': string; 'aria-describedby'?: string; 'aria-invalid'?: true; 'aria-required'?: true};

/** A selection field owns its label; option-load failures remain separate from validation. */
export type SelectionFieldProps = {id?: string; required?: boolean; hint?: string; fieldError?: string};

/** Layout and accessible associations only; validation and values stay with the caller. */
export function FormField({id: providedId, label, required, hint, error, span = 1, children}: {
  id?: string; label: string; required?: boolean; hint?: ReactNode; error?: string; span?: 1 | 'full';
  children: (props: FieldControlProps) => ReactNode;
}) {
  const generatedId = useId(), id = providedId ?? generatedId;
  const description = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className="ui-form-field" data-span={span}>
    <label id={`${id}-label`} htmlFor={id}>{required && <span aria-hidden="true" className="ui-required">*</span>}{label}</label>
    <div className="ui-form-field-control">
      {children({id, 'aria-labelledby': `${id}-label`, 'aria-describedby': description, 'aria-invalid': error ? true : undefined, 'aria-required': required ? true : undefined})}
      {hint && <div id={`${id}-hint`} className="ui-field-hint">{hint}</div>}
      {error && <div id={`${id}-error`} role="alert" className="ui-field-error">{error}</div>}
    </div>
  </div>;
}
