import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider,FormField,NativeInput,CheckboxGroup,RadioGroup,DateRangeField,EditableDetailTable} from '../../ui';
import '../../ui/theme.css';

function States(){
  const [radio,setRadio]=useState('9007199254740993'),[checks,setChecks]=useState(['missing']);
  const unchanged=()=>{throw Error('Protected state was changed');};
  return <EForgeProvider><main style={{padding:20,maxWidth:720}}>
    <FormField label="必填编码" required hint="请填写业务编码" error="编码已存在">{props=><NativeInput {...props} defaultValue="A001"/>}</FormField>
    <FormField label="只读编码">{props=><NativeInput {...props} value="固定值" readOnly/>}</FormField>
    <FormField label="禁用编码">{props=><NativeInput {...props} value="不可编辑" disabled/>}</FormField>
    <RadioGroup label="原值单选" value={radio} onChange={setRadio} options={[{value:'active',label:'有效项'},{value:'disabled',label:'停用项',disabled:true}]} unknownLabel={id=>`旧选项 ${id}`}/>
    <RadioGroup label="只读单选" value="missing" onChange={unchanged} options={[]} readOnly/>
    <RadioGroup label="空单选" value={null} onChange={unchanged} options={[]}/>
    <CheckboxGroup label="原值多选" value={checks} onChange={setChecks} options={[{value:'disabled',label:'停用项',disabled:true}]} unknownLabel={id=>`旧选项 ${id}`}/>
    <CheckboxGroup label="禁用多选" value={['old']} onChange={unchanged} options={[]} disabled/>
    <CheckboxGroup label="只读选项" value={['old']} onChange={unchanged} options={[]} readOnly/>
    <DateRangeField label="只读日期" value={{from:'2026-10-01',to:'2026-10-13'}} onChange={unchanged} readOnly/>
    <DateRangeField label="禁用日期" value={{from:'',to:''}} onChange={unchanged} disabled/>
    <EditableDetailTable title="保存中明细" rows={[{id:'1'}]} getRowKey={row=>row.id} busy onAdd={unchanged} onRemove={unchanged} columns={[{key:'id',label:'编号',render:(row,_index,state)=><NativeInput aria-label="明细编号" value={row.id} disabled={state.disabled} onChange={unchanged}/>}]} rowError={()=>'请检查此行'}/>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<States/>);
