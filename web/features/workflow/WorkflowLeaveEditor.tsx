import {useState,type FormEvent} from 'react';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDiscardChanges,usePageDraft} from '../../app/useDraftProtection';
import {PageForm,FormSection} from '../../ui/FormPage';
import {Button} from '../../ui/controls';
import {NativeInput,TextareaControl} from '../../ui/native';
import {errorMessage} from '../../integration/errors';

export function WorkflowLeaveEditor({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const api=useApi(),[submissionId]=useState(()=>crypto.randomUUID());
  const [form,setForm]=useState({startDate:'',endDate:'',reason:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=Boolean(form.startDate||form.endDate||form.reason),draft=usePageDraft(dirty),discard=useDiscardChanges(dirty,busy);
  function close(){draft.setDirty(false);onClose();}
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;
    if(form.startDate>form.endDate){setError('结束日期不能早于开始日期。');return;}
    setBusy(true);setError('');
    try{await api.submitWorkflowLeave({submissionId,...form});draft.setDirty(false);onSaved();}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  return <ResourceDialog titleId="workflow-leave-editor-title" busy={busy} onCancel={()=>discard.confirm(close)}>
    <h2 id="workflow-leave-editor-title">发起请假</h2>
    <PageForm onSubmit={event=>{void submit(event);}} actions={<><Button type="submit" variant="primary" label={busy?'正在提交…':'提交申请'} isDisabled={busy}/><Button label="取消" variant="secondary" isDisabled={busy} onClick={()=>discard.confirm(close)}/></>}>
      <FormSection title="请假信息">
        <label>开始日期<NativeInput aria-label="开始日期" type="date" required min="1970-01-01" max="9999-12-31" value={form.startDate} disabled={busy} onChange={event=>setForm({...form,startDate:event.target.value})}/></label>
        <label>结束日期<NativeInput aria-label="结束日期" type="date" required min={form.startDate||'1970-01-01'} max="9999-12-31" value={form.endDate} disabled={busy} onChange={event=>setForm({...form,endDate:event.target.value})}/></label>
        <label>请假事由<TextareaControl aria-label="请假事由" required maxLength={1000} rows={4} value={form.reason} disabled={busy} onChange={event=>setForm({...form,reason:event.target.value})}/></label>
      </FormSection>
      <p>申请将使用当前启用的流程版本。提交失败后重试会保留同一申请标识。</p>
      {error?<p role="alert">{error}</p>:null}
    </PageForm>
  </ResourceDialog>;
}
