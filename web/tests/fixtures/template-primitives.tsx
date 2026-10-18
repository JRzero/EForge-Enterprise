import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider,Input,Button} from '../../ui/controls';
import {AccountLayout} from '../../ui/AccountLayout';
import {SelectionTree} from '../../ui/SelectionTree';
import {IconPicker} from '../../ui/IconPicker';
import {DictionaryTag} from '../../ui/DictionaryTag';
import {Pagination} from '../../ui/Pagination';
import '../../ui/theme.css';
function Fixture(){
  const [selected,setSelected]=useState<string[]>([]),[linked,setLinked]=useState(true),[icon,setIcon]=useState('user');
  const [page,setPage]=useState(1),[size,setSize]=useState(10),[name,setName]=useState('');
  if(location.hash==='#account')return <AccountLayout><h2>登录工作空间</h2><form onSubmit={event=>event.preventDefault()}><Input label="账号" value={name} onChange={setName}/><Button label="登录" type="submit"/></form></AccountLayout>;
  return <main style={{padding:16}}><SelectionTree label="菜单权限" kind="菜单" nodes={[{key:'root',label:'系统'},{key:'child',parentKey:'root',label:'用户'}]} selected={selected} linked={linked} disabled={false} onChange={setSelected} onLinkedChange={(value,keys)=>{setLinked(value);setSelected(keys);}}/>
    <IconPicker value={icon} disabled={false} onChange={setIcon}/><DictionaryTag options={[]} value="保留未知值"/>
    <Pagination page={page} pageSize={size} total={500} loading={false} onPage={setPage} onSize={setSize} autoScroll={false}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<EForgeProvider><Fixture/></EForgeProvider>);
