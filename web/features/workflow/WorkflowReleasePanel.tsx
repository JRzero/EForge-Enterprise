import {useEffect,useMemo,useState} from 'react';
import type {WorkflowPackageResponse,WorkflowReleaseResponse,PageResponseWorkflowReleaseResponse,WorkflowActivationResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {Pagination} from '../../app/components/Pagination';
import {DataTable,type ColumnDef} from '../../ui/data';
import {Button} from '../../ui/controls';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';
import {DetailSection,DetailField} from '../../ui/DetailPage';
import {WorkflowComparisonPanel} from './WorkflowComparisonPanel';

export function WorkflowReleasePanel({draft,onClose}:{draft:WorkflowPackageResponse;onClose:()=>void}){
  const api=useApi(),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[version,setVersion]=useState(0);
  const [data,setData]=useState<PageResponseWorkflowReleaseResponse|null>(null),[activation,setActivation]=useState<WorkflowActivationResponse|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
  const [selected,setSelected]=useState<WorkflowReleaseResponse|null>(null);
  const [baseline,setBaseline]=useState<WorkflowReleaseResponse|null>(null),[comparison,setComparison]=useState<{baselineId:string;targetId?:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setData(null);setActivation(null);setSelected(null);
    if(!draft.id){setError('流程标识缺失，请重新打开。');setLoading(false);return;}
    Promise.all([api.listWorkflowReleases(draft.id,{page,pageSize},controller.signal),api.getWorkflowActivation(controller.signal)])
      .then(([rows,active])=>{if(!controller.signal.aborted){setData(rows);setActivation(active);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,draft.id,page,pageSize,version]);
  const columns=useMemo<ColumnDef<WorkflowReleaseResponse>[]>(()=>[
    {accessorKey:'packageRevision',header:'发布版本'},
    {accessorKey:'name',header:'流程名称'},
    {id:'active',header:'状态',cell:({row})=>row.original.id===activation?.releaseId?'当前启用':'未启用'},
    {accessorKey:'publishedAt',header:'发布时间',cell:({row})=>row.original.publishedAt?new Date(row.original.publishedAt).toLocaleString('zh-CN'):'—'},
    {id:'actions',header:'操作',cell:({row})=><div className="post-row-actions">
      <Button label="设为基准" aria-label={`版本 ${row.original.packageRevision} 设为基准`} variant="ghost" size="sm" isDisabled={busy||loading||!row.original.id} onClick={()=>{setBaseline(row.original);setComparison(null);}}/>
      <Button label="比较此版本" aria-label={`比较版本 ${row.original.packageRevision}`} variant="ghost" size="sm" isDisabled={busy||loading||!baseline?.id||!row.original.id} onClick={()=>{if(baseline?.id&&row.original.id)setComparison({baselineId:baseline.id,targetId:row.original.id});}}/>
      <PermissionGate permission="workflow:definition:activate"><Button label="激活" aria-label={`激活版本 ${row.original.packageRevision}`} variant="ghost" size="sm" isDisabled={busy||loading||!row.original.id||row.original.id===activation?.releaseId} onClick={()=>{setSelected(row.original);setFeedback('');}}/></PermissionGate>
    </div>}
  ],[activation,baseline,busy,loading]);
  async function activate(){
    if(busy||!selected?.id||!activation?.revision)return;setBusy(true);setError('');
    try{await api.activateWorkflowRelease({releaseId:selected.id,expectedRevision:activation.revision});setSelected(null);setFeedback('已激活，新申请将使用所选版本。');setVersion(value=>value+1);}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  return <ResourceDialog titleId="workflow-releases-title" busy={busy} onCancel={onClose}>
    <h2 id="workflow-releases-title">流程详情与发布版本</h2>
    <DetailSection title="流程信息"><DetailField label="流程名称">{draft.name}</DetailField><DetailField label="草稿版本">{draft.revision}</DetailField><DetailField label="校验状态">{draft.validatedRevision===draft.revision?'当前版本已通过':'当前版本待校验'}</DetailField></DetailSection>
    <details><summary>查看流程文件与场景</summary><pre className="workflow-source">{draft.source?.bpmnXml}</pre><pre className="workflow-source">{JSON.stringify(draft.source?.scenarios,null,2)}</pre></details>
    <p>激活仅影响新申请，进行中的审批继续使用原版本。</p>
    {feedback?<p role="status">{feedback}</p>:null}
    {error?<div role="alert"><p>{error}</p><Button variant="secondary" label="重新读取版本" isDisabled={busy} onClick={()=>setVersion(value=>value+1)}/></div>:null}
    <div className="post-table"><DataTable data={data?.items??[]} columns={columns} loading={loading} emptyText="暂无发布版本，请先校验并发布草稿。" pagination={false} sortable={false} showColumnVisibility={false}/></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={busy} onPage={setPage} onSize={setPageSize} autoScroll={false}/>
    {baseline?<div className="post-row-actions"><span>对比基准：发布版本 {baseline.packageRevision}</span><Button label="与当前草稿对比" variant="secondary" isDisabled={busy||loading} onClick={()=>{if(baseline.id)setComparison({baselineId:baseline.id});}}/><Button label="清除对比" variant="ghost" onClick={()=>{setBaseline(null);setComparison(null);}}/></div>:null}
    {comparison&&draft.id?<WorkflowComparisonPanel packageId={draft.id} {...comparison}/>:null}
    {selected?<section aria-label="确认激活"><p>确认激活「{selected.name}」版本 {selected.packageRevision}？</p><div className="post-row-actions"><Button variant="primary" label={busy?'正在激活…':'确认激活'} isDisabled={busy} onClick={()=>{void activate();}}/><Button label="取消激活" variant="secondary" isDisabled={busy} onClick={()=>setSelected(null)}/></div></section>:null}
    <Button label="关闭" variant="secondary" isDisabled={busy} onClick={onClose}/>
  </ResourceDialog>;
}
