import {ListFilters} from '../../app/components/ListPage';
import {Pagination} from '../../app/components/Pagination';
import {useEffect, useMemo, useState} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState} from '../../ui/data';
import {Button, Input} from '../../ui/controls';
import type {DatabaseTable, PageResponseDatabaseTable} from '../../generated/api';
import {useApi} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
export function GeneratorImport({onCancel,onImported}:{onCancel:()=>void;onImported:()=>void}) {
  const api=useApi();
  const [name,setName]=useState(''),[comment,setComment]=useState(''),[filters,setFilters]=useState({name:'',comment:''});
  const [pageSize,setPageSize]=useState(10);
  const [page,setPage]=useState(1),[version,setVersion]=useState(0),[data,setData]=useState<PageResponseDatabaseTable|null>(null);
  const [selection,setSelection]=useState<RowSelectionState>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setData(null);setSelection({});
    api.listGeneratorDatabaseTables({...filters,page,pageSize,sort:'name',direction:'asc'},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,filters,page,pageSize,version]);
  const columns=useMemo<ColumnDef<DatabaseTable>[]>(()=>[{accessorKey:'name',header:'表名称'},{accessorKey:'comment',header:'表描述'},
    {accessorKey:'createdAt',header:'创建时间',cell:({row})=>row.original.createdAt?new Date(row.original.createdAt).toLocaleString('zh-CN'):'—'}],[]);
  const names=(data?.items ?? []).filter(row=>selection['table:'+encodeURIComponent(row.name)]).map(row=>row.name);
  async function submit(){if(busy||!names.length)return;setBusy(true);setError('');try{await api.importGeneratorTables(names);onImported();}catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}}
  return <ResourceDialog titleId="generator-import-title" busy={busy} onCancel={onCancel}>
    <h2 id="generator-import-title">导入数据库表</h2>
    <ListFilters actions={<><Button label="查找数据库表" type="submit" isDisabled={busy}/><Button label="重置查找" isDisabled={busy} onClick={()=>{setName('');setComment('');setFilters({name:'',comment:''});setPage(1);setVersion(value=>value+1);}}/></>} onSubmit={event=>{event.preventDefault();setFilters({name,comment});setPage(1);setVersion(value=>value+1);}}>
      <Input label="待导入表名称" value={name} isDisabled={busy} onChange={setName}/><Input label="待导入表描述" value={comment} isDisabled={busy} onChange={setComment}/>

    </ListFilters>
    {error?<div role="alert">{error}<Button label="刷新数据库表" isDisabled={busy} onClick={()=>setVersion(value=>value+1)}/></div>:null}
    <DataTable data={data?.items ?? []} columns={columns} loading={loading} pagination={false} sortable={false} selectable showColumnVisibility={false} rowSelection={selection} onRowSelectionChange={setSelection} getRowId={row=>'table:'+encodeURIComponent(row.name)} getRowSelectionLabel={row=>'选择待导入表 '+row.name} emptyText="没有可导入的数据库表"/>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={busy} onPage={setPage} onSize={setPageSize} unit="张表" previousLabel="待导入上一页" nextLabel="待导入下一页" sizeLabel="待导入每页条数" />
    <Button label={busy?'正在导入…':'导入所选表'} isDisabled={busy||loading||!names.length} onClick={()=>{void submit();}}/><Button label="取消导入" isDisabled={busy} onClick={onCancel}/>
  </ResourceDialog>;
}
