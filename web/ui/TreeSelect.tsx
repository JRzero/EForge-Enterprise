import {useId, useMemo, useRef, useState} from 'react';
import {NativeButton, NativeInput} from './native';

export type TreeSelectNode = {value: string; parentValue?: string; label: string; disabled?: boolean};
/** Caller provides the authorized node set; no fetching or permission expansion. */
export function TreeSelect({label, nodes, value, onChange, disabled, readOnly, loading, error, onRetry, placeholder = '请选择', unknownLabel = '当前已选项'}: {
  label: string; nodes: TreeSelectNode[]; value: string | null; onChange: (value: string | null) => void;
  disabled?: boolean; readOnly?: boolean; loading?: boolean; error?: string; onRetry?: () => void; placeholder?: string; unknownLabel?: string;
}) {
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),tree=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState<string|null>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const rows=useMemo(()=>{
    const map=new Map(nodes.map(node=>[node.value,node])),children=new Map<string,TreeSelectNode[]>();
    for(const node of nodes)if(node.parentValue&&map.has(node.parentValue))children.set(node.parentValue,[...(children.get(node.parentValue)??[]),node]);
    const visited=new Set<string>(),result:{node:TreeSelectNode;depth:number;hasChildren:boolean;path:string}[]=[];
    function visit(node:TreeSelectNode,depth:number,prefix:string,hidden=false){
      if(visited.has(node.value))return;visited.add(node.value);
      const path=prefix?`${prefix} / ${node.label}`:node.label,nested=children.get(node.value)??[];
      if(!hidden)result.push({node,depth,hasChildren:nested.length>0,path});
      for(const child of nested)visit(child,depth+1,path,hidden||(!query&&collapsed.has(node.value)));
    }
    for(const node of nodes)if(!node.parentValue||!map.has(node.parentValue))visit(node,0,'');
    for(const node of nodes)if(!visited.has(node.value))visit(node,0,'');
    if(!query.trim())return result;
    const matching=new Set<string>();
    for(const row of result)if(row.path.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())){
      let node:TreeSelectNode|undefined=row.node;
      while(node&&!matching.has(node.value)){matching.add(node.value);node=node.parentValue?map.get(node.parentValue):undefined;}
    }
    return result.filter(row=>matching.has(row.node.value));
  },[nodes,query,collapsed]);
  function expand(key:string,expand:boolean){setCollapsed(previous=>{const next=new Set(previous);if(expand)next.delete(key);else next.add(key);return next;});}
  function close(){setOpen(false);trigger.current?.focus();}
  const selected=nodes.find(node=>node.value===value);
  return <div className="ui-tree-select" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}}>
    <label id={`${id}-label`}>{label}</label>
    <div className="ui-tree-trigger-row"><NativeButton ref={trigger} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="tree" aria-controls={`${id}-tree`} aria-expanded={open&&!disabled&&!readOnly} data-value={value??''} disabled={disabled||readOnly} onClick={()=>setOpen(state=>!state)}>
      <span id={`${id}-value`}>{selected?.label??(value?`${unknownLabel}（${value}）`:placeholder)}</span><span aria-hidden="true">{open?'▴':'▾'}</span>
    </NativeButton>{value&&!readOnly&&<NativeButton type="button" aria-label={`清空${label}`} disabled={disabled} onClick={()=>{onChange(null);trigger.current?.focus();}}>×</NativeButton>}</div>
    {open&&!disabled&&!readOnly&&<div className="ui-tree-panel">
      <label>搜索{label}<NativeInput type="search" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();tree.current?.querySelector<HTMLElement>('[role=treeitem]')?.focus();}}}/></label>
      {loading?<p role="status">正在加载…</p>:error?<div role="alert">{error}{onRetry&&<NativeButton type="button" onClick={onRetry}>重试{label}</NativeButton>}</div>:null}
      <div ref={tree} id={`${id}-tree`} role="tree" aria-label={`${label}选项`} aria-busy={loading||undefined}>
        {!loading&&!error&&rows.map((row,index)=><div key={row.node.value} role="treeitem" aria-level={row.depth+1} aria-selected={row.node.value===value} aria-disabled={row.node.disabled||undefined}
          aria-expanded={row.hasChildren?!!query||!collapsed.has(row.node.value):undefined} tabIndex={row.node.value===(rows.some(item=>item.node.value===active)?active:rows[0]?.node.value)?0:-1} onFocus={()=>setActive(row.node.value)} data-value={row.node.value} style={{paddingInlineStart:Math.min(row.depth,12)*16+8}}
          onKeyDown={event=>{
            const items=Array.from(tree.current?.querySelectorAll<HTMLElement>('[role=treeitem]')??[]);
            if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();}
            else if(event.key==='ArrowRight'){event.preventDefault();if(row.hasChildren&&!query.trim()&&collapsed.has(row.node.value))expand(row.node.value,true);else if(row.hasChildren)items[index+1]?.focus();}
            else if(event.key==='ArrowLeft'){event.preventDefault();if(row.hasChildren&&!query.trim()&&!collapsed.has(row.node.value))expand(row.node.value,false);else items.find(item=>item.dataset.value===row.node.parentValue)?.focus();}
            else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!row.node.disabled){onChange(row.node.value);close();}}
          }}>
          {row.hasChildren?<NativeButton type="button" tabIndex={-1} disabled={!!query.trim()} aria-label={`${!query.trim()&&collapsed.has(row.node.value)?'展开':'折叠'}${row.node.label}`} onClick={()=>expand(row.node.value,collapsed.has(row.node.value))}>{!query.trim()&&collapsed.has(row.node.value)?'▸':'▾'}</NativeButton>:<span className="ui-tree-spacer"/>}
          <NativeButton type="button" tabIndex={-1} disabled={row.node.disabled} onClick={()=>{onChange(row.node.value);close();}}>{row.node.label}</NativeButton>
        </div>)}
      </div>
      {!loading&&!error&&rows.length===0&&<p role="status">没有匹配项</p>}
      <NativeButton type="button" onClick={close}>收起{label}</NativeButton>
    </div>}
  </div>;
}
