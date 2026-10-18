import {Activity,useRef,useState} from 'react';
import {Button,FileField} from '../ui';
export function FileFieldDemo(){
  const [paths,setPaths]=useState(['原有文件.txt']),[busy,setBusy]=useState(false),[visible,setVisible]=useState(true),[readonly,setReadonly]=useState(false);
  const failed=useRef(new Set<string>());
  return <section aria-label="文件队列示例"><h2>文件上传字段</h2><p>本地模拟，不上传文件；文件名含 fail 时首次失败，用于体验重试。进度为本地演示事件。</p>
    <Button label={visible?'隐藏文件示例':'显示文件示例'} onClick={()=>setVisible(value=>!value)}/><Button label={readonly?'恢复文件编辑':'文件只读'} onClick={()=>setReadonly(value=>!value)}/>
    <Activity mode={visible?'visible':'hidden'}><FileField label="演示附件" value={paths} onChange={setPaths} maxFiles={5} accept=".txt" readOnly={readonly}
      hint="最多五个TXT文件，每个小于1MB；原有文件在失败或取消后保留。" validate={file=>!file.name.endsWith('.txt')?'请选择TXT文件。':file.size>=1024*1024?'文件必须小于1MB。':undefined}
      onBusyChange={setBusy} renderFile={path=><span>{path}</span>} upload={(file,signal,progress)=>new Promise((resolve,reject)=>{
        let step=0;const timer=setInterval(()=>{if(signal.aborted)return;step++;progress({loaded:step,total:5});if(step===5){clearInterval(timer);signal.removeEventListener('abort',abort);if(file.name.includes('fail')&&!failed.current.has(file.name)){failed.current.add(file.name);reject(Error('Demo failure'));}else resolve(file.name);}},150);
        function abort(){clearInterval(timer);reject(new DOMException('Aborted','AbortError'));}signal.addEventListener('abort',abort,{once:true});
      })}/></Activity><p role="status">{busy?'文件处理中':'文件空闲'}</p><output aria-label="演示文件列表">{JSON.stringify(paths)}</output>
  </section>;
}
