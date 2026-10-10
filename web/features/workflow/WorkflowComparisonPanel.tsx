import {useEffect,useState} from 'react';
import type {WorkflowComparisonResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {Button} from '../../ui/controls';
import {errorMessage} from '../../integration/errors';

const fieldNames:Record<string,string>={name:'流程名称',businessType:'业务绑定',bpmnXml:'流程文件',scenarios:'验证场景'};
export function WorkflowComparisonPanel({packageId,baselineId,targetId}:{packageId:string;baselineId:string;targetId?:string}){
  const api=useApi(),[version,setVersion]=useState(0),[data,setData]=useState<WorkflowComparisonResponse|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setData(null);setError('');
    api.compareWorkflowPackage(packageId,baselineId,targetId?{targetReleaseId:targetId}:{},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false);}})
      .catch(cause=>{if(!controller.signal.aborted){setError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[api,packageId,baselineId,targetId,version]);
  return <section className="workflow-comparison" aria-label="版本内容对比" aria-busy={loading}>
    <h3>版本内容对比</h3><p>按保存内容对照；内容相同不代表场景验证可以省略。</p>
    <Button label="重新读取对比" variant="secondary" isDisabled={loading} onClick={()=>setVersion(value=>value+1)}/>
    {loading?<p role="status">正在读取对比…</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {data?<>
      <p>基准：发布版本 {data.baseline?.revision}；目标：{data.target?.kind==='DRAFT'?'草稿':'发布版本'} {data.target?.revision}</p>
      <p role="status">{data.fields?.some(field=>field.changed)?'存在内容变更':'两侧内容一致'}</p>
      {data.fields?.map(field=><details key={field.name} open={field.changed}>
        <summary>{fieldNames[field.name??'']??field.name} · {field.changed?'已变更':'未变更'}</summary>
        <div className="workflow-comparison-columns"><div><h4>基准内容</h4><pre className="workflow-source">{field.before}</pre></div><div><h4>目标内容</h4><pre className="workflow-source">{field.after}</pre></div></div>
      </details>)}
    </>:null}
  </section>;
}
