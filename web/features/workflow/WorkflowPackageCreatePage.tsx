import {useEffect,useState} from 'react';
import {useApi,useApplicationControls} from '../../app/context';
import {useRetainedRead} from '../../app/useRetainedRead';
import {Button} from '../../ui/controls';
import {errorMessage} from '../../integration/errors';
import {WorkflowPackageEditor} from './WorkflowPackageEditor';
import {refreshWorkflowPackages} from './workflow-package-refresh';
import './workflow.css';

export function WorkflowPackageCreatePage(){
  const api=useApi(),{closePage,navigate}=useApplicationControls(),read=useRetainedRead();
  const [enabled,setEnabled]=useState<boolean|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const complete=read([api,retry]);if(!complete)return;
    const controller=new AbortController();setError('');setEnabled(null);
    api.getWorkflowStatus(controller.signal).then(status=>{if(!controller.signal.aborted){setEnabled(status.enabled===true);complete();}})
      .catch(cause=>{if(!controller.signal.aborted)setError(errorMessage(cause));});
    return()=>controller.abort();
  },[api,retry,read]);
  const close=()=>{if(closePage)closePage('/workflow/packages');else navigate('/workflow/packages');};
  if(error)return <section role="alert"><p>{error}</p><Button label="重试" onClick={()=>setRetry(value=>value+1)}/></section>;
  if(enabled===null)return <p role="status">正在准备流程设计器…</p>;
  if(!enabled)return <p role="status">工作流尚未启用，请联系管理员。</p>;
  return <WorkflowPackageEditor asPage draft={null} onClose={close} onSaved={()=>{refreshWorkflowPackages();close();}}/>;
}
