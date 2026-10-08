import {NativeButton} from '../../ui/native';
import {useLayoutEffect,useRef,useState} from 'react';
import {Input,type InputProps} from '../../ui/controls';

type Props=Omit<InputProps,'type'|'ref'> & {visible?:boolean;onToggle?:()=>void};

export function PasswordField({visible,onToggle,...input}:Props) {
  const [revealed,setRevealed]=useState(false);
  const field=useRef<HTMLInputElement>(null);
  const pointerSelection=useRef<{start:number|null;end:number|null}|null>(null);
  const pendingFrame=useRef<number|null>(null);
  function cancelRestoration(){pointerSelection.current=null;if(pendingFrame.current!==null){cancelAnimationFrame(pendingFrame.current);pendingFrame.current=null;}}
  const shown=visible ?? revealed;
  useLayoutEffect(()=>{
    const selection=pointerSelection.current;pointerSelection.current=null;
    if(!selection)return;
    const frame=requestAnimationFrame(()=>{pendingFrame.current=null;const ownedField=field.current;if(!ownedField)return;ownedField.focus({preventScroll:true});if(selection.start!==null && selection.end!==null)ownedField.setSelectionRange(selection.start,selection.end);});
    const frames=pendingFrame;frames.current=frame;
    return ()=>{cancelAnimationFrame(frame);if(frames.current===frame)frames.current=null;};
  },[shown]);
  return <div className="password-field" onBlurCapture={event=>{if(event.relatedTarget)cancelRestoration();}}><Input {...input} type={shown?'text':'password'} ref={field}/>
    <NativeButton type="button" className="password-field-toggle" aria-pressed={shown} disabled={input.isDisabled || input.isReadOnly}
      onFocus={cancelRestoration} onKeyDown={cancelRestoration} onPointerDown={event=>{cancelRestoration();pointerSelection.current={start:field.current?.selectionStart ?? null,end:field.current?.selectionEnd ?? null};event.preventDefault();}} onClick={event=>{
        if(event.detail===0)pointerSelection.current=null;
        if(onToggle)onToggle();else setRevealed(!shown);
      }}>{(shown?'隐藏':'显示')+input.label}</NativeButton>
  </div>;
}
