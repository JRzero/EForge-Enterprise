import {useId, type ReactNode} from 'react';

export type FieldControlProps = {id: string; 'aria-describedby'?: string; 'aria-invalid'?: true; 'aria-required'?: true};

/** Layout and accessible associations only; validation and values stay with the caller. */
export function FormField({label, required, hint, error, span = 1, children}: {
  label: string; required?: boolean; hint?: ReactNode; error?: string; span?: 1 | 'full';
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const description = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className="ui-form-field" data-span={span}>
    <label htmlFor={id}>{required && <span aria-hidden="true" className="ui-required">*</span>}{label}</label>
    <div className="ui-form-field-control">
      {children({id, 'aria-describedby': description, 'aria-invalid': error ? true : undefined, 'aria-required': required ? true : undefined})}
      {hint && <div id={`${id}-hint`} className="ui-field-hint">{hint}</div>}
      {error && <div id={`${id}-error`} role="alert" className="ui-field-error">{error}</div>}
    </div>
  </div>;
}
