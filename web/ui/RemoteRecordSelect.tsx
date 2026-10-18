import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {FormField,type SelectionFieldProps} from './FormField';
import {NativeButton,NativeInput} from './native';
import './remote-record-select.css';

export type RemoteRecordOption={value:string;label:string;disabled?:boolean};
export type RemoteRecordPage={items:readonly RemoteRecordOption[];total:number};
export type RemoteRecordSelectProps=SelectionFieldProps&{
  label:string;value:RemoteRecordOption|null;onChange:(value:RemoteRecordOption|null)=>void;
  load:(request:{query:string;page:number;pageSize:number;signal:AbortSignal})=>Promise<RemoteRecordPage>;
  disabled?:boolean;readOnly?:boolean;placeholder?:string;
};

/** The caller owns authorization, record labels and the selected value. No shared cache. */
export function RemoteRecordSelect({id:providedId,label,value,onChange,load,disabled=false,readOnly=false,placeholder='请选择',required,hint,fieldError}:RemoteRecordSelectProps){
  const generatedId=useId(),id=providedId??generatedId,root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
  const ownsFocus=useRef(false);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
  const [result,setResult]=useState<RemoteRecordPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const locked=disabled||readOnly,visible=open&&!locked,pageSize=10;
  function close(restore=false){setOpen(false);if(restore)trigger.current?.focus();}
  useLayoutEffect(()=>{if(visible)search.current?.focus();},[visible]);
  useLayoutEffect(()=>{
    if(locked&&open){setOpen(false);if(ownsFocus.current&&!disabled)trigger.current?.focus();}
  },[locked,disabled,open]);
  useEffect(()=>{
    if(!visible)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[visible]);
  useEffect(()=>{
    if(!visible)return;
    const controller=new AbortController();setLoading(true);setResult(null);setError(false);
    const timer=setTimeout(()=>{
      Promise.resolve().then(()=>load({query,page,pageSize,signal:controller.signal})).then(data=>{
        if(controller.signal.aborted)return;
        setResult(data);setLoading(false);
      },()=>{if(!controller.signal.aborted){setError(true);setLoading(false);}});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[visible,query,page,retry,load]);
  function options(){return Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role=option]:not(:disabled)')??[]);}
  return <div ref={root} className="ui-remote-record" onFocusCapture={()=>{ownsFocus.current=true;}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){ownsFocus.current=false;close();}}}
    onKeyDown={event=>{if(event.key==='Escape'&&visible){event.preventDefault();event.stopPropagation();close(true);}}}>
    <FormField id={id} label={label} required={required} hint={hint} error={fieldError}>{field=><div className="ui-remote-record-trigger">
      <NativeButton {...field} ref={trigger} type="button" role="combobox" aria-haspopup="dialog" aria-expanded={visible} aria-controls={visible?`${id}-popup`:undefined} aria-readonly={readOnly||undefined} disabled={disabled}
        onClick={()=>{if(!locked){setOpen(!open);setQuery('');setPage(1);}}}><span>{value?.label??placeholder}</span><span aria-hidden="true">⌄</span></NativeButton>
      {value&&!readOnly&&<NativeButton type="button" disabled={disabled} aria-label={`清空${label}`} onClick={()=>{onChange(null);trigger.current?.focus();}}>×</NativeButton>}
    </div>}</FormField>
    {visible&&<div id={`${id}-popup`} role="dialog" aria-label={`选择${label}`} className="ui-remote-record-panel">
      <label htmlFor={`${id}-search`}>搜索{label}</label><NativeInput id={`${id}-search`} ref={search} type="search" value={query}
        onChange={event=>{setQuery(event.target.value);setPage(1);}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();options()[0]?.focus();}}}/>
      {loading&&<p role="status">正在加载…</p>}
      {error&&<div role="alert">加载失败，请重试。<NativeButton type="button" onClick={()=>{search.current?.focus();setRetry(value=>value+1);}}>重试</NativeButton></div>}
      <div ref={list} role="listbox" aria-label={`${label}记录`} aria-busy={loading}>
        {!loading&&!error&&result?.items.map(item=><NativeButton key={item.value} type="button" role="option" aria-selected={item.value===value?.value} disabled={item.disabled} tabIndex={-1}
          onClick={()=>{onChange(item);close(true);}} onKeyDown={event=>{
            const nodes=options(),index=nodes.indexOf(event.currentTarget);
            if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();nodes[event.key==='Home'?0:event.key==='End'?nodes.length-1:Math.max(0,Math.min(nodes.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();}
          }}>{item.label}</NativeButton>)}
      </div>
      {!loading&&!error&&result?.items.length===0&&<p role="status">没有匹配记录</p>}
      <div className="ui-remote-record-pager"><NativeButton type="button" disabled={loading||error||page<=1} onClick={()=>{search.current?.focus();setPage(value=>value-1);}}>上一页</NativeButton>
        <span>第 {page} 页{result?` · 共 ${result.total} 条`:''}</span><NativeButton type="button" disabled={loading||error||!result||page*pageSize>=result.total} onClick={()=>{search.current?.focus();setPage(value=>value+1);}}>下一页</NativeButton></div>
    </div>}
  </div>;
}
