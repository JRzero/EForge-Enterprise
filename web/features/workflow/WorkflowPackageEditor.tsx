import {lazy,Suspense,useCallback,useRef,useState,type FormEvent} from 'react';
import type {DesignerHandle} from './WorkflowDesigner';
import {prepareDiagram} from './designer-xml';
import type {WorkflowPackageResponse,WorkflowScenarioRequest} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {useDiscardChanges,usePageDraft} from '../../app/useDraftProtection';
import {PageForm,FormSection} from '../../ui/FormPage';
import {Input,Button} from '../../ui/controls';
import {TextareaControl,NativeInput} from '../../ui/native';
import {errorMessage} from '../../integration/errors';
import exampleXml from '../../../workflows/leave-approval/process.bpmn20.xml?raw';

const exampleScenarios:WorkflowScenarioRequest[]=[
  {name:'批准',decisions:[{taskKey:'review',approved:true}],expectedEnd:'approvedEnd'},
  {name:'拒绝',decisions:[{taskKey:'review',approved:false}],expectedEnd:'rejectedEnd'}
];
const Designer=lazy(()=>import('./WorkflowDesigner').then(module=>({default:module.WorkflowDesigner})));
export function WorkflowPackageEditor({draft,onClose,onSaved}:{draft:WorkflowPackageResponse|null;onClose:()=>void;onSaved:()=>void}){
  const api=useApi();
  const [initial]=useState(()=>({name:draft?.name??'请假审批',xml:draft?.source?.bpmnXml??exampleXml,
    scenarios:JSON.stringify(draft?.source?.scenarios??exampleScenarios,null,2)}));
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [visual,setVisual]=useState(false),[diagramDirty,setDiagramDirty]=useState(false),[ready,setReady]=useState(false),designer=useRef<DesignerHandle>(null);
  const markDiagramDirty=useCallback(()=>setDiagramDirty(true),[]),markReady=useCallback((value:boolean)=>setReady(value),[]);
  const dirty=diagramDirty||JSON.stringify(form)!==JSON.stringify(initial),pageDraft=usePageDraft(dirty),discard=useDiscardChanges(dirty,busy);
  function close(){pageDraft.setDirty(false);onClose();}
  async function toggle(){
    if(busy)return;setError('');setBusy(true);
    try{if(visual){if(ready&&designer.current){const xml=await designer.current.save();setForm(current=>({...current,xml}));}setVisual(false);}
      else{prepareDiagram(form.xml);setReady(false);setVisual(true);}}
    catch(cause){setError(cause instanceof Error?cause.message:'无法切换编辑方式。');}finally{setBusy(false);}
  }
  async function exportXml(){
    if(busy)return;setBusy(true);setError('');
    try{const xml=visual?await designer.current!.save():form.xml;const url=URL.createObjectURL(new Blob([xml],{type:'application/xml;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='workflow.bpmn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(cause){setError(cause instanceof Error?cause.message:'无法导出，请确认画布已成功加载。');}finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setError('');
    let scenarios:WorkflowScenarioRequest[];
    try{
      const parsed:unknown=JSON.parse(form.scenarios);
      if(!Array.isArray(parsed)||parsed.length>20)throw new Error('invalid');
      // The canonical backend validates the complete scenario contract before any engine work.
      scenarios=parsed as WorkflowScenarioRequest[];
    }catch{setError('场景应为有效的 JSON 数组，最多 20 项。');return;}
    setBusy(true);const finishSave=pageDraft.beginSave();
    try{
      const xml=visual?await designer.current!.save():form.xml;
      if(visual)setForm(current=>({...current,xml}));
      const content={name:form.name,businessType:'leave',source:{bpmnXml:xml,scenarios}};
      if(draft){if(!draft.id||!draft.revision)throw new Error('流程版本缺失，请重新打开。');await api.updateWorkflowPackage(draft.id,{expectedRevision:draft.revision,content});}
      else await api.createWorkflowPackage(content);
      pageDraft.setDirty(false);onSaved();
    }catch(cause){setError(errorMessage(cause));}finally{finishSave();setBusy(false);}
  }
  return <><ResourceDialog titleId="workflow-editor-title" busy={busy} onCancel={()=>discard.confirm(close)}>
    <h2 id="workflow-editor-title">{draft?'编辑流程包':'新增流程包'}</h2>
    <PageForm onSubmit={event=>{void save(event);}} actions={<><Button type="submit" variant="primary" label={busy?'正在保存…':'保存草稿'} isDisabled={busy||visual&&!ready}/><Button label="取消" variant="secondary" isDisabled={busy} onClick={()=>discard.confirm(close)}/></>}>
      <FormSection title="基本信息"><Input label="流程名称" value={form.name} isDisabled={busy} aria-required="true" onChange={name=>setForm({...form,name})}/><p>业务：请假审批{draft?.revision?` · 当前草稿版本 ${draft.revision}`:''}</p></FormSection>
      <FormSection title="流程与验证">
        <div className="workflow-designer-toolbar"><Button label={visual?'返回 XML 源码':'可视化设计'} variant="primary" isDisabled={busy} onClick={()=>{void toggle();}}/><Button label="导出 BPMN" variant="secondary" isDisabled={busy||visual&&!ready} onClick={()=>{void exportXml();}}/></div>
        {visual?<Suspense fallback={<p role="status">正在加载设计器…</p>}><Designer ref={designer} initialXml={form.xml} onDirty={markDiagramDirty} onReady={markReady} disabled={busy}/></Suspense>:<><label>流程文件<TextareaControl aria-label="流程文件" required maxLength={262144} rows={12} value={form.xml} disabled={busy} onChange={event=>setForm({...form,xml:event.target.value})}/></label><label>导入 BPMN 文件<NativeInput type="file" accept=".bpmn,.xml" disabled={busy} onChange={event=>{
          const file=event.target.files?.[0];event.target.value='';if(!file||busy)return;setError('');
          if(file.size>1048576){setError('文件过大。');return;}setBusy(true);
          void file.text().then(xml=>{prepareDiagram(xml);setForm(current=>({...current,xml}));}).catch(()=>setError('导入失败：请检查 BPMN 文件，原草稿内容已保留。')).finally(()=>setBusy(false));
        }}/></label></>}
        <label>审批场景<TextareaControl aria-label="审批场景" required rows={10} value={form.scenarios} disabled={busy} onChange={event=>setForm({...form,scenarios:event.target.value})}/></label>
        <p>保存后需校验当前版本，发布后再选择是否激活。编辑不会改变正在运行的流程。</p>
      </FormSection>{error?<p role="alert">{error}</p>:null}
    </PageForm>
  </ResourceDialog>{discard.dialog}</>;
}
