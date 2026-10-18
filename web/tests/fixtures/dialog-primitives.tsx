import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider,Button} from '../../ui/controls';
import {ResourceDialog} from '../../ui/ResourceDialog';
import '../../ui/theme.css';
function Fixture(){
  const [open,setOpen]=useState(false);
  return <><Button label="打开编辑" onClick={()=>setOpen(true)}/>{open?<ResourceDialog titleId="standalone-title" busy={false} onCancel={()=>setOpen(false)}>
    <h2 id="standalone-title">独立编辑弹窗</h2>
    <form onSubmit={event=>event.preventDefault()}><label>说明<textarea defaultValue="保留草稿"/></label><div className="post-dialog-actions"><Button label="取消" onClick={()=>setOpen(false)}/></div></form>
  </ResourceDialog>:null}</>;
}
createRoot(document.getElementById('root')!).render(<EForgeProvider><Fixture/></EForgeProvider>);
