import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Button, Input} from '@eforge/ui';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDictionary, DictionaryNotice, DictionaryOptions} from '../../app/useDictionary';
import type {JobWriteRequest} from '../../generated/api';
import {errorMessage} from '../../integration/errors';
import {CronEditor} from './CronEditor';
const initial: JobWriteRequest={name:'',group:'DEFAULT',invokeTarget:'',cronExpression:'',misfirePolicy:'1',concurrent:false,status:'1',remark:''};
export function JobEditor({id,onClose,onSaved}: {id: string | null;onClose:()=>void;onSaved:()=>void}) {
  const api=useApi(),groups=useDictionary('sys_job_group'),statuses=useDictionary('sys_job_status');
  const [draft,setDraft]=useState<JobWriteRequest>(initial),[loading,setLoading]=useState(id!==null),[readError,setReadError]=useState(''),[error,setError]=useState(''),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[cron,setCron]=useState(false);
  const pending=useRef(false),cronOpener=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(!id)return;
    const controller=new AbortController();setLoading(true);setReadError('');
    api.getJob(id,controller.signal).then(row=>{if(!controller.signal.aborted){setDraft({name:row.name??'',group:row.group??'DEFAULT',invokeTarget:row.invokeTarget??'',cronExpression:row.cronExpression??'',misfirePolicy:(row.misfirePolicy??'1') as JobWriteRequest['misfirePolicy'],concurrent:row.concurrent??false,status:(row.status??'1') as JobWriteRequest['status'],remark:row.remark??''});setLoading(false);}}).catch(cause=>{if(!controller.signal.aborted){setReadError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,id,version]);
  useEffect(()=>{if(!cron&&cronOpener.current){cronOpener.current.focus();cronOpener.current=null;}},[cron]);
  async function save(event:FormEvent){
    event.preventDefault();if(pending.current||loading||readError)return;
    if(!draft.name.trim()||!draft.group.trim()||!draft.invokeTarget.trim()||!draft.cronExpression.trim()||draft.name.length>64||draft.group.length>64||draft.invokeTarget.length>500||draft.cronExpression.length>255||(draft.remark?.length??0)>500){setError('请检查必填内容及长度：名称和组名最多64字，调用目标及备注最多500字，Cron最多255字。');return;}
    pending.current=true;setBusy(true);setError('');
    try{if(id)await api.updateJob(id,draft);else await api.createJob(draft);onSaved();}
    catch(cause){setError(errorMessage(cause));}finally{pending.current=false;setBusy(false);}
  }
  return <><ResourceDialog titleId="job-editor-title" busy={busy||cron} onCancel={onClose}>
    <h2 id="job-editor-title">{id?'修改任务':'新增任务'}</h2><DictionaryNotice dictionary={groups}/><DictionaryNotice dictionary={statuses}/>
    {loading?<p role="status">正在加载任务…</p>:readError?<><p role="alert">{readError}</p><Button label="重试任务表单" onClick={()=>setVersion(value=>value+1)}/></>:<form onSubmit={event=>{void save(event);}}>
      <Input label="任务名称" value={draft.name} onChange={name=>setDraft({...draft,name})} isDisabled={busy} isRequired/>
      <label>任务组名<select aria-label="表单任务组名" value={draft.group} disabled={busy} onChange={event=>setDraft({...draft,group:event.target.value})}><DictionaryOptions options={groups.options} current={draft.group}/></select></label>
      <Input label="调用目标字符串" value={draft.invokeTarget} onChange={invokeTarget=>setDraft({...draft,invokeTarget})} isDisabled={busy} isRequired/>
      <p>支持 Bean 或完整类名的方法调用，参数可为字符串、布尔值、长整型（L）、浮点型（D）和整型。例如 ryTask.ryParams('内容')。</p>
      <Input label="表单Cron表达式" value={draft.cronExpression} onChange={cronExpression=>setDraft({...draft,cronExpression})} isDisabled={busy} isRequired/>
      <Button type="button" label="编辑表单Cron表达式" variant="ghost" isDisabled={busy} onClick={event=>{cronOpener.current=event.currentTarget;setCron(true);}}/>
      <label>计划策略<select aria-label="计划策略" disabled={busy} value={draft.misfirePolicy} onChange={event=>setDraft({...draft,misfirePolicy:event.target.value as JobWriteRequest['misfirePolicy']})}><option value="0">默认</option><option value="1">立即触发执行</option><option value="2">触发一次执行</option><option value="3">不触发立即执行</option></select></label>
      <label>并发执行<select aria-label="并发执行" disabled={busy} value={draft.concurrent?'0':'1'} onChange={event=>setDraft({...draft,concurrent:event.target.value==='0'})}><option value="0">允许</option><option value="1">禁止</option></select></label>
      {id?<label>任务状态<select aria-label="表单任务状态" value={draft.status} disabled={busy} onChange={event=>setDraft({...draft,status:event.target.value as JobWriteRequest['status']})}><DictionaryOptions options={statuses.options} current={draft.status}/></select></label>:<p>新增任务默认暂停，保存后可在列表中启用。</p>}
      <Input label="备注" value={draft.remark??''} onChange={remark=>setDraft({...draft,remark})} isDisabled={busy}/>
      {error&&<p role="alert">{error}</p>}<Button label="取消" type="button" variant="ghost" isDisabled={busy} onClick={onClose}/><Button label="保存任务" type="submit" isDisabled={busy}/>
    </form>}
    {(loading||readError)&&<Button label="取消" isDisabled={busy} onClick={onClose}/>}</ResourceDialog>
    {cron&&<CronEditor value={draft.cronExpression} onCancel={()=>setCron(false)} onConfirm={expression=>{setDraft({...draft,cronExpression:expression});setCron(false);}}/>}
  </>;
}
