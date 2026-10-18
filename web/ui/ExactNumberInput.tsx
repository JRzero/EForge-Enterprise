import {useEffect,useId,useRef,useState,type ComponentPropsWithoutRef} from 'react';
import {exactNumberIssue,normalizeNumberPaste,type ExactNumberRules} from './exact-number';
import {NativeInput} from './native';

type Props=Omit<ComponentPropsWithoutRef<'input'>,'type'|'value'|'defaultValue'|'onChange'|'min'|'max'|'step'> & ExactNumberRules & {
  value:string;onValueChange:(value:string)=>void;unit?:string;
};
/** Controlled string input: invalid drafts remain editable; native form validity blocks submission. */
export function ExactNumberInput({value,onValueChange,min,max,scale,integer,unit,id:providedId,onBlur,onInvalid,onPaste,'aria-describedby':describedBy,...props}:Props){
  const generatedId=useId(),id=providedId??generatedId,input=useRef<HTMLInputElement>(null),[touched,setTouched]=useState(false);
  const issue=exactNumberIssue(value,{min,max,scale,integer});
  useEffect(()=>{input.current?.setCustomValidity(props.readOnly?'':issue);},[issue,props.readOnly]);
  const showError=touched&&!!issue&&!props.readOnly&&!props.disabled;
  function change(next:string){input.current?.setCustomValidity(exactNumberIssue(next,{min,max,scale,integer}));onValueChange(next);}
  return <span className="ui-exact-number"><NativeInput {...props} id={id} ref={input} type="text" inputMode={integer?'numeric':'decimal'} value={value}
    aria-describedby={[describedBy,unit?`${id}-unit`:'',showError?`${id}-number-error`:''].filter(Boolean).join(' ')||undefined}
    aria-invalid={showError?true:props['aria-invalid']}
    onChange={event=>change(event.target.value)} onBlur={event=>{setTouched(true);onBlur?.(event);}}
    onInvalid={event=>{setTouched(true);onInvalid?.(event);}}
    onPaste={event=>{
      onPaste?.(event);if(event.defaultPrevented||props.disabled||props.readOnly)return;
      const original=event.clipboardData.getData('text'),pasted=normalizeNumberPaste(original);if(pasted===original)return;
      event.preventDefault();const target=event.currentTarget,start=target.selectionStart??value.length,end=target.selectionEnd??start;
      change(value.slice(0,start)+pasted+value.slice(end));requestAnimationFrame(()=>{if(document.activeElement===target)target.setSelectionRange(start+pasted.length,start+pasted.length);});
    }}/>{unit&&<span id={`${id}-unit`} className="ui-field-hint">{unit}</span>}
    {showError&&<span id={`${id}-number-error`} className="ui-field-error" role="alert">{issue}</span>}
  </span>;
}
