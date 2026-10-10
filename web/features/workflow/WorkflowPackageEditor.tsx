import {useState,type FormEvent} from 'react';
import type {WorkflowPackageResponse,WorkflowScenarioRequest} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDiscardChanges,usePageDraft} from '../../app/useDraftProtection';
import {PageForm,FormSection} from '../../ui/FormPage';
import {Input,Button} from '../../ui/controls';
import {TextareaControl} from '../../ui/native';
import {errorMessage} from '../../integration/errors';
import exampleXml from '../../../workflows/leave-approval/process.bpmn20.xml?raw';

const exampleScenarios:WorkflowScenarioRequest[]=[
  {name:'批准',decisions:[{taskKey:'review',approved:true}],expectedEnd:'approvedEnd'},
  {name:'拒绝',decisions:[{taskKey:'review',approved:false}],expectedEnd:'rejectedEnd'}
];
export function WorkflowPackageEditor({draft,onClose,onSaved}:{draft:WorkflowPackageResponse|null;onClose:()=>void;onSaved:()=>void}){
  const api=useApi();
  const [initial]=useState(()=>({name:draft?.name??'请假审批',xml:draft?.source?.bpmnXml??exampleXml,
    scenarios:JSON.stringify(draft?.source?.scenarios??exampleScenarios,null,2)}));
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=JSON.stringify(form)!==JSON.stringify(initial),pageDraft=usePageDraft(dirty),discard=useDiscardChanges(dirty,busy);
  function close(){pageDraft.setDirty(false);onClose();}
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setError('');
    let scenarios:WorkflowScenarioRequest[];
    try{
      const parsed:unknown=JSON.parse(form.scenarios);
      if(!Array.isArray(parsed)||parsed.length>20)throw new Error('invalid');
      // The canonical backend validates the complete scenario contract before any engine work.
      scenarios=parsed as WorkflowScenarioRequest[];
    }catch{setError('场景应为有效的 JSON 数组，最多 20 项。');return;}
    setBusy(true);
    try{
      const content={name:form.name,businessType:'leave',source:{bpmnXml:form.xml,scenarios}};
      if(draft){if(!draft.id||!draft.revision)throw new Error('流程版本缺失，请重新打开。');await api.updateWorkflowPackage(draft.id,{expectedRevision:draft.revision,content});}
      else await api.createWorkflowPackage(content);
      pageDraft.setDirty(false);onSaved();
    }catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  return <ResourceDialog titleId="workflow-editor-title" busy={busy} onCancel={()=>discard.confirm(close)}>
    <h2 id="workflow-editor-title">{draft?'编辑流程包':'新增流程包'}</h2>
    <PageForm onSubmit={event=>{void save(event);}} actions={<><Button type="submit" variant="primary" label={busy?'正在保存…':'保存草稿'} isDisabled={busy}/><Button label="取消" variant="secondary" isDisabled={busy} onClick={()=>discard.confirm(close)}/></>}>
      <FormSection title="基本信息"><Input label="流程名称" value={form.name} isDisabled={busy} aria-required="true" onChange={name=>setForm({...form,name})}/><p>业务：请假审批{draft?.revision?` · 当前草稿版本 ${draft.revision}`:''}</p></FormSection>
      <FormSection title="流程与验证"><label>流程文件<TextareaControl aria-label="流程文件" required maxLength={262144} rows={12} value={form.xml} disabled={busy} onChange={event=>setForm({...form,xml:event.target.value})}/></label>
        <label>审批场景<TextareaControl aria-label="审批场景" required rows={10} value={form.scenarios} disabled={busy} onChange={event=>setForm({...form,scenarios:event.target.value})}/></label>
        <p>保存后需校验当前版本，发布后再选择是否激活。编辑不会改变正在运行的流程。</p>
      </FormSection>{error?<p role="alert">{error}</p>:null}
    </PageForm>
  </ResourceDialog>;
}
