import {useState} from 'react';
import {EditorPage,MasterDetailLayout,EditableDetailTable,FormField,NativeInput,Checkbox} from '../ui';

type Line={key:string;name:string;quantity:string;price:string};
export function MasterDetailDemo(){
  const [name,setName]=useState('示例采购单'),[rows,setRows]=useState<Line[]>([]),[readOnly,setReadOnly]=useState(false),[saved,setSaved]=useState('');
  const amount=(row:Line)=>Number(row.quantity)*Number(row.price);
  const invalid=(row:Line)=>!row.name.trim()||!row.quantity||!row.price||!Number.isFinite(amount(row))||Number(row.quantity)<=0||Number(row.price)<0;
  function change(key:string,patch:Partial<Line>){setRows(previous=>previous.map(row=>row.key===key?{...row,...patch}:row));}
  return <EditorPage title="采购单" description="主表与明细共用一次提交；此示例仅保存在页面中。" busy={false} readOnly={readOnly} saveLabel="保存采购单" cancelLabel={readOnly?'返回编辑':'清空采购单'}
    onCancel={()=>{if(readOnly){setReadOnly(false);return;}setName('');setRows([]);setSaved('');}}
    onSubmit={()=>setSaved(!name.trim()||rows.length===0||rows.some(invalid)?'请填写采购单名称及有效明细。':`已保存 ${rows.length} 行明细`)}>
    <Checkbox label="只读展示" value={readOnly} onChange={setReadOnly}/>
    <MasterDetailLayout master={<FormField label="采购单名称" required>{control=><NativeInput {...control} value={name} readOnly={readOnly} onChange={event=>setName(event.target.value)}/>}</FormField>}>
      <EditableDetailTable<Line> title="采购明细" rows={rows} getRowKey={row=>row.key} readOnly={readOnly}
        onAdd={()=>setRows(previous=>[...previous,{key:crypto.randomUUID(),name:'',quantity:'1',price:'0'}])}
        onRemove={row=>setRows(previous=>previous.filter(item=>item.key!==row.key))}
        rowError={row=>invalid(row)?'请填写名称，数量须大于零，单价不能为负。':undefined}
        columns={(['name','quantity','price'] as const).map((key)=>({key,label:{name:'商品名称',quantity:'数量',price:'单价'}[key],render:(row,index,state)=>state.readOnly?row[key]:<NativeInput aria-label={`${{name:'商品名称',quantity:'数量',price:'单价'}[key]} ${index+1}`} type={key==='name'?'text':'number'} step={key==='price'?'0.01':undefined} value={row[key]} disabled={state.disabled} onChange={event=>change(row.key,{[key]:event.target.value})}/>}))}
        footer={<>合计：{rows.reduce((sum,row)=>sum+(Number.isFinite(amount(row))?amount(row):0),0).toFixed(2)} 元</>}/>
    </MasterDetailLayout>{saved?<p role="status">{saved}</p>:null}
  </EditorPage>;
}
