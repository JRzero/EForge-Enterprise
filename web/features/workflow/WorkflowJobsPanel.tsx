import {useEffect,useMemo,useState} from 'react';
import type {WorkflowJobsResponse,WorkflowFailedJobResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {Pagination} from '../../app/components/Pagination';
import {DataTable,type ColumnDef} from '../../ui/data';
import {Button} from '../../ui/controls';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';

export function WorkflowJobsPanel({releaseId,dialogBusy,onBusy}:{releaseId:string;dialogBusy:boolean;onBusy:(busy:boolean)=>void}){
  const api=useApi(),[page,setPage]=useState(1),[size,setSize]=useState(10),[version,setVersion]=useState(0);
  const [data,setData]=useState<WorkflowJobsResponse|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[feedback,setFeedback]=useState('');
  const [selected,setSelected]=useState<{job:WorkflowFailedJobResponse;commandId:string}|null>(null);
  const blocked=busy||dialogBusy;
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setData(null);setSelected(null);
    api.listFailedWorkflowJobs(releaseId,{page,pageSize:size},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,releaseId,page,size,version]);
  const columns=useMemo<ColumnDef<WorkflowFailedJobResponse>[]>(()=>[
    {accessorKey:'id',header:'失败作业'},
    {accessorKey:'processId',header:'审批实例'},
    {accessorKey:'elementId',header:'流程节点'},
    {accessorKey:'createdAt',header:'创建时间',cell:({row})=>new Date(row.original.createdAt).toLocaleString('zh-CN')},
    {id:'actions',header:'操作',cell:({row})=><PermissionGate permission="workflow:operation:retry"><Button label="恢复作业" variant="ghost" size="sm" isDisabled={blocked||loading||!data?.recoveryEnabled||!row.original.leaveId} onClick={()=>{setSelected({job:row.original,commandId:crypto.randomUUID()});setFeedback('');}}/></PermissionGate>},
  ],[blocked,loading,data?.recoveryEnabled]);
  async function recover(){
    if(blocked||!selected?.job.leaveId)return;setBusy(true);onBusy(true);setError('');
    try{
      await api.retryWorkflowJob(selected.job.id,{commandId:selected.commandId,leaveId:selected.job.leaveId});
      setSelected(null);setFeedback('恢复请求已入队。请刷新查看结果；审批仍需人工处理。');setVersion(value=>value+1);
    }catch(cause){setError(errorMessage(cause));}finally{setBusy(false);onBusy(false);}
  }
  return <section aria-label="失败作业运维" aria-busy={loading} className="workflow-jobs">
    <h3>失败作业</h3><p>修复故障后可重新入队。恢复只创建待办，不会自动审批。</p>
    <Button label="刷新失败作业" variant="secondary" isDisabled={blocked||loading} onClick={()=>setVersion(value=>value+1)}/>
    {data&&!data.recoveryEnabled?<p role="status">当前环境未启用异步恢复，只能查看失败作业。</p>:null}
    {feedback?<p role="status">{feedback}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    <div className="post-table"><DataTable data={data?.page.items??[]} columns={columns} loading={loading} emptyText="该版本暂无失败作业。" pagination={false} sortable={false} showColumnVisibility={false}/></div>
    <Pagination page={page} pageSize={size} total={data?.page.total} loading={loading} busy={blocked} onPage={setPage} onSize={setSize} autoScroll={false}/>
    {selected?<section aria-label="确认恢复作业"><p>确认将作业 {selected.job.id} 重新入队？请先确认故障已修复。</p><div className="post-row-actions"><Button label={busy?'正在提交…':'确认恢复'} variant="primary" isDisabled={blocked} onClick={()=>{void recover();}}/><Button label="取消恢复" variant="secondary" isDisabled={blocked} onClick={()=>setSelected(null)}/></div></section>:null}
  </section>;
}
