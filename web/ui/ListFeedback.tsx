import type {ReactNode} from 'react';
import {Button} from './controls';
import './list-feedback.css';

/** Selection ownership, permissions and mutation confirmation remain with the page. */
export function BatchActionBar({count,busy=false,onClear,children}:{count:number;busy?:boolean;onClear:()=>void;children?:ReactNode}){
  if(count===0)return null;
  return <section className="ui-batch-actions" aria-label="已选记录操作"><span role="status">当前页已选 {count} 条</span>
    <Button label="清除选择" variant="ghost" isDisabled={busy} onClick={onClear}/><div className="ui-batch-actions-buttons">{children}</div></section>;
}

export type AppliedFilter={key:string;label:string;value:string};
/** Shows applied conditions, never an unsubmitted search draft. */
export function AppliedFilters({items,disabled=false,onRemove,onReset}:{items:readonly AppliedFilter[];disabled?:boolean;onRemove:(key:string)=>void;onReset:()=>void}){
  if(items.length===0)return null;
  return <section className="ui-applied-filters" aria-label="已生效筛选"><span>已生效：</span><ul>{items.map(item=><li key={item.key}>
    <Button label={`${item.label}：${item.value} ×`} aria-label={`移除${item.label}条件`} variant="secondary" isDisabled={disabled} onClick={()=>onRemove(item.key)}/>
  </li>)}</ul><Button label="清空条件" variant="ghost" isDisabled={disabled} onClick={onReset}/></section>;
}
