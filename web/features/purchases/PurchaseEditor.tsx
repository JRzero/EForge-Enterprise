import {useCallback,useState,type FormEvent} from 'react';
import type {PurchaseDetailResponse,PurchaseEditRequest,PurchaseItemRequest,PurchaseResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {useDiscardChanges,usePageDraft} from '../../app/useDraftProtection';
import {EditorDialog} from '../../ui/EditorTemplate';
import {FormSection} from '../../ui/FormPage';
import {FormField} from '../../ui/FormField';
import {NativeInput,TextareaControl} from '../../ui/native';
import {ExactNumberInput} from '../../ui/ExactNumberInput';
import {EditableDetailTable,type DetailColumn} from '../../ui/EditableDetailTable';
import {RemoteRecordSelect,type RemoteRecordOption} from '../../ui/RemoteRecordSelect';
import {ApiError,errorMessage} from '../../integration/errors';

const newItem=():PurchaseItemRequest=>({id:crypto.randomUUID(),name:'',unit:'件',quantity:'1',unitPrice:'0.00'});
export function PurchaseEditor({detail,onClose,onSaved}:{detail?:PurchaseDetailResponse;onClose:()=>void;onSaved:(purchase:PurchaseResponse)=>void}){
  const api=useApi(),[commandId,setCommandId]=useState(()=>crypto.randomUUID());
  const [initial]=useState<PurchaseEditRequest>(()=>detail?{
    title:detail.purchase.title,reason:detail.purchase.reason,approverId:detail.purchase.approverId,
    items:detail.items.map(({id,name,unit,quantity,unitPrice})=>({id,name,unit,quantity,unitPrice}))
  }:{title:'',reason:'',approverId:'',items:[newItem()]});
  const [form,setForm]=useState(initial),[approver,setApprover]=useState<RemoteRecordOption|null>(()=>detail?{value:detail.purchase.approverId,label:`审批人 ${detail.purchase.approverId}`}:null);
  const [busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[error,setError]=useState('');
  const dirty=attempted||JSON.stringify(form)!==JSON.stringify(initial),draft=usePageDraft(dirty),discard=useDiscardChanges(dirty,busy);
  const locked=busy||attempted;
  const loadApprovers=useCallback(async({query,page,pageSize,signal}:{query:string;page:number;pageSize:number;signal:AbortSignal})=>{
    const data=await api.listPurchaseApprovers({query,page,pageSize},signal);
    return {items:data.items.map(item=>({value:item.id,label:item.name})),total:data.total};
  },[api]);
  function changeItem(id:string,key:keyof PurchaseItemRequest,value:string){setForm(current=>({...current,items:current.items.map(item=>item.id===id?{...item,[key]:value}:item)}));}
  const columns:DetailColumn<PurchaseItemRequest>[]=[
    {key:'name',label:'采购内容',render:(row,index,state)=><NativeInput id={state.field.id} aria-label={`第 ${index+1} 行采购内容`} required maxLength={200} value={row.name} disabled={state.disabled} onChange={event=>changeItem(row.id,'name',event.target.value)}/>},
    {key:'unit',label:'单位',render:(row,index,state)=><NativeInput id={state.field.id} aria-label={`第 ${index+1} 行单位`} required maxLength={20} value={row.unit} disabled={state.disabled} onChange={event=>changeItem(row.id,'unit',event.target.value)}/>},
    {key:'quantity',label:'数量',render:(row,index,state)=><ExactNumberInput id={state.field.id} aria-label={`第 ${index+1} 行数量`} required min="0.001" max="999999.999" scale={3} pattern="(0|[1-9][0-9]*)(\.[0-9]{1,3})?" title="请输入普通十进制数，最多3位小数，不使用指数或前导零" value={row.quantity} disabled={state.disabled} onValueChange={value=>changeItem(row.id,'quantity',value)}/>},
    {key:'unitPrice',label:'单价（元）',render:(row,index,state)=><ExactNumberInput id={state.field.id} aria-label={`第 ${index+1} 行单价`} required min="0" max="99999999.99" scale={2} pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?" title="请输入普通十进制数，最多2位小数，不使用指数或前导零" value={row.unitPrice} disabled={state.disabled} onValueChange={value=>changeItem(row.id,'unitPrice',value)}/>}
  ];
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;
    if(!form.approverId){setError('请选择审批人。');return;}
    if(!form.items.length){setError('至少需要一条采购明细。');return;}
    setBusy(true);setAttempted(true);setError('');const finish=draft.beginSave();
    try{
      const result=detail?await api.updatePurchaseDraft(detail.purchase.id,{command:{commandId,expectedRevision:detail.purchase.revision,comment:''},content:form}):await api.createPurchaseDraft({commandId,content:form});
      draft.setDirty(false);onSaved(result);
    }catch(cause){
      setError(errorMessage(cause));
      // A rejected validation request did not persist. Uncertain network/server outcomes
      // retain the original immutable command; never silently create another request.
      if(cause instanceof ApiError&&cause.status===400){setAttempted(false);setCommandId(crypto.randomUUID());}
    }finally{finish();setBusy(false);}
  }
  return <><EditorDialog title={detail?'编辑采购草稿':'新增采购申请'} busy={busy} error={error} saveLabel={attempted?'重试保存':'保存草稿'} onSubmit={event=>{void save(event);}} onCancel={()=>discard.confirm(()=>{draft.setDirty(false);onClose();})}>
    <FormSection title="采购信息">
      <FormField label="申请标题" required>{control=><NativeInput {...control} required maxLength={100} value={form.title} disabled={locked} onChange={event=>setForm({...form,title:event.target.value})}/>}</FormField>
      <RemoteRecordSelect label="指定审批人" required value={approver} disabled={locked} load={loadApprovers} onChange={value=>{setApprover(value);setForm({...form,approverId:value?.value??''});}} hint="只能选择拥有采购审批权限的有效账号，不能选择自己。"/>
      <FormField label="采购事由" required span="full">{control=><TextareaControl {...control} required maxLength={1000} rows={3} value={form.reason} disabled={locked} onChange={event=>setForm({...form,reason:event.target.value})}/>}</FormField>
    </FormSection>
    <EditableDetailTable title="采购明细" rows={form.items} columns={columns} getRowKey={row=>row.id} busy={locked} focusColumn="name"
      onAdd={form.items.length<100?()=>{const item=newItem();setForm(current=>({...current,items:[...current.items,item]}));return item.id;}:undefined}
      onRemove={row=>setForm(current=>({...current,items:current.items.filter(item=>item.id!==row.id)}))}/>
    <p>保存后由服务器精确计算金额，可在详情中添加附件并提交审批。保存草稿不会启动流程。</p>
    {attempted&&error&&<p>请求可能已到达服务器。重试使用同一内容和请求编号；如需修改，请关闭后从列表重新打开。</p>}
  </EditorDialog>{discard.dialog}</>;
}
