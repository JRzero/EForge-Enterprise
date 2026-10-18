import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Button} from './controls';
import {NativeInput} from './native';
import {UploadEntries} from './UploadEntries';
import './file-field.css';

type Progress={loaded:number;total:number};
type Entry={key:string;file:File;state:'queued'|'uploading'|'done'|'failed'|'cancelled'|'invalid';message?:string;progress?:Progress};
export type FileFieldProps={
  id?:string;label:string;value:readonly string[];onChange:(value:string[])=>void;accept?:string;maxFiles:number;
  disabled?:boolean;readOnly?:boolean;required?:boolean;hint?:string;fieldError?:string;limitMessage?:string;
  upload:(file:File,signal:AbortSignal,progress:(value:Progress)=>void)=>Promise<string>;
  validate:(file:File)=>string|undefined;errorMessage?:(cause:unknown)=>string;
  onBusyChange?:(busy:boolean)=>void;renderFile:(path:string,index:number)=>ReactNode;
};

/** Owns a bounded local queue. Authentication, validation policy and remote deletion belong to callers. */
export function FileField(props:FileFieldProps){
  const generatedId=useId(),id=props.id??generatedId,root=useRef<HTMLDivElement>(null);
  const latest=useRef(props),active=useRef<{controller:AbortController;finish:()=>void}|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useLayoutEffect(()=>{latest.current=props;});
  useEffect(()=>{
    const node=root.current;
    return()=>{queueMicrotask(()=>{if(node&&!node.isConnected){active.current?.controller.abort();active.current?.finish();}});};
  },[]);
  function patch(key:string,patch:Partial<Entry>){setEntries(previous=>previous.map(entry=>entry.key===key?{...entry,...patch}:entry));}
  function cancel(){
    const request=active.current;if(!request)return;request.controller.abort();
    setEntries(previous=>previous.map(entry=>['queued','uploading'].includes(entry.state)?{...entry,state:'cancelled',progress:undefined}:entry));
    request.finish();
  }
  async function run(queue:Entry[]){
    if(active.current||latest.current.disabled||latest.current.readOnly)return;
    const owner=root.current,controller=new AbortController(),busyChanged=latest.current.onBusyChange;
    let finished=false;const request={controller,finish:()=>{if(finished)return;finished=true;if(active.current===request)active.current=null;setBusy(false);busyChanged?.(false);}};
    active.current=request;setBusy(true);busyChanged?.(true);setError('');
    let paths=[...latest.current.value];
    try{
      for(const entry of queue){
        if(controller.signal.aborted||!owner?.isConnected)break;
        if(latest.current.disabled||latest.current.readOnly){cancel();break;}
        const issue=latest.current.validate(entry.file);
        if(issue){patch(entry.key,{state:'invalid',message:issue});continue;}
        if(paths.length>=latest.current.maxFiles){patch(entry.key,{state:'failed',message:latest.current.limitMessage??`最多上传${latest.current.maxFiles}个文件。`});continue;}
        patch(entry.key,{state:'uploading',message:undefined,progress:undefined});
        try{
          const path=await latest.current.upload(entry.file,controller.signal,progress=>{
            if(!controller.signal.aborted&&Number.isFinite(progress.loaded)&&Number.isFinite(progress.total)&&progress.total>0&&progress.loaded>=0&&progress.loaded<=progress.total)patch(entry.key,{progress});
          });
          if(controller.signal.aborted||!owner.isConnected)break;
          if(latest.current.disabled||latest.current.readOnly){cancel();break;}
          if(!path)throw Error('Empty upload result');
          paths=[...paths,path];latest.current.onChange(paths);patch(entry.key,{state:'done',progress:undefined});
        }catch(cause){if(!controller.signal.aborted)patch(entry.key,{state:'failed',message:latest.current.errorMessage?.(cause)??'上传失败，请重试。',progress:undefined});}
      }
    }finally{request.finish();}
  }
  function choose(files:File[]){
    if(!files.length||active.current||props.disabled||props.readOnly)return;
    if(files.length+props.value.length>props.maxFiles){setError(props.limitMessage??`最多上传${props.maxFiles}个文件。`);return;}
    const queue:Entry[]=files.map(file=>({key:crypto.randomUUID(),file,state:'queued'}));setEntries(queue);void run(queue);
  }
  const locked=props.disabled||props.readOnly,description=[props.hint?`${id}-hint`:'',props.fieldError?`${id}-error`:'',error?`${id}-upload-error`:''].filter(Boolean).join(' ')||undefined;
  return <div className="ui-file-field" ref={root} tabIndex={-1}>
    <NativeInput id={id} aria-label={props.label} aria-required={props.required||undefined} aria-invalid={props.fieldError?true:undefined} aria-describedby={description} type="file" multiple accept={props.accept} disabled={locked||busy} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';choose(files);}}/>
    {props.hint&&<p id={`${id}-hint`} className="ui-field-hint">{props.hint}</p>}
    {error&&<p role="alert" id={`${id}-upload-error`}>{error}</p>}
    {!!entries.length&&<div className="ui-file-queue"><p role="status">{busy?'正在上传… ':''}已完成 {entries.filter(entry=>entry.state==='done').length} / {entries.length}</p>
      <ul>{entries.map(entry=><li key={entry.key}><span>{entry.file.name}</span><span>{({queued:'等待上传',uploading:'等待服务器确认',done:'上传成功',failed:'上传失败',cancelled:'已取消',invalid:'文件不符合要求'})[entry.state]}</span>
        {entry.state==='uploading'&&<progress aria-label={`${entry.file.name} 上传进度`} value={entry.progress?.loaded} max={entry.progress?.total}/>}
        {entry.message&&<span role="alert">{entry.file.name}：{entry.message}</span>}
        {['failed','cancelled'].includes(entry.state)&&<Button label={`重试 ${entry.file.name}`} variant="secondary" isDisabled={locked||busy} onClick={()=>{patch(entry.key,{state:'queued',message:undefined});void run([entry]);}}/>}
      </li>)}</ul>{busy&&<Button label="取消上传" variant="secondary" onClick={()=>{cancel();root.current?.focus();}}/>}</div>}
    <UploadEntries paths={props.value} disabled={!!locked||busy} onChange={props.onChange}>{(path,index)=><>{props.renderFile(path,index)}<Button label="移除文件" variant="ghost" isDisabled={!!locked||busy} onClick={()=>props.onChange(props.value.filter((_,ordinal)=>ordinal!==index))}/></>}</UploadEntries>
  </div>;
}
