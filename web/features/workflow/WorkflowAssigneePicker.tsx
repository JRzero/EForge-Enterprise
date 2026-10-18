import {useCallback,useState} from 'react';
import {useApi} from '../../app/context';
import {RemoteRecordSelect,type RemoteRecordOption,type RemoteRecordSelectProps} from '../../ui/RemoteRecordSelect';

/** Uses the existing authoritative user-list permission and scope. Does not grant workflow access. */
export function WorkflowAssigneePicker({value,onChange}:{value:string;onChange:(id:string)=>void}){
  const api=useApi(),[selected,setSelected]=useState<RemoteRecordOption|null>(null);
  const load=useCallback<RemoteRecordSelectProps['load']>(async({query,page,pageSize,signal})=>{
    const result=await api.listUsers({username:query||undefined,page,pageSize,status:'0'},signal);
    return {total:result.total,items:result.items.map(user=>({value:user.id,label:`${user.displayName}（${user.username}）`,disabled:user.status!=='0'}))};
  },[api]);
  return <RemoteRecordSelect label="查找审批账号" value={/^[1-9][0-9]*$/.test(value)?selected?.value===value?selected:{value,label:`账号 ${value}`} :null}
    load={load} hint="按登录账号搜索；选择仅更新草稿，点击应用属性后生效。" onChange={option=>{setSelected(option);onChange(option?.value??'');}}/>;
}
