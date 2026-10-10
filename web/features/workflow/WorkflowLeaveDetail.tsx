import {useEffect,useState} from 'react';
import type {LeaveDetailResponse,LeaveCommandRequest} from '../../generated/api';
import {useApi,useBootstrap} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {DetailSection,DetailField} from '../../ui/DetailPage';
import {Button} from '../../ui/controls';
import {TextareaControl} from '../../ui/native';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';

export function leaveStatus(value:string){return ({PENDING:'审批中',APPROVED:'已批准',REJECTED:'已拒绝',WITHDRAWN:'已撤回'} as Record<string,string>)[value]??value;}
const actionLabels={CLAIM:'领取',APPROVE:'批准',REJECT:'拒绝',WITHDRAW:'撤回'};
type Action=keyof typeof actionLabels;
type PendingCommand={action:Action;command:LeaveCommandRequest;attempted:boolean};

export function WorkflowLeaveDetail({id,onClose,onChanged}:{id:string;onClose:()=>void;onChanged:()=>void}){
  const api=useApi(),bootstrap=useBootstrap();
  const [data,setData]=useState<LeaveDetailResponse|null>(null),[version,setVersion]=useState(0),[loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[selected,setSelected]=useState<PendingCommand|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setLoading(true);setError('');setSelected(null);
    api.getWorkflowLeave(id,controller.signal).then(detail=>{if(!controller.signal.aborted){setData(detail);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,id,version]);
  function choose(action:Action,taskId?:string){
    if(!data)return;setError('');setSelected({action,attempted:false,command:{commandId:crypto.randomUUID(),expectedRevision:data.leave.revision,comment:'',...(taskId?{taskId}:{})}});
  }
  async function confirm(){
    if(!selected||busy)return;setBusy(true);setError('');setSelected({...selected,attempted:true});
    try{
      if(selected.action==='CLAIM')await api.claimWorkflowLeaveTask(id,selected.command);
      else if(selected.action==='WITHDRAW')await api.withdrawWorkflowLeave(id,selected.command);
      else await api.decideWorkflowLeaveTask(id,{command:selected.command,approved:selected.action==='APPROVE'});
      setFeedback(`已${actionLabels[selected.action]}。`);setSelected(null);setVersion(value=>value+1);onChanged();
    }catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  const pending=data?.leave.status==='PENDING';
  return <ResourceDialog titleId="workflow-leave-detail-title" busy={busy} onCancel={onClose}>
    <h2 id="workflow-leave-detail-title">请假审批详情</h2>
    {loading?<p role="status">正在读取审批…</p>:null}
    {feedback?<p role="status">{feedback}</p>:null}
    {data?<>
      <DetailSection title="申请信息">
        <DetailField label="申请编号">{data.leave.id}</DetailField><DetailField label="状态">{leaveStatus(data.leave.status)}</DetailField>
        <DetailField label="申请人编号">{data.leave.initiatorId}</DetailField><DetailField label="开始日期">{data.leave.startDate}</DetailField>
        <DetailField label="结束日期">{data.leave.endDate}</DetailField><DetailField label="请假事由">{data.leave.reason}</DetailField>
        <DetailField label="提交时间">{new Date(data.leave.createdAt).toLocaleString('zh-CN')}</DetailField><DetailField label="流程版本标识">{data.leave.releaseId}</DetailField>
      </DetailSection>
      <DetailSection title="当前任务">
        {data.tasks.length?data.tasks.map(task=><DetailField label={task.name||task.key} key={task.id}>{task.assignee?`已领取 · 账号 ${task.assignee}`:'待领取'}
          {pending&&task.canHandle?<PermissionGate permission="workflow:task:handle"><div className="post-row-actions">
            {!task.assignee?<Button label="领取" variant="primary" isDisabled={busy||Boolean(selected)} onClick={()=>choose('CLAIM',task.id)}/>:null}
            {task.assignee===bootstrap.user.id?<><Button label="批准" variant="primary" isDisabled={busy||Boolean(selected)} onClick={()=>choose('APPROVE',task.id)}/><Button label="拒绝" variant="secondary" isDisabled={busy||Boolean(selected)} onClick={()=>choose('REJECT',task.id)}/></>:null}
          </div></PermissionGate>:null}
        </DetailField>):<DetailField label="任务">流程已结束</DetailField>}
      </DetailSection>
      <section aria-label="处理记录"><h2>处理记录</h2><ol className="workflow-history">{data.history.map((event,index)=><li key={index}><strong>{event.action==='SUBMIT'?'提交':actionLabels[event.action as Action]??event.action}</strong><span>账号 {event.actorId} · {new Date(event.createdAt).toLocaleString('zh-CN')}</span>{event.comment?<p>{event.comment}</p>:null}</li>)}</ol></section>
      {pending&&data.leave.initiatorId===bootstrap.user.id?<PermissionGate permission="workflow:request:withdraw"><Button label="撤回申请" variant="secondary" isDisabled={busy||Boolean(selected)} onClick={()=>choose('WITHDRAW')}/></PermissionGate>:null}
    </>:null}
    {selected?<section className="workflow-confirm" aria-label="确认审批操作"><h2>确认{actionLabels[selected.action]}</h2>
      <p>{selected.action==='WITHDRAW'?'撤回后将结束此申请的当前流程。':`将${actionLabels[selected.action]}当前审批任务。`}</p>
      <label>处理意见<TextareaControl aria-label="处理意见" rows={3} maxLength={500} value={selected.command.comment} disabled={busy||selected.attempted} onChange={event=>setSelected({...selected,command:{...selected.command,comment:event.target.value}})}/></label>
      <div className="post-row-actions"><Button variant="primary" label={busy?'正在处理…':`确认${actionLabels[selected.action]}`} isDisabled={busy} onClick={()=>{void confirm();}}/><Button label="取消操作" variant="secondary" isDisabled={busy} onClick={()=>{setSelected(null);setError('');}}/></div>
    </section>:null}
    {error?<p role="alert">{error}</p>:null}
    <div className="post-row-actions"><Button label="重新读取" variant="secondary" isDisabled={busy||loading} onClick={()=>setVersion(value=>value+1)}/><Button label="关闭" variant="secondary" isDisabled={busy} onClick={onClose}/></div>
  </ResourceDialog>;
}
