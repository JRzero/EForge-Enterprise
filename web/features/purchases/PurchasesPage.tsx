import {useEffect,useMemo,useState} from 'react';
import type {PurchaseResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {useRetainedRead} from '../../app/useRetainedRead';
import {ListPage,ListToolbar,ListFilters} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {Button} from '../../ui/controls';
import {DataTable,type ColumnDef} from '../../ui/data';
import {PermissionGate} from '../../ui/patterns';
import {Select} from '../../ui/native';
import {errorMessage} from '../../integration/errors';
import {PurchaseEditor} from './PurchaseEditor';
import {PurchaseDetail,purchaseStatus} from './PurchaseDetail';

export function PurchasesPage(){
  const api=useApi(),read=useRetainedRead();
  const [view,setView]=useState('mine'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[version,setVersion]=useState(0);
  const [status,setStatus]=useState(''),[statusDraft,setStatusDraft]=useState('');
  const [rows,setRows]=useState<PurchaseResponse[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[disabled,setDisabled]=useState(false),[error,setError]=useState('');
  const [editor,setEditor]=useState(false),[selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{
    const complete=read([api,view,status,page,pageSize,version]);if(!complete)return;
    const controller=new AbortController();setLoading(true);setRows([]);setTotal(0);setError('');setDisabled(false);
    void api.getWorkflowStatus(controller.signal).then(async engineStatus=>{
      if(controller.signal.aborted)return;
      if(!engineStatus.enabled){setDisabled(true);setLoading(false);complete();return;}
      const data=await api.listPurchases({view,status,page,pageSize},controller.signal);
      if(controller.signal.aborted)return;setRows(data.items);setTotal(data.total);setLoading(false);complete();
    }).catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);complete();}});
    return()=>controller.abort();
  },[api,read,view,status,page,pageSize,version]);
  const columns=useMemo<ColumnDef<PurchaseResponse>[]>(()=>[
    {accessorKey:'title',header:'申请标题'}, {accessorKey:'initiatorId',header:'申请人编号'}, {accessorKey:'approverId',header:'审批人编号'},
    {accessorKey:'total',header:'金额（元）'}, {id:'status',header:'状态',cell:({row})=>purchaseStatus(row.original.status)},
    {id:'createdAt',header:'创建时间',cell:({row})=>new Date(row.original.createdAt).toLocaleString('zh-CN')},
    {id:'actions',header:'操作',cell:({row})=><Button label="详情" variant="ghost" size="sm" onClick={()=>setSelected(row.original.id)}/>}
  ],[]);
  return <ListPage title="采购审批">
    <ListFilters onSubmit={event=>{event.preventDefault();setStatus(statusDraft);setPage(1);setVersion(value=>value+1);}} actions={<><Button type="submit" label="查询" variant="primary" isDisabled={loading}/><Button label="重置" isDisabled={loading} onClick={()=>{setStatusDraft('');setStatus('');setPage(1);}}/></>}>
      <label>申请状态<Select value={statusDraft} onChange={event=>setStatusDraft(event.target.value)}><option value="">全部</option>{['DRAFT','PENDING','APPROVED','REJECTED','WITHDRAWN'].map(value=><option key={value} value={value}>{purchaseStatus(value)}</option>)}</Select></label>
    </ListFilters>
    <ListToolbar><PermissionGate permission="sample:purchase:write"><Button label="新增采购申请" variant="primary" isDisabled={loading||disabled} onClick={()=>setEditor(true)}/></PermissionGate>
      <Button label="我发起的" variant={view==='mine'?'primary':'secondary'} onClick={()=>{setView('mine');setPage(1);}}/>
      <PermissionGate permission="sample:purchase:approve">{([['pending','待我审批'],['handled','已处理']] as const).map(([value,label])=><Button key={value} label={label} variant={view===value?'primary':'secondary'} onClick={()=>{setView(value);setPage(1);}}/>)}</PermissionGate>
      <Button label="刷新列表" variant="ghost" isDisabled={loading} onClick={()=>setVersion(value=>value+1)}/>
    </ListToolbar>
    {disabled&&<p role="status">工作流尚未启用，请联系管理员。</p>}
    {error&&<div role="alert"><p>{error}</p><Button label="重试列表" onClick={()=>setVersion(value=>value+1)}/></div>}
    {!disabled&&<><div className="post-table"><DataTable data={rows} columns={columns} loading={loading} emptyText="暂无采购申请" pagination={false} sortable={false} showColumnVisibility={false}/></div>
      <Pagination page={page} pageSize={pageSize} total={total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize}/></>}
    {editor&&<PurchaseEditor onClose={()=>setEditor(false)} onSaved={purchase=>{setEditor(false);setSelected(purchase.id);setVersion(value=>value+1);}}/>}
    {selected&&<PurchaseDetail id={selected} onClose={()=>setSelected(null)} onChanged={()=>setVersion(value=>value+1)}/>}
  </ListPage>;
}
