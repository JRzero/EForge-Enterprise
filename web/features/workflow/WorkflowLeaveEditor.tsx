import {useState,type FormEvent} from 'react';
import {useApi} from '../../app/context';
import {EditorDialog} from '../../ui/EditorTemplate';
import {useDiscardChanges,usePageDraft} from '../../app/useDraftProtection';
import {FormSection} from '../../ui/FormPage';
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
  return <><EditorDialog title="发起请假" busy={busy} onCancel={()=>discard.confirm(close)} onSubmit={event=>{void submit(event);}} error={error} saveLabel="提交申请" busyLabel="正在提交…">
      <FormSection title="请假信息">
        <label>开始日期<NativeInput aria-label="开始日期" type="date" required min="1970-01-01" max="9999-12-31" value={form.startDate} disabled={busy} onChange={event=>setForm({...form,startDate:event.target.value})}/></label>
        <label>结束日期<NativeInput aria-label="结束日期" type="date" required min={form.startDate||'1970-01-01'} max="9999-12-31" value={form.endDate} disabled={busy} onChange={event=>setForm({...form,endDate:event.target.value})}/></label>
        <label>请假事由<TextareaControl aria-label="请假事由" required maxLength={1000} rows={4} value={form.reason} disabled={busy} onChange={event=>setForm({...form,reason:event.target.value})}/></label>
      </FormSection>
      <p>申请将使用当前启用的流程版本。提交失败后重试会保留同一申请标识。</p>
  </EditorDialog>{discard.dialog}</>;
}
