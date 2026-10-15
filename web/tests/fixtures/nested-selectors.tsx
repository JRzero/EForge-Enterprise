import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider, Button, MultiSelect, ResourceDialog} from '../../ui';
import '../../ui/theme.css';

function NestedSelectors(){
  const [open,setOpen]=useState(false),[people,setPeople]=useState<string[]>([]);
  return <EForgeProvider><main>
    <Button label="打开人员设置" onClick={()=>setOpen(true)}/>
    <p>已选人员：{people.join('、')||'无'}</p>
    {open&&<ResourceDialog titleId="people-title" busy={false} onCancel={()=>setOpen(false)}>
      <h2 id="people-title">人员设置</h2>
      <MultiSelect label="参与人员" value={people} onChange={setPeople} options={[{value:'9007199254740993',label:'林小禾'},{value:'2',label:'陈晓'}]}/>
      <Button label="关闭人员设置" onClick={()=>setOpen(false)}/>
    </ResourceDialog>}
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<NestedSelectors/>);
