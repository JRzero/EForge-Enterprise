import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Button} from './controls';
import {Table} from './native';

export type DetailCellState = {disabled:boolean;readOnly:boolean;rowId:string;field:{id:string;error?:string}};
export type DetailColumn<T> = {key:string;label:ReactNode;render:(row:T,index:number,state:DetailCellState)=>ReactNode};
export type EditableDetailTableProps<T> = {
  title:string;rows:readonly T[];columns:readonly DetailColumn<T>[];
  getRowKey:(row:T,index:number)=>string;
  busy?:boolean;readOnly?:boolean;
  onAdd?:()=>void|string|Promise<void|string>;onRemove?:(row:T,index:number)=>void|Promise<void>;
  addLabel?:string;removeLabel?:string;emptyText?:string;
  rowError?:(row:T,index:number)=>string|undefined;
  cellError?:(rowId:string,field:string)=>string|undefined;
  focusColumn?:string;
  onFocusCell?:(target:{rowId:string;field:string})=>void;
  footer?:ReactNode;
};
type FocusIntent = {kind:'add'|'remove';origin:Element|null;before:string[];removed?:string;neighbours:string[];key?:string;ready:boolean;originDisabled?:boolean};

/** A controlled detail grid. Data validation and persistence stay with the form. */
export function EditableDetailTable<T>({title,rows,columns,getRowKey,busy=false,readOnly=false,onAdd,onRemove,addLabel='新增明细',removeLabel='删除明细',emptyText='暂无明细',rowError,cellError,focusColumn,onFocusCell,footer}:EditableDetailTableProps<T>) {
  const id=useId(),region=useRef<HTMLElement>(null),intent=useRef<FocusIntent|null>(null),mounted=useRef(true);
  const operationVersion=useRef(0);
  const invalidateOperations=useCallback(()=>{operationVersion.current++;},[]);
  const [settled,setSettled]=useState(0),[operationError,setOperationError]=useState('');
  const cellId=(rowId:string,field:string)=>`${id}-${JSON.stringify([rowId,field])}`;
  useEffect(()=>{
    mounted.current=true;
    const document=region.current?.ownerDocument;if(!document)return;
    const leave=(event:Event)=>{
      const current=intent.current;if(!current)return;
      if(event.target instanceof Node&&current.origin?.contains(event.target))return;
      if(event.type==='focusin'&&event.target===document.body&&(current.originDisabled||!current.origin?.isConnected||current.origin.matches(':disabled')))return;
      intent.current=null;
    };
    const blur=()=>{intent.current=null;};
    document.addEventListener('focusin',leave);document.addEventListener('pointerdown',leave);document.defaultView?.addEventListener('blur',blur);
    return()=>{mounted.current=false;intent.current=null;invalidateOperations();document.removeEventListener('focusin',leave);document.removeEventListener('pointerdown',leave);document.defaultView?.removeEventListener('blur',blur);};
  },[invalidateOperations]);
  useLayoutEffect(()=>{
    const current=intent.current;if(!current)return;
    if(readOnly){intent.current=null;return;}
    // Native disabled buttons lose focus to body. Remember why before a later
    // render enables the origin again; user pointer/focus moves still cancel.
    if(current.origin?.matches(':disabled'))current.originDisabled=true;
    if(!current.ready||busy)return;
    const keys=rows.map(getRowKey);
    let target:string|undefined;
    if(current.kind==='add'){
      if(current.key!==undefined){if(!keys.includes(current.key))return;target=current.key;}
      else {
        const added=keys.filter(key=>!current.before.includes(key));
        if(!added.length)return;
        if(added.length===1)target=added[0];else {intent.current=null;return;}
      }
    }else {
      if(keys.includes(current.removed!))return;
      target=current.neighbours.find(key=>keys.includes(key));
    }
    intent.current=null;
    const document=region.current?.ownerDocument,active=document?.activeElement;
    if(active!==current.origin&&!(active===document?.body&&(current.originDisabled||!current.origin?.isConnected||current.origin.matches(':disabled'))))return;
    const focusAvailable=(element:HTMLElement|null|undefined)=>{
      if(!element||!region.current?.contains(element)||element.matches(':disabled')||element.closest('[inert]')||!element.getClientRects().length)return false;
      element.focus();
      return document?.activeElement===element;
    };
    if(target!==undefined){
      const field=focusColumn??columns[0]?.key;
      if(field&&onFocusCell){onFocusCell({rowId:target,field});return;}
      const fieldElement=field?document?.getElementById(`${id}-${JSON.stringify([target,field])}`):null;
      if(fieldElement instanceof HTMLElement&&focusAvailable(fieldElement))return;
      // Compatibility for callers that have not adopted the stable cell ID yet.
      const row=Array.from(region.current?.querySelectorAll<HTMLElement>('tr[data-detail-row]')??[]).find(element=>element.dataset.detailRow===target);
      const controls=row?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),select:not(:disabled),textarea:not(:disabled)')??[];
      for(const control of controls)if(focusAvailable(control))return;
    }
    if(!focusAvailable(region.current?.querySelector<HTMLElement>('.detail-table-header button:not(:disabled)')))focusAvailable(region.current);
  },[rows,getRowKey,columns,busy,readOnly,settled,focusColumn,onFocusCell,id]);
  async function operate(kind:'add'|'remove',action:()=>void|string|Promise<void|string>,removed?:string){
    const version=++operationVersion.current;
    const before=rows.map(getRowKey),index=removed===undefined?-1:before.indexOf(removed);
    const current:FocusIntent={kind,origin:region.current?.ownerDocument.activeElement??null,before,removed,neighbours:[...before.slice(index+1),...before.slice(0,index).reverse()],ready:false};
    intent.current=current;setOperationError('');
    try{
      const key=await action();if(!mounted.current||intent.current!==current)return;
      if(typeof key==='string')current.key=key;
      current.ready=true;setSettled(value=>value+1);
    }catch{
      if(!mounted.current||version!==operationVersion.current)return;
      if(intent.current===current)intent.current=null;
      setOperationError(kind==='add'?'新增明细未完成，请重试。':'删除明细未完成，请重试。');
    }
  }
  const actions=!readOnly&&Boolean(onRemove);
  return <section ref={region} className="editable-detail-table" aria-labelledby={id} tabIndex={-1} aria-busy={busy}>
    <div className="detail-table-header"><h3 id={id}>{title}</h3>{!readOnly&&onAdd?<Button type="button" label={addLabel} isDisabled={busy} onClick={()=>{void operate('add',onAdd);}}/>:null}</div>
    {operationError?<p role="alert" className="detail-row-error">{operationError}</p>:null}
    <div className="detail-table-scroll" role="region" aria-label={`${title}表格`} tabIndex={0}><Table>
      <thead><tr>{columns.map(column=><th scope="col" key={column.key}>{column.label}</th>)}{actions?<th scope="col">操作</th>:null}</tr></thead>
      <tbody>{rows.map((row,index)=>{
        const key=getRowKey(row,index),error=rowError?.(row,index);
        return <tr key={key} data-detail-row={key}>{columns.map((column,columnIndex)=><td key={column.key}>
          {column.render(row,index,{disabled:busy,readOnly,rowId:key,field:{id:cellId(key,column.key),error:cellError?.(key,column.key)}})}
          {columnIndex===0&&error?<p role="alert" className="detail-row-error">{error}</p>:null}
        </td>)}{actions?<td><Button type="button" label={removeLabel} variant="ghost" isDisabled={busy} onClick={()=>{void operate('remove',()=>onRemove?.(row,index),key);}}/></td>:null}</tr>;
      })}{rows.length===0?<tr><td colSpan={Math.max(1,columns.length+Number(actions))}>{emptyText}</td></tr>:null}</tbody>
    </Table></div>{footer?<div className="detail-table-footer">{footer}</div>:null}
  </section>;
}
