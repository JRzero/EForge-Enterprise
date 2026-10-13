import {useId, type ReactNode} from 'react';
import {ResourceDialog} from '../app/components/ResourceDialog';
import {Button} from './controls';
import {Feedback} from './Feedback';

export type ConfirmActionDialogProps = {
  title:string; children:ReactNode; busy:boolean; error?:string;
  confirmLabel?:string; cancelLabel?:string;
  onConfirm:()=>void; onCancel:()=>void;
};

/** Controlled confirmation; permissions, requests and retry policy belong to the caller. */
export function ConfirmActionDialog({title,children,busy,error,confirmLabel='确认操作',cancelLabel='取消',onConfirm,onCancel}:ConfirmActionDialogProps) {
  const id=useId();
  return <ResourceDialog titleId={id} alert busy={busy} onCancel={onCancel}>
    <h2 id={id}>{title}</h2><div>{children}</div>
    {error?<Feedback tone="danger">{error}</Feedback>:null}
    <div className="post-row-actions">
      <Button type="button" label={confirmLabel} isDisabled={busy} onClick={()=>{if(!busy)onConfirm();}}/>
      <Button type="button" label={cancelLabel} variant="secondary" isDisabled={busy} onClick={onCancel}/>
    </div>
  </ResourceDialog>;
}
