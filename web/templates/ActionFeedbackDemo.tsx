import {useEffect,useRef,useState} from 'react';
import {AsyncContent,Button,ConfirmActionDialog} from '../ui';

export function ActionFeedbackDemo(){
  const [state,setState]=useState('ready'),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return <section className="showcase-block"><h2>异步内容与操作确认</h2>
    <div className="showcase-row">{['加载','空数据','失败','内容'].map((label,index)=><Button key={label} label={`演示${label}`} variant="secondary" onClick={()=>setState(['loading','empty','error','ready'][index]!)}/>)}</div>
    <AsyncContent loading={state==='loading'} empty={state==='empty'} error={state==='error'?'示例加载失败':null} onRetry={()=>setState('ready')}>
      <p>示例内容已就绪</p><Button label="打开操作确认" onClick={()=>{setError('');setBusy(false);setOpen(true);}}/>
    </AsyncContent>
    {open?<ConfirmActionDialog title="确认示例操作" busy={busy} error={error} onCancel={()=>setOpen(false)} onConfirm={()=>{setBusy(true);timer.current=setTimeout(()=>{setBusy(false);if(error){setOpen(false);}else{setError('示例操作失败，请重试');}},500);}}>
      <p>首次模拟失败，重试模拟成功；不会修改业务数据。</p>
    </ConfirmActionDialog>:null}
  </section>;
}
