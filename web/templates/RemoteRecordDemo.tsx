import {useCallback,useState} from 'react';
import {RemoteRecordSelect,type RemoteRecordOption,type RemoteRecordSelectProps} from '../ui/RemoteRecordSelect';

export function RemoteRecordDemo(){
  const [value,setValue]=useState<RemoteRecordOption|null>({value:'9007199254740993',label:'历史负责人（保留值）'});
  const load=useCallback<RemoteRecordSelectProps['load']>(async({query,page,pageSize,signal})=>{
    await new Promise<void>((resolve,reject)=>{
      const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},150);
      if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    });
    const records=Array.from({length:26},(_,index)=>({value:(9007199254741000n+BigInt(index)).toString(),label:`示例负责人 ${index+1}`})).filter(item=>item.label.includes(query));
    return {total:records.length,items:records.slice((page-1)*pageSize,page*pageSize)};
  },[]);
  return <RemoteRecordSelect label="远程负责人" value={value} onChange={setValue} load={load} hint="演示分页与异步搜索，使用本地模拟记录，不读取真实账号。"/>;
}
