import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {PageResponseWorkflowPackageSummary,WorkflowPackageSummary,WorkflowPackageResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {useRetainedRead} from '../../app/useRetainedRead';
import {ListPage,ListToolbar} from '../../app/components/ListPage';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {Pagination} from '../../app/components/Pagination';
import {Button} from '../../ui/controls';
import {DataTable,type ColumnDef} from '../../ui/data';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';
import {WorkflowPackageEditor} from './WorkflowPackageEditor';
import {WorkflowReleasePanel} from './WorkflowReleasePanel';
import './workflow.css';

export function WorkflowPackagesPage(){
  const api=useApi(),read=useRetainedRead();
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[version,setVersion]=useState(0);
  const [data,setData]=useState<PageResponseWorkflowPackageSummary|null>(null),[loading,setLoading]=useState(true),[disabled,setDisabled]=useState(false);
  const [error,setError]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false);
  const [editor,setEditor]=useState<{draft:WorkflowPackageResponse|null}|null>(null),[detail,setDetail]=useState<WorkflowPackageResponse|null>(null);
  const [publishing,setPublishing]=useState<WorkflowPackageSummary|null>(null),detailRead=useRef<AbortController|null>(null);
  useEffect(()=>{
    if(detailRead.current?.signal.aborted){detailRead.current=null;setBusy(false);}
    return()=>detailRead.current?.abort();
  },[]);
  useEffect(()=>{
    const complete=read([api,page,pageSize,version]);if(!complete)return;
    const controller=new AbortController();setLoading(true);setError('');setData(null);setDisabled(false);
    api.getWorkflowStatus(controller.signal).then(async status=>{
      if(controller.signal.aborted)return;
      if(!status.enabled){setDisabled(true);setLoading(false);complete();return;}
      const rows=await api.listWorkflowPackages({page,pageSize},controller.signal);
      if(!controller.signal.aborted){setData(rows);setLoading(false);complete();}
    }).catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);complete();}});
    return()=>controller.abort();
  },[api,page,pageSize,version,read]);
  const open=useCallback(async(row:WorkflowPackageSummary,edit:boolean)=>{
    if(!row.id)return;detailRead.current?.abort();const controller=new AbortController();detailRead.current=controller;
    setBusy(true);setError('');
    try{const draft=await api.getWorkflowPackage(row.id,controller.signal);if(!controller.signal.aborted){if(edit)setEditor({draft});else setDetail(draft);}}
    catch(cause){if(!controller.signal.aborted)setError(errorMessage(cause));}finally{if(!controller.signal.aborted)setBusy(false);}
  },[api]);
  const validate=useCallback(async(row:WorkflowPackageSummary)=>{
    if(!row.id||!row.revision)return;setBusy(true);setError('');setFeedback('');
    try{await api.validateWorkflowPackage(row.id,row.revision);setFeedback('当前版本的审批场景已通过。');setVersion(value=>value+1);}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  },[api]);
  const columns=useMemo<ColumnDef<WorkflowPackageSummary>[]>(()=>[
    {accessorKey:'name',header:'流程名称'}, {accessorKey:'revision',header:'草稿版本'},
    {id:'proof',header:'校验状态',cell:({row})=>row.original.revision&&row.original.validatedRevision===row.original.revision?'已通过':'待校验'},
    {accessorKey:'updatedAt',header:'更新时间',cell:({row})=>row.original.updatedAt?new Date(row.original.updatedAt).toLocaleString('zh-CN'):'—'},
    {id:'actions',header:'操作',cell:({row})=><div className="post-row-actions">
      <Button label="详情" variant="ghost" size="sm" isDisabled={busy} onClick={()=>{void open(row.original,false);}}/>
      <PermissionGate permission="workflow:definition:edit"><Button label="编辑" variant="ghost" size="sm" isDisabled={busy} onClick={()=>{void open(row.original,true);}}/></PermissionGate>
      <PermissionGate permission="workflow:definition:validate"><Button label="校验" variant="ghost" size="sm" isDisabled={busy} onClick={()=>{void validate(row.original);}}/></PermissionGate>
      <PermissionGate permission="workflow:definition:publish"><Button label="发布" variant="ghost" size="sm" isDisabled={busy||!row.original.revision||row.original.validatedRevision!==row.original.revision} onClick={()=>setPublishing(row.original)}/></PermissionGate>
    </div>}
  ],[busy,open,validate]);
  async function publish(){
    if(busy||!publishing?.id||!publishing.revision)return;setBusy(true);setError('');
    try{await api.publishWorkflowPackage(publishing.id,publishing.revision);setPublishing(null);setFeedback('流程已发布，尚未改变当前启用版本。可在详情中选择激活。');setVersion(value=>value+1);}
    catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}
  }
  return <ListPage title="流程管理">
    <ListToolbar><PermissionGate permission="workflow:definition:edit"><Button label="新增流程包" variant="primary" isDisabled={busy||loading||disabled} onClick={()=>setEditor({draft:null})}/></PermissionGate><Button label="刷新列表" variant="ghost" isDisabled={busy||loading} onClick={()=>setVersion(value=>value+1)}/></ListToolbar>
    {disabled?<p role="status">工作流尚未启用，请联系管理员。</p>:null}
    {feedback?<p role="status">{feedback}</p>:null}
    {error&&!publishing?<div role="alert"><p>{error}</p><Button variant="secondary" label="重试列表" isDisabled={busy} onClick={()=>setVersion(value=>value+1)}/></div>:null}
    {!disabled?<><div className="post-table"><DataTable data={data?.items??[]} columns={columns} loading={loading} emptyText="暂无流程包，可新建请假审批流程。" pagination={false} sortable={false} showColumnVisibility={false}/></div><Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={busy} onPage={setPage} onSize={setPageSize}/></>:null}
    {editor?<WorkflowPackageEditor draft={editor.draft} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setFeedback('草稿已保存，请校验当前版本。');setVersion(value=>value+1);}}/>:null}
    {detail?<WorkflowReleasePanel draft={detail} onClose={()=>setDetail(null)}/>:null}
    {publishing?<ResourceDialog titleId="workflow-publish-title" alert busy={busy} onCancel={()=>{setPublishing(null);setError('');}}><h2 id="workflow-publish-title">确认发布流程</h2><p>将发布「{publishing.name}」版本 {publishing.revision}。发布后仍需单独激活，现有审批保持原版本。</p>{error?<p role="alert">{error}</p>:null}<div className="post-row-actions"><Button variant="primary" label={busy?'正在发布…':'确认发布'} isDisabled={busy} onClick={()=>{void publish();}}/><Button label="取消" variant="secondary" isDisabled={busy} onClick={()=>{setPublishing(null);setError('');}}/></div></ResourceDialog>:null}
  </ListPage>;
}
