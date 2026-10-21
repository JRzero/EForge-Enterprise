import {useEffect,useId,useState} from 'react';
import type {PurchaseAttachmentResponse,PurchaseCommandRequest,PurchaseDetailResponse} from '../../generated/api';
import {useApi,useBootstrap} from '../../app/context';
import {ResourceDialog} from '../../ui/ResourceDialog';
import {DetailField,DetailSection} from '../../ui/DetailPage';
import {AuditTimeline} from '../../ui/AuditTimeline';
import {Button} from '../../ui/controls';
import {NativeInput,TextareaControl,Table} from '../../ui/native';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';
import {PurchaseEditor} from './PurchaseEditor';

export const purchaseStatus=(status:string)=>({DRAFT:'草稿',PENDING:'审批中',APPROVED:'已批准',REJECTED:'已拒绝',WITHDRAWN:'已撤回'}[status]??status);
const labels={SUBMIT:'提交审批',APPROVE:'批准',REJECT:'拒绝',WITHDRAW:'撤回',ATTACH:'上传附件',REMOVE_ATTACHMENT:'删除附件'};
type Action=keyof typeof labels;
type Pending={action:Action;command:PurchaseCommandRequest;attempted:boolean;file?:File;attachmentId?:string};
export function PurchaseDetail({id,onClose,onChanged}:{id:string;onClose:()=>void;onChanged:()=>void}){
  const api=useApi(),bootstrap=useBootstrap(),titleId=useId();
  const [data,setData]=useState<PurchaseDetailResponse|null>(null),[attachments,setAttachments]=useState<PurchaseAttachmentResponse[]>([]);
  const [version,setVersion]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [selected,setSelected]=useState<Pending|null>(null),[editing,setEditing]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setData(null);setAttachments([]);setError('');
    void Promise.all([api.getPurchase(id,controller.signal),api.listPurchaseAttachments(id,controller.signal)]).then(([detail,files])=>{
      if(controller.signal.aborted)return;setData(detail);setAttachments(files);setLoading(false);
    }).catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,id,version]);
  function choose(action:Action,extra:Pick<Pending,'file'|'attachmentId'>={}){
    if(!data||busy||selected)return;setError('');setSelected({action,command:{commandId:crypto.randomUUID(),expectedRevision:data.purchase.revision,comment:''},attempted:false,...extra});
  }
  function refresh(){setSelected(null);setVersion(value=>value+1);onChanged();}
  async function confirm(){
    if(!selected||busy)return;setBusy(true);setError('');setSelected({...selected,attempted:true});
    try{
      const {action,command}=selected;
      if(action==='SUBMIT')await api.submitPurchase(id,command);
      else if(action==='WITHDRAW')await api.withdrawPurchase(id,command);
      else if(action==='ATTACH')await api.uploadPurchaseAttachment(id,command.commandId,command.expectedRevision,selected.file!);
      else if(action==='REMOVE_ATTACHMENT')await api.removePurchaseAttachment(id,selected.attachmentId!,command);
      else await api.decidePurchase(id,{command,approved:action==='APPROVE'});
      refresh();
    }catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  async function download(file:PurchaseAttachmentResponse){
    if(busy)return;setBusy(true);setError('');
    try{const blob=await api.downloadPurchaseAttachment(id,file.id);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  if(editing&&data)return <PurchaseEditor detail={data} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);refresh();}}/>;
  const owner=data?.purchase.initiatorId===bootstrap.user.id,draft=data?.purchase.status==='DRAFT',pending=data?.purchase.status==='PENDING',locked=busy||!!selected;
  return <ResourceDialog titleId={titleId} busy={busy} onCancel={onClose}>
    <h2 id={titleId}>采购申请详情</h2>
    {loading&&<p role="status">正在加载采购申请…</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!data&&<Button label="重试读取" onClick={()=>setVersion(value=>value+1)}/>}
    {data&&<>
      <DetailSection title="申请信息"><DetailField label="申请标题">{data.purchase.title}</DetailField><DetailField label="状态">{purchaseStatus(data.purchase.status)}</DetailField>
        <DetailField label="申请人编号">{data.purchase.initiatorId}</DetailField><DetailField label="审批人编号">{data.purchase.approverId}</DetailField>
        <DetailField label="采购事由">{data.purchase.reason}</DetailField><DetailField label="合计金额">{data.purchase.total} 元</DetailField>
        <DetailField label="创建时间">{new Date(data.purchase.createdAt).toLocaleString('zh-CN')}</DetailField><DetailField label="流程版本">{data.purchase.releaseId??'尚未提交'}</DetailField>
      </DetailSection>
      <section aria-label="采购明细"><h3>采购明细</h3><div className="post-table"><Table><thead><tr><th>采购内容</th><th>单位</th><th>数量</th><th>单价（元）</th><th>金额（元）</th></tr></thead><tbody>{data.items.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.unit}</td><td>{row.quantity}</td><td>{row.unitPrice}</td><td>{row.amount}</td></tr>)}</tbody></Table></div></section>
      <section aria-label="采购附件"><h3>采购附件</h3>{attachments.length?<ul>{attachments.map(file=><li key={file.id}><Button label={file.name} variant="ghost" isDisabled={locked} onClick={()=>{void download(file);}}/><span>{Math.ceil(file.size/1024)} KB</span>{draft&&owner&&<PermissionGate permission="sample:purchase:write"><Button label={`删除 ${file.name}`} variant="ghost" isDisabled={locked} onClick={()=>choose('REMOVE_ATTACHMENT',{attachmentId:file.id})}/></PermissionGate>}</li>)}</ul>:<p>暂无附件</p>}
        {draft&&owner&&<PermissionGate permission="sample:purchase:write"><label>添加附件<NativeInput type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={locked||attachments.length>=5} onChange={event=>{
          const file=event.target.files?.[0];event.target.value='';if(!file)return;
          if(file.size===0||file.size>5*1024*1024||! /\.(pdf|png|jpe?g)$/i.test(file.name)){setError('请选择不超过 5 MiB 的 PDF、PNG 或 JPEG 文件。');return;}
          choose('ATTACH',{file});
        }}/></label><p>最多 5 个附件，仅申请人和指定审批人可下载。</p></PermissionGate>}
      </section>
      <div className="post-row-actions">
        {draft&&owner&&<PermissionGate permission="sample:purchase:write"><Button label="编辑草稿" isDisabled={locked} onClick={()=>setEditing(true)}/><Button label="提交审批" variant="primary" isDisabled={locked} onClick={()=>choose('SUBMIT')}/></PermissionGate>}
        {pending&&owner&&<PermissionGate permission="sample:purchase:write"><Button label="撤回申请" isDisabled={locked} onClick={()=>choose('WITHDRAW')}/></PermissionGate>}
        {pending&&data.purchase.approverId===bootstrap.user.id&&<PermissionGate permission="sample:purchase:approve"><Button label="批准" variant="primary" isDisabled={locked} onClick={()=>choose('APPROVE')}/><Button label="拒绝" isDisabled={locked} onClick={()=>choose('REJECT')}/></PermissionGate>}
      </div>
      <AuditTimeline events={data.history.map((event,index)=>({key:String(index),action:labels[event.action as Action]??({CREATE:'创建草稿',UPDATE:'修改草稿'}[event.action]??event.action),actor:`账号 ${event.actorId}`,occurredAt:event.createdAt,comment:event.comment}))}/>
    </>}
    {selected&&<section aria-label="确认采购操作"><h3>确认{labels[selected.action]}</h3>{selected.file&&<p>{selected.file.name}</p>}
      {selected.action==='SUBMIT'&&<p>将按当前启用的采购流程提交给指定审批人，提交后不能再修改明细和附件。</p>}
      {selected.action==='REMOVE_ATTACHMENT'&&<p>删除后此附件将不能下载。</p>}
      {selected.action!=='ATTACH'&&selected.action!=='REMOVE_ATTACHMENT'&&<label>处理意见<TextareaControl maxLength={500} value={selected.command.comment} disabled={busy||selected.attempted} onChange={event=>setSelected({...selected,command:{...selected.command,comment:event.target.value}})}/></label>}
      {selected.attempted&&error&&<p>重试使用相同请求编号；也可重新读取服务器状态。</p>}
      <Button label={selected.attempted?'重试操作':'确认操作'} variant="primary" isDisabled={busy} onClick={()=>{void confirm();}}/>
      <Button label={selected.attempted?'重新读取状态':'取消操作'} isDisabled={busy} onClick={()=>{if(selected.attempted)refresh();else setSelected(null);}}/>
    </section>}
    <Button label="关闭详情" isDisabled={busy} onClick={onClose}/>
  </ResourceDialog>;
}
