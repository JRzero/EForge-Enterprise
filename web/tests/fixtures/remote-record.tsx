import {useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider,RemoteRecordSelect,type RemoteRecordOption,type RemoteRecordSelectProps} from '../../ui';
import '../../ui/theme.css';
function Fixture(){
  const [value,setValue]=useState<RemoteRecordOption|null>({value:'9007199254740993',label:'旧审批人'}),[readOnly,setReadOnly]=useState(false),[disabled,setDisabled]=useState(false);
  const [mounted,setMounted]=useState(true);
  useEffect(()=>{
    const change=(event:Event)=>{const mode=(event as CustomEvent<string>).detail;if(mode==='readonly')setReadOnly(true);if(mode==='disabled')setDisabled(true);if(mode==='unmount')setMounted(false);};
    window.addEventListener('record-state',change);return()=>window.removeEventListener('record-state',change);
  },[]);
  const load=useCallback<RemoteRecordSelectProps['load']>(async({query,page,pageSize,signal})=>{
    const response=await fetch(`/fixture-records?${new URLSearchParams({query,page:String(page),pageSize:String(pageSize)})}`,{signal:new URLSearchParams(location.search).has('ignoreAbort')?undefined:signal});
    if(!response.ok)throw Error('private SQL');return response.json();
  },[]);
  return <EForgeProvider><main style={{padding:20,maxWidth:420}}>{mounted&&<RemoteRecordSelect label="审批人" value={value} onChange={setValue} load={load} readOnly={readOnly} disabled={disabled} required hint="保留旧值"/>}
    <output aria-label="已选编号">{value?.value??''}</output><label>其他输入<input/></label>
    <button onClick={()=>setReadOnly(!readOnly)}>切换只读</button><button onClick={()=>setDisabled(!disabled)}>切换禁用</button>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
