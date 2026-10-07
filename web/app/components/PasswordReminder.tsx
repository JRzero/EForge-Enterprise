import {useId,useState} from 'react';
import type {BootstrapResponse} from '../../generated/api';
import {useApplicationControls} from '../context';
import {ResourceDialog} from './ResourceDialog';
export function PasswordReminder({status}: {status: BootstrapResponse['passwordStatus']}) {
  const title=useId(),controls=useApplicationControls();const [dismissed,setDismissed]=useState(false);
  if(dismissed || (!status?.initialChangeRecommended && !status?.expired))return null;
  return <ResourceDialog titleId={title} alert busy={false} onCancel={()=>setDismissed(true)}>
    <h2 id={title}>安全提示</h2><p>{status.initialChangeRecommended ? '您的密码还是初始密码，请修改密码！' : '您的密码已过期，请尽快修改密码！'}</p>
    <div className="state-actions"><button type="button" onClick={()=>{setDismissed(true);controls.navigate('/user/profile?password=1');}}>确定</button><button type="button" onClick={()=>setDismissed(true)}>取消</button></div>
  </ResourceDialog>;
}