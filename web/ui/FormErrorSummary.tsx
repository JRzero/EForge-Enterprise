import {useId, type Ref} from 'react';

export type FormErrorTarget = {scope:string;field:string;rowId?:string};
export type FormErrorItem = {key:string;label:string;message:string;target:FormErrorTarget};

/** Validation and revealing/focusing the target remain owned by the form. */
export function FormErrorSummary({errors,onNavigate,ref}: {
  errors:readonly FormErrorItem[];
  onNavigate?:(target:FormErrorTarget)=>void;
  ref?:Ref<HTMLElement>;
}) {
  const titleId=useId();
  if(!errors.length)return null;
  return <section ref={ref} className="ui-form-error-summary" aria-labelledby={titleId} tabIndex={-1}>
    <h3 id={titleId}>请检查以下字段</h3>
    <ul>{errors.map(error=><li key={error.key}>{onNavigate?
      <button type="button" onClick={()=>onNavigate(error.target)}>{error.label}：{error.message}</button>:
      <span>{error.label}：{error.message}</span>}</li>)}</ul>
  </section>;
}
