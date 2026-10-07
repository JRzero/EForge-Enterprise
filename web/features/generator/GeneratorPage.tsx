import {Pagination} from '../../app/components/Pagination';
import {ColumnVisibilityMenu} from '../../app/components/ColumnVisibilityMenu';
import {useRetainedRead} from '../../app/useRetainedRead';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DataTable, type ColumnDef, type RowSelectionState, type VisibilityState} from '@eforge/data';
import {PageHeader, PermissionGate} from '@eforge/patterns';
import {Button, Input} from '@eforge/ui';
import type {TableSummary, TableDetail, PageResponseTableSummary, PreviewResponse, Creation, CustomOutputResult} from '../../generated/api';
import {useApi, useBootstrap} from '../../app/context';
import {ResourceDialog} from '../../app/components/ResourceDialog';
import {errorMessage} from '../../integration/errors';
import {GeneratorCustomOutputError, GeneratorCreationError} from '../../integration/generator-errors';
import {GeneratorEditor} from './GeneratorEditor';
import {GeneratorImport} from './GeneratorImport';
import {GeneratorCodePreview} from './GeneratorCodePreview';

const emptyFilters={name:'',comment:'',from:'',to:''};
const labels={id:'编号',name:'表名称',comment:'表描述',className:'实体类',category:'模板',webType:'前端类型',createdAt:'创建时间',updatedAt:'更新时间'};
const stateLabels:Record<string,string>={CREATED:'已创建',REPLACED:'已替换',FAILED:'失败',UNATTEMPTED:'未尝试',UNCONFIRMED:'结果未确认',IMPORTED:'已导入'};

function download(blob:Blob) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='生成代码.zip';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function GeneratorPage() {
  const api=useApi(),bootstrap=useBootstrap();
  const [draft,setDraft]=useState(emptyFilters),[filters,setFilters]=useState(emptyFilters);
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[version,setVersion]=useState(0);
  const [sort,setSort]=useState<'name'|'comment'|'createdAt'|'updatedAt'>('createdAt'),[direction,setDirection]=useState<'asc'|'desc'>('desc');
  const [data,setData]=useState<PageResponseTableSummary|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selection,setSelection]=useState<RowSelectionState>({}),[visibility,setVisibility]=useState<VisibilityState>({});
  const [busy,setBusy]=useState(false),[actionError,setActionError]=useState(''),[feedback,setFeedback]=useState('');
  const [editor,setEditor]=useState<TableDetail|null>(null),[importing,setImporting]=useState(false),[showFilters,setShowFilters]=useState(true);
  const [confirmation,setConfirmation]=useState<{kind:'delete'|'sync'|'custom';ids:string[];name:string}|null>(null);
  const [preview,setPreview]=useState<PreviewResponse|null>(null),[previewIndex,setPreviewIndex]=useState(0);
  const [creating,setCreating]=useState(false),[sql,setSql]=useState(''),[template,setTemplate]=useState('eforge-react');
  const [creation,setCreation]=useState<Creation|null>(null),[customResult,setCustomResult]=useState<CustomOutputResult|null>(null);
  const actionLock=useRef(false);
  const refresh=useCallback((message='')=>{setFeedback(message);setSelection({});setVersion(value=>value+1);},[]);
  const read=useRetainedRead();
  useEffect(()=>{
    const complete=read([api,filters,page,pageSize,sort,direction,version]);if(!complete)return;
    const controller=new AbortController();setLoading(true);setError('');setData(null);setSelection({});
    const bounds:{ $from?:string;to?:string }={$from:filters.from || undefined,to:filters.to || undefined};
    api.listGeneratorTables({name:filters.name,comment:filters.comment,...bounds,page,pageSize,sort,direction},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);complete();if(result.total&&page>Math.ceil(result.total/pageSize))setPage(Math.ceil(result.total/pageSize));}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);complete();}});
    return()=>controller.abort();
  },[api,filters,page,pageSize,sort,direction,version,read]);
  const action=useCallback(async(work:()=>Promise<void>)=>{if(actionLock.current)return;actionLock.current=true;setBusy(true);setActionError('');setFeedback('');try{await work();}catch(cause){setActionError(errorMessage(cause));}finally{actionLock.current=false;setBusy(false);}},[]);
  const edit=useCallback((id:string)=>{void action(async()=>setEditor(await api.getGeneratorTable(id)));},[api,action]);
  const view=useCallback((id:string)=>{void action(async()=>{setPreview(await api.previewGeneratorTable(id));setPreviewIndex(0);});},[api,action]);
  const exportRows=useCallback((ids:string[])=>{void action(async()=>download(await api.downloadGeneratorTables(ids)));},[api,action]);
  const columns=useMemo<ColumnDef<TableSummary>[]>(()=>[
    ...(['id','name','comment','className','category','webType','createdAt','updatedAt'] as const).map(key=>({accessorKey:key,header:labels[key],
      cell:({row}:{row:{original:TableSummary}})=>key==='createdAt'||key==='updatedAt' ? row.original[key]?new Date(row.original[key]!).toLocaleString('zh-CN'):'—':row.original[key] ?? '—'})),
    {id:'actions',header:'操作',cell:({row})=><div className="post-row-actions">
      <PermissionGate permission="tool:gen:preview"><Button label="预览" aria-label={'预览 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>view(row.original.id)}/></PermissionGate>
      <PermissionGate permission="tool:gen:edit"><Button label="编辑" aria-label={'编辑 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>edit(row.original.id)}/><Button label="同步" aria-label={'同步 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>{setActionError('');setConfirmation({kind:'sync',ids:[row.original.id],name:row.original.name ?? ''});}}/></PermissionGate>
      <PermissionGate permission="tool:gen:code"><Button label="生成代码" aria-label={'生成代码 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>{if(row.original.outputType==='1'){setActionError('');setCustomResult(null);setConfirmation({kind:'custom',ids:[row.original.id],name:row.original.name ?? ''});}else exportRows([row.original.id]);}}/><Button label="下载" aria-label={'下载 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>exportRows([row.original.id])}/><Button label="自定义输出" aria-label={'自定义输出 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>{setActionError('');setCustomResult(null);setConfirmation({kind:'custom',ids:[row.original.id],name:row.original.name ?? ''});}}/></PermissionGate>
      <PermissionGate permission="tool:gen:remove"><Button label="删除" aria-label={'删除 '+row.original.name} variant="ghost" isDisabled={busy} onClick={()=>{setActionError('');setConfirmation({kind:'delete',ids:[row.original.id],name:row.original.name ?? ''});}}/></PermissionGate>
    </div>}
  ],[busy,edit,view,exportRows]);
  const ids=Object.keys(selection).filter(id=>selection[id]);
  async function confirmed() {
    if(!confirmation)return;
    await action(async()=>{
      if(confirmation.kind==='delete'){await api.deleteGeneratorTables(confirmation.ids);setConfirmation(null);refresh('生成配置已删除，数据库表保持不变。');}
      else if(confirmation.kind==='sync'){await api.synchronizeGeneratorTable(confirmation.ids[0]!);setConfirmation(null);refresh('字段信息已同步，请检查配置。');}
      else try{setCustomResult(await api.writeGeneratorCustomOutput(confirmation.ids[0]!));setConfirmation(null);setFeedback('自定义输出已完成。');}
        catch(cause){if(cause instanceof GeneratorCustomOutputError)setCustomResult(cause.output);throw cause;}
    });
  }
  async function create() {
    if(!sql.trim()){setActionError('请输入建表 SQL。');return;}setCreation(null);
    await action(async()=>{try{setCreation(await api.createGeneratorTables({sql,template}));refresh('建表与配置导入已完成。');}
      catch(cause){if(cause instanceof GeneratorCreationError)setCreation(cause.creation);throw cause;}});
  }
  const creationResult=creation?<div aria-label="建表结果"><h3>建表结果</h3><ul>{creation.physical?.map((item,index)=><li key={index}>{item.name}：{stateLabels[item.state ?? ''] ?? '结果未确认'}</li>)}</ul><p>配置导入：{stateLabels[creation.importState ?? ''] ?? '结果未确认'}</p><ul>{creation.imported?.map((item,index)=><li key={index}>{item.actualName} · {item.id} · {item.columnCount} 个字段</li>)}</ul></div>:null;
  return <section className="posts-page generator-page">
    <PageHeader title="代码生成" description="管理生成配置、同步字段并预览生成文件。" eyebrow="系统工具"/>
    <form hidden={!showFilters} className="post-filters" onSubmit={event=>{event.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to){setActionError('开始日期不能晚于结束日期。');return;}setPage(1);setFilters({...draft});refresh();}}>
      <Input label="表名称筛选" value={draft.name} onChange={name=>setDraft({...draft,name})}/><Input label="表描述筛选" value={draft.comment} onChange={comment=>setDraft({...draft,comment})}/>
      <label>开始日期<input aria-label="开始日期" type="date" value={draft.from} onChange={event=>setDraft({...draft,from:event.target.value})}/></label>
      <label>结束日期<input aria-label="结束日期" type="date" value={draft.to} onChange={event=>setDraft({...draft,to:event.target.value})}/></label>
      <Button label="查询" type="submit"/><Button label="重置" variant="secondary" onClick={()=>{setDraft(emptyFilters);setFilters(emptyFilters);setPage(1);refresh();}}/>
    </form>
    <div className="post-toolbar">
      <PermissionGate permission="tool:gen:import"><Button label="导入表" isDisabled={busy} onClick={()=>{setActionError('');setImporting(true);}}/></PermissionGate>
      {bootstrap.roles.includes('admin')?<Button label="创建表" isDisabled={busy} onClick={()=>{setActionError('');setCreation(null);setCreating(true);}}/>:null}
      <PermissionGate permission="tool:gen:edit"><Button label="编辑所选" isDisabled={busy||ids.length!==1} onClick={()=>edit(ids[0]!)}/></PermissionGate>
      <PermissionGate permission="tool:gen:remove"><Button label="删除所选" isDisabled={busy||!ids.length} onClick={()=>{setActionError('');setConfirmation({kind:'delete',ids,name:ids.length+' 张表'});}}/></PermissionGate>
      <PermissionGate permission="tool:gen:code"><Button label="下载所选" isDisabled={busy||!ids.length} onClick={()=>exportRows(ids)}/></PermissionGate>
      <Button label="刷新列表" isDisabled={loading} onClick={()=>refresh()}/><Button label={showFilters?'隐藏筛选':'显示筛选'} onClick={()=>setShowFilters(value=>!value)}/>
      <label>排序字段<select aria-label="排序字段" value={sort} onChange={event=>{setSort(event.target.value as typeof sort);setPage(1);}}>{(['name','comment','createdAt','updatedAt'] as const).map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <Button label={direction==='asc'?'升序':'降序'} onClick={()=>{setDirection(value=>value==='asc'?'desc':'asc');setPage(1);}}/>
      <ColumnVisibilityMenu labels={labels} visibility={visibility} onChange={setVisibility} />
    </div>
    {feedback?<p role="status">{feedback}</p>:null}
    {error?<div role="alert">{error}<Button label="重试列表" onClick={()=>refresh()}/></div>:null}
    {actionError&&!editor&&!confirmation&&!creating&&!preview?<p role="alert">{actionError}</p>:null}
    <div className="post-table"><DataTable data={data?.items ?? []} columns={columns} loading={loading} emptyText="暂无生成配置" pagination={false} sortable={false} selectable showColumnVisibility={false} columnVisibility={visibility} rowSelection={selection} onRowSelectionChange={setSelection} getRowId={row=>row.id} getRowSelectionLabel={row=>'选择表 '+row.name}/></div>
    <Pagination page={page} pageSize={pageSize} total={data?.total} loading={loading} busy={false} onPage={setPage} onSize={setPageSize} />
    {editor?<GeneratorEditor detail={editor} onCancel={()=>setEditor(null)} onSaved={()=>{setEditor(null);refresh('配置已保存。');}}/>:null}
    {importing?<GeneratorImport onCancel={()=>setImporting(false)} onImported={()=>{setImporting(false);setPage(1);refresh('数据库表已导入。');}}/>:null}
    {confirmation?<ResourceDialog titleId="generator-confirm-title" alert busy={busy} onCancel={()=>{setConfirmation(null);setActionError('');}}>
      <h2 id="generator-confirm-title">{confirmation.kind==='delete'?'删除配置':confirmation.kind==='sync'?'同步字段':'自定义输出'}</h2><p>{confirmation.name}</p>
      <p>{confirmation.kind==='delete'?'仅删除生成配置，保留数据库表和业务行。':confirmation.kind==='sync'?'将按当前数据库结构同步字段，请在同步后检查生成配置。':'将写入已配置的服务器目录，已有目标文件可能被替换。'}</p>
      {customResult?<ul>{customResult.files?.map((file,index)=><li key={index}>{file.path}：{stateLabels[file.state ?? ''] ?? '结果未确认'}</li>)}</ul>:null}
      {actionError?<p role="alert">{actionError}</p>:null}<Button label={busy?'正在处理…':'确认操作'} isDisabled={busy} onClick={()=>{void confirmed();}}/><Button label="取消" isDisabled={busy} onClick={()=>{setConfirmation(null);setActionError('');}}/>
    </ResourceDialog>:null}
    {customResult&&!confirmation?<div aria-label="自定义输出结果"><ul>{customResult.files?.map((file,index)=><li key={index}>{file.path}：{stateLabels[file.state ?? ''] ?? '结果未确认'}</li>)}</ul></div>:null}
    {preview?<ResourceDialog titleId="generator-preview-title" busy={false} onCancel={()=>setPreview(null)}><h2 id="generator-preview-title">代码预览</h2><select aria-label="预览文件" value={previewIndex} onChange={event=>{setPreviewIndex(Number(event.target.value));setActionError('');}}>{preview.files?.map((file,index)=><option key={file.path} value={index}>{file.path}</option>)}</select>
      <GeneratorCodePreview source={preview.files?.[previewIndex]?.content ?? ''}/>{actionError?<p role="alert">{actionError}</p>:null}
      <Button label="复制代码" onClick={()=>{void navigator.clipboard.writeText(preview.files?.[previewIndex]?.content ?? '').then(()=>setFeedback('代码已复制。')).catch(()=>setActionError('复制未完成，可在代码区选择文本复制。'));}}/><Button label="关闭预览" onClick={()=>setPreview(null)}/>
    </ResourceDialog>:null}
    {creating?<ResourceDialog titleId="generator-create-title" busy={busy} onCancel={()=>setCreating(false)}><h2 id="generator-create-title">创建数据库表</h2><label>建表 SQL<textarea aria-label="建表 SQL" value={sql} disabled={busy} onChange={event=>{setSql(event.target.value);setCreation(null);setActionError('');}}/></label>
      <label>初始前端类型<select aria-label="初始前端类型" value={template} disabled={busy} onChange={event=>{setTemplate(event.target.value);setCreation(null);setActionError('');}}>{['eforge-react','element-ui','element-plus','element-plus-typescript'].map(value=><option key={value}>{value}</option>)}</select></label>
      {creationResult}{actionError?<p role="alert">{actionError}</p>:null}<Button label={busy?'正在建表…':'执行建表'} isDisabled={busy} onClick={()=>{void create();}}/><Button label="关闭" isDisabled={busy} onClick={()=>setCreating(false)}/>
    </ResourceDialog>:null}
  </section>;
}
