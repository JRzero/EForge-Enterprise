import {useId, type FormEvent, type ReactNode} from 'react';
import {ResourceDialog} from '../app/components/ResourceDialog';
import {Button} from './controls';
import {FormPage, PageForm} from './FormPage';

export type EditorFormProps = {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Caller applies its draft/discard policy before closing. */
  onCancel: () => void;
  busy: boolean;
  error?: string;
  saveLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  noValidate?: boolean;
  className?: string;
};

export function EditorForm({children, onSubmit, onCancel, busy, error, saveLabel='保存', busyLabel='正在保存…', cancelLabel='取消', noValidate, className}: EditorFormProps) {
  return <PageForm className={className} noValidate={noValidate} aria-busy={busy}
    onSubmit={event=>{event.preventDefault();if(!busy)onSubmit(event);}}
    actions={<><Button type="submit" variant="primary" label={busy?busyLabel:saveLabel} isDisabled={busy}/><Button type="button" variant="secondary" label={cancelLabel} isDisabled={busy} onClick={onCancel}/></>}>
    {children}{error?<p className="editor-error" role="alert">{error}</p>:null}
  </PageForm>;
}

export function EditorDialog({title, ...props}: EditorFormProps & {title: string}) {
  const titleId=useId();
  return <ResourceDialog titleId={titleId} busy={props.busy} onCancel={props.onCancel}>
    <h2 id={titleId}>{title}</h2><EditorForm {...props}/>
  </ResourceDialog>;
}

export function EditorPage({title, description, ...props}: EditorFormProps & {title: string; description?: string}) {
  return <FormPage title={title} description={description}><EditorForm {...props}/></FormPage>;
}
