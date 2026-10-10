import {useEffect,useMemo,useState} from 'react';
import type {LeaveResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {useRetainedRead} from '../../app/useRetainedRead';
import {ListPage,ListToolbar} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {Button} from '../../ui/controls';
import {DataTable,type ColumnDef} from '../../ui/data';
import {PermissionGate} from '../../ui/patterns';
import {errorMessage} from '../../integration/errors';
import {WorkflowLeaveEditor} from './WorkflowLeaveEditor';
import {WorkflowLeaveDetail,leaveStatus} from './WorkflowLeaveDetail';
import './workflow.css';

export function WorkflowRequestsPage(){return <WorkflowLeavesPage mine/>;}
export function WorkflowTasksPage(){return <WorkflowLeavesPage mine={false}/>;}
function WorkflowLeavesPage({mine}:{mine:boolean}){
  const api=useApi(),read=useRetainedRead();
  const [handled,setHandled]=useState(false),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[version,setVersion]=useState(0);
  const [rows,setRows]=useState<LeaveResponse[]>([]),[total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true),[disabled,setDisabled]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
  const [editor,setEditor]=useState(false),[selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{
    const complete=read([api,mine,handled,page,pageSize,version]);if(!complete)return;
    const controller=new AbortController();setLoading(true);setRows([]);setTotal(0);setError('');setDisabled(false);
    void api.getWorkflowStatus(controller.signal).then(async status=>{
      if(controller.signal.aborted)return;
      if(!status.enabled){setDisabled(true);setLoading(false);complete();return;}
      const query={page,pageSize};
      if(!mine&&!handled){const data=await api.listPendingWorkflowLeaves(query,controller.signal);if(controller.signal.aborted)return;setRows(data.items.map(item=>item.leave));setTotal(data.total);}
      else{const data=await (mine?api.listMyWorkflowLeaves(query,controller.signal):api.listHandledWorkflowLeaves(query,controller.signal));if(controller.signal.aborted)return;setRows(data.items);setTotal(data.total);}
      setLoading(false);complete();
    }).catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);complete();}});
    return()=>controller.abort();
  },[api,mine,handled,page,pageSize,version,read]);
  const columns=useMemo<ColumnDef<LeaveResponse>[]>(()=>[
    {accessorKey:'reason',header:'请假事由'}, {accessorKey:'initiatorId',header:'申请人编号'},
    {accessorKey:'startDate',header:'开始日期'}, {accessorKey:'endDate',header:'结束日期'},
    {id:'status',header:'状态',cell:({row})=>leaveStatus(row.original.status)},
    {accessorKey:'createdAt',header:'提交时间',cell:({row})=>new Date(row.original.createdAt).toLocaleString('zh-CN')},
    {id:'actions',header:'操作',cell:({row})=><Button label="详情" variant="ghost" size="sm" onClick={()=>setSelected(row.original.id)}/>}
  ],[]);
  return <ListPage title={mine?'我发起的审批':'审批任务'}>
    <ListToolbar>
      {mine?<PermissionGate permission="workflow:request:submit"><Button variant="primary" label="发起请假" isDisabled={loading||disabled} onClick={()=>setEditor(true)}/></PermissionGate>:<><Button label="待办" variant={handled?'secondary':'primary'} onClick={()=>{setHandled(false);setPage(1);}}/><Button label="已办" variant={handled?'primary':'secondary'} onClick={()=>{setHandled(true);setPage(1);}}/></>}
      <Button label="刷新列表" variant="ghost" isDisabled={loading} onClick={()=>setVersion(value=>value+1)}/>
    </ListToolbar>
    {disabled?<p role="status">工作流尚未启用，请联系管理员。</p>:null}
    {feedback?<p role="status">{feedback}</p>:null}
    {error?<div role="alert"><p>{error}</p><Button label="重试列表" variant="secondary" onClick={()=>setVersion(value=>value+1)}/></div>:null}
    {!disabled?<><div className="post-table"><DataTable data={rows} columns={columns} loading={loading} emptyText={mine?'暂无申请，可发起请假审批。':handled?'暂无已处理的审批。':'暂无待处理的审批。'} pagination={false} sortable={false} showColumnVisibility={false}/></div><Pagination page={page} pageSize={pageSize} total={total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize}/></>:null}
    {editor?<WorkflowLeaveEditor onClose={()=>setEditor(false)} onSaved={()=>{setEditor(false);setFeedback('请假申请已提交。');setPage(1);setVersion(value=>value+1);}}/>:null}
    {selected?<WorkflowLeaveDetail id={selected} onClose={()=>setSelected(null)} onChanged={()=>setVersion(value=>value+1)}/>:null}
  </ListPage>;
}
