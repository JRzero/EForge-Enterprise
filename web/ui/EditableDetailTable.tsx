import {useId, useLayoutEffect, useRef, type ReactNode} from 'react';
import {Button} from './controls';
import {Table} from './native';

export type DetailColumn<T> = {key:string;label:ReactNode;render:(row:T,index:number,state:{disabled:boolean;readOnly:boolean})=>ReactNode};
export type EditableDetailTableProps<T> = {
  title:string;rows:readonly T[];columns:readonly DetailColumn<T>[];
  getRowKey:(row:T,index:number)=>string;
  busy?:boolean;readOnly?:boolean;
  onAdd?:()=>void;onRemove?:(row:T,index:number)=>void;
  addLabel?:string;removeLabel?:string;emptyText?:string;
  rowError?:(row:T,index:number)=>string|undefined;
  footer?:ReactNode;
};

/** A controlled detail grid. Data validation and persistence stay with the form. */
export function EditableDetailTable<T>({title,rows,columns,getRowKey,busy=false,readOnly=false,onAdd,onRemove,addLabel='新增明细',removeLabel='删除明细',emptyText='暂无明细',rowError,footer}:EditableDetailTableProps<T>) {
  const id=useId(),region=useRef<HTMLElement>(null),focusRow=useRef<number|null>(null);
  useLayoutEffect(()=>{
    if(focusRow.current===null)return;
    const index=Math.min(focusRow.current,rows.length-1);focusRow.current=null;
    const row=region.current?.querySelectorAll<HTMLElement>('tbody tr[data-detail-row]')[index];
    (row?.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled),select:not(:disabled),textarea:not(:disabled)')??region.current)?.focus();
  },[rows]);
  const actions=!readOnly&&Boolean(onRemove);
  return <section ref={region} className="editable-detail-table" aria-labelledby={id} tabIndex={-1} aria-busy={busy}>
    <div className="detail-table-header"><h3 id={id}>{title}</h3>{!readOnly&&onAdd?<Button type="button" label={addLabel} isDisabled={busy} onClick={()=>{focusRow.current=rows.length;onAdd();}}/>:null}</div>
    <div className="detail-table-scroll" role="region" aria-label={`${title}表格`} tabIndex={0}><Table>
      <thead><tr>{columns.map(column=><th scope="col" key={column.key}>{column.label}</th>)}{actions?<th scope="col">操作</th>:null}</tr></thead>
      <tbody>{rows.map((row,index)=>{
        const key=getRowKey(row,index),error=rowError?.(row,index);
        return <tr key={key} data-detail-row={key}>{columns.map((column,columnIndex)=><td key={column.key}>
          {column.render(row,index,{disabled:busy,readOnly})}
          {columnIndex===0&&error?<p role="alert" className="detail-row-error">{error}</p>:null}
        </td>)}{actions?<td><Button type="button" label={removeLabel} variant="ghost" isDisabled={busy} onClick={()=>{focusRow.current=index;onRemove?.(row,index);}}/></td>:null}</tr>;
      })}{rows.length===0?<tr><td colSpan={Math.max(1,columns.length+Number(actions))}>{emptyText}</td></tr>:null}</tbody>
    </Table></div>{footer?<div className="detail-table-footer">{footer}</div>:null}
  </section>;
}
