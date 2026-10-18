import {useEffect, useId, useRef, useState} from 'react';
import {NativeButton, NativeInput} from './native';
import type {ChoiceOption} from './ChoiceGroup';
import type {SelectionFieldProps} from './FormField';

export type MultiSelectProps = SelectionFieldProps & {
  label: string; options: ChoiceOption[]; value: string[]; onChange: (value: string[]) => void;
  disabled?: boolean; readOnly?: boolean; loading?: boolean; error?: string; onRetry?: () => void;
  unknownLabel?: (value: string) => string;
};

/** Product-owned composition. IDs remain strings; fetching and authorization stay with callers. */
export function MultiSelect({id: providedId, label, required, hint, fieldError, options, value, onChange, disabled, readOnly, loading, error, onRetry, unknownLabel = id => id}: MultiSelectProps) {
  const generatedId = useId(), id = providedId ?? generatedId, input = useRef<HTMLInputElement>(null);
  const description = [hint ? `${id}-hint` : '', fieldError ? `${id}-field-error` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const [open,setOpen] = useState(false), [query,setQuery] = useState(''), [active,setActive] = useState<string|null>(null);
  const root = useRef<HTMLDivElement>(null);
  const locked = Boolean(disabled || readOnly);
  useEffect(()=>{if(locked){setOpen(false);setActive(null);}},[locked]);
  useEffect(()=>{if(loading||error)setActive(null);},[loading,error]);
  useEffect(()=>{
    if(!open)return;
    let pointerDown=false;
    const dismiss=(event:Event)=>{if(root.current&&!event.composedPath().includes(root.current)){setOpen(false);setActive(null);}};
    const pointerStart=()=>{pointerDown=true;},pointerEnd=()=>{pointerDown=false;};
    const focusOutside=(event:FocusEvent)=>{if(!pointerDown)dismiss(event);};
    // Dismiss after the outside click: collapsing an inline dialog menu during
    // pointerdown/blur moves its footer before the user's click can reach it.
    document.addEventListener('click',dismiss);
    document.addEventListener('pointerdown',pointerStart,true);
    document.addEventListener('pointerup',pointerEnd,true);
    document.addEventListener('pointercancel',pointerEnd,true);
    document.addEventListener('focusin',focusOutside);
    return ()=>{document.removeEventListener('click',dismiss);document.removeEventListener('pointerdown',pointerStart,true);document.removeEventListener('pointerup',pointerEnd,true);document.removeEventListener('pointercancel',pointerEnd,true);document.removeEventListener('focusin',focusOutside);};
  },[open]);
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const available = loading || error ? [] : filtered.filter(option => !option.disabled);
  const activeIndex = filtered.findIndex(option => option.value === active && !option.disabled);
  function remove(key: string) {if (!locked) onChange(value.filter(item => item !== key)); input.current?.focus();}
  function toggle(option: ChoiceOption) {
    if (locked || loading || error || option.disabled) return;
    onChange(value.includes(option.value) ? value.filter(item => item !== option.value) : [...value,option.value]);
    input.current?.focus();
  }
  return <div ref={root} className="ui-multi-select" data-disabled={disabled || undefined} data-readonly={readOnly || undefined}
    onKeyDown={event=>{
      if(event.key==='Escape'&&open&&!locked){event.preventDefault();event.stopPropagation();input.current?.focus();setOpen(false);setActive(null);}
      else if(event.key==='Tab'){setOpen(false);setActive(null);}
    }}>
    <label htmlFor={id}>{required && <span aria-hidden="true" className="ui-required">*</span>}{label}</label>
    <div className="ui-multi-control">
      <div className="ui-multi-values">{value.map(key=>{
        const text=options.find(option=>option.value===key)?.label ?? unknownLabel(key);
        return <span className="ui-multi-chip" key={key}><span>{text}</span>{!readOnly&&<NativeButton type="button" disabled={disabled} aria-label={`移除 ${text}`} onClick={()=>remove(key)}>×</NativeButton>}</span>;
      })}
      <NativeInput ref={input} type="text" id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open && !locked}
        aria-controls={open&&!locked?`${id}-options`:undefined} aria-activedescendant={open && !locked && !loading && !error && activeIndex>=0 ? `${id}-option-${activeIndex}` : undefined}
        aria-required={required || undefined} aria-invalid={error || fieldError ? true : undefined} aria-describedby={description}
        aria-readonly={readOnly || undefined}
        disabled={disabled} readOnly={readOnly} value={query} placeholder={value.length ? '搜索更多' : '搜索并选择'}
        onFocus={()=>{if(!locked)setOpen(true);}} onClick={()=>{if(!locked)setOpen(true);}}
        onChange={event=>{setQuery(event.target.value);setActive(null);setOpen(true);}}
        onKeyDown={event=>{
          if(locked)return;
          if(event.key==='ArrowDown'||event.key==='ArrowUp'){
            event.preventDefault();setOpen(true);const index=available.findIndex(option=>option.value===active);
            const next=event.key==='ArrowDown'?(index+1)%available.length:(index<=0?available.length-1:index-1);
            const option=available[next];setActive(option?.value??null);
            if(option) document.getElementById(`${id}-option-${filtered.indexOf(option)}`)?.scrollIntoView({block:'nearest'});
          } else if(event.key==='Enter'&&open){event.preventDefault();if(activeIndex>=0)toggle(filtered[activeIndex]!);}
        }}/></div>
      {value.length>0&&!readOnly&&<NativeButton className="ui-multi-clear" type="button" disabled={disabled} aria-label={`清空${label}`} onClick={()=>{onChange([]);input.current?.focus();}}>×</NativeButton>}
      <NativeButton className="ui-multi-arrow" type="button" disabled={locked} aria-label={`${open?'收起':'展开'}${label}`} onClick={()=>{input.current?.focus();setOpen(!open);}}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={open?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}/></svg></NativeButton>
    </div>
    {hint&&<div id={`${id}-hint`} className="ui-field-hint">{hint}</div>}
    {fieldError&&<div id={`${id}-field-error`} role="alert" className="ui-field-error">{fieldError}</div>}
    {error&&<div id={`${id}-error`} role="alert" className="ui-field-error">{error}{onRetry&&<NativeButton type="button" disabled={locked||loading} onClick={event=>{event.stopPropagation();input.current?.focus();setOpen(true);onRetry();}}>重试{label}</NativeButton>}</div>}
    {open&&!locked&&<div className="ui-multi-popup">
      {loading?<p role="status">正在加载…</p>:error?<p>选项暂不可用</p>:filtered.length===0?<p role="status">没有匹配项</p>:null}
      <div id={`${id}-options`} role="listbox" aria-label={`${label}选项`} aria-multiselectable="true" aria-busy={loading||undefined}>
        {!loading&&!error&&filtered.map((option,index)=><div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={value.includes(option.value)} aria-disabled={option.disabled||undefined}
          data-active={active===option.value||undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>toggle(option)}>
          <span>{option.label}</span>{value.includes(option.value)&&<span aria-hidden="true">✓</span>}
        </div>)}
      </div>
    </div>}
  </div>;
}
