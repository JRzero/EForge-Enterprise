import {useLayoutEffect,useRef,useState} from 'react';
import {EditorPage,MasterDetailLayout,EditableDetailTable,FormField,NativeInput,Checkbox} from '../ui';
import type {FormErrorItem,FormErrorTarget} from '../ui';

type Line={key:string;name:string;quantity:string;price:string};
export function MasterDetailDemo(){
  const [name,setName]=useState('示例采购单'),[rows,setRows]=useState<Line[]>([]),[readOnly,setReadOnly]=useState(false),[saved,setSaved]=useState('');
  const [submission,setSubmission]=useState(0),summary=useRef<HTMLElement>(null),master=useRef<HTMLInputElement>(null),detail=useRef<HTMLDivElement>(null),inputs=useRef(new Map<string,HTMLInputElement>()),focusRequested=useRef(false);
  const amount=(row:Line)=>Number(row.quantity)*Number(row.price);
  const inputKey=(rowId:string,field:string)=>JSON.stringify([rowId,field]);
  function validate():FormErrorItem[]{
    const result:FormErrorItem[]=[];
    if(!name.trim())result.push({key:'name',label:'采购单名称',message:'请填写采购单名称。',target:{scope:'master',field:'name'}});
    if(!rows.length)result.push({key:'rows',label:'采购明细',message:'请新增至少一行明细。',target:{scope:'detail',field:'rows'}});
    rows.forEach((row,index)=>{
      const add=(field:string,label:string,message:string)=>result.push({key:inputKey(row.key,field),label:`${label} ${index+1}`,message,target:{scope:'detail',rowId:row.key,field}});
      if(!row.name.trim())add('name','商品名称','请填写商品名称。');
      if(!row.quantity||!Number.isFinite(Number(row.quantity))||Number(row.quantity)<=0)add('quantity','数量','数量须大于零。');
      if(!row.price||!Number.isFinite(Number(row.price))||Number(row.price)<0||!Number.isFinite(amount(row)))add('price','单价','请填写有效的非负单价和金额。');
    });return result;
  }
  const errors=submission&&!readOnly?validate():[];
  useLayoutEffect(()=>{if(focusRequested.current){focusRequested.current=false;summary.current?.focus();}},[submission]);
  function navigate(target:FormErrorTarget){
    if(readOnly)return;
    if(target.scope==='master'){master.current?.focus();return;}
    if(target.rowId!==undefined){const input=inputs.current.get(inputKey(target.rowId,target.field));if(input&&!input.disabled){input.focus();return;}}
    (detail.current?.querySelector<HTMLElement>('.detail-table-header button')??summary.current)?.focus();
  }
  function change(key:string,patch:Partial<Line>){setRows(previous=>previous.map(row=>row.key===key?{...row,...patch}:row));}
  return <EditorPage title="采购单" description="主表与明细共用一次提交；此示例仅保存在页面中。" busy={false} readOnly={readOnly} saveLabel="保存采购单" cancelLabel={readOnly?'返回编辑':'清空采购单'}
    errors={errors} onNavigateError={navigate} errorSummaryRef={summary}
    onCancel={()=>{if(readOnly){setReadOnly(false);return;}setName('');setRows([]);setSaved('');setSubmission(0);}}
    onSubmit={()=>{const invalid=validate().length>0;focusRequested.current=invalid;setSubmission(value=>value+1);setSaved(invalid?'请填写采购单名称及有效明细。':`已保存 ${rows.length} 行明细`);}}>
    <Checkbox label="只读展示" value={readOnly} onChange={setReadOnly}/>
    <MasterDetailLayout master={<FormField label="采购单名称" required error={errors.find(item=>item.key==='name')?.message}>{control=><NativeInput {...control} ref={master} value={name} readOnly={readOnly} onChange={event=>setName(event.target.value)}/>}</FormField>}>
      <div ref={detail}>
      <EditableDetailTable<Line> title="采购明细" rows={rows} getRowKey={row=>row.key} readOnly={readOnly}
        onAdd={()=>{const key=crypto.randomUUID();setRows(previous=>[...previous,{key,name:'',quantity:'1',price:'0'}]);return key;}}
        onRemove={row=>setRows(previous=>previous.filter(item=>item.key!==row.key))}
        cellError={(rowId,field)=>errors.find(item=>item.key===inputKey(rowId,field))?.message}
        columns={(['name','quantity','price'] as const).map((key)=>({key,label:{name:'商品名称',quantity:'数量',price:'单价'}[key],render:(row,index,state)=>state.readOnly?row[key]:<FormField id={state.field.id} label={`${{name:'商品名称',quantity:'数量',price:'单价'}[key]} ${index+1}`} error={state.field.error}>{control=><NativeInput {...control} ref={node=>{const identity=inputKey(row.key,key);if(node)inputs.current.set(identity,node);else inputs.current.delete(identity);}} type={key==='name'?'text':'number'} step={key==='price'?'0.01':undefined} value={row[key]} disabled={state.disabled} onChange={event=>change(row.key,{[key]:event.target.value})}/>}</FormField>}))}
        footer={<>合计：{rows.reduce((sum,row)=>sum+(Number.isFinite(amount(row))?amount(row):0),0).toFixed(2)} 元</>}/>
      </div>
    </MasterDetailLayout>{saved?<p role="status">{saved}</p>:null}
  </EditorPage>;
}
