import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider,EditableDetailTable,NativeInput} from '../../ui';
import '../../ui/theme.css';

function Fixture(){
  const [rows,setRows]=useState([{id:'A',value:'甲'},{id:'B',value:'乙'},{id:'C',value:'丙'}]);
  const pending=useRef<{resolve:()=>void;reject:()=>void}[]>([]),sequence=useRef(0);
  const wait=()=>new Promise<void>((resolve,reject)=>{pending.current.push({resolve,reject:()=>reject(new Error('fixture failure'))});});
  useEffect(()=>{
    const settle=()=>{pending.current.shift()?.resolve();};
    const reject=()=>{pending.current.shift()?.reject();};
    const reverse=()=>setRows(current=>[...current].reverse());
    window.addEventListener('detail-resolve',settle);window.addEventListener('detail-reject',reject);window.addEventListener('detail-reverse',reverse);
    return()=>{window.removeEventListener('detail-resolve',settle);window.removeEventListener('detail-reject',reject);window.removeEventListener('detail-reverse',reverse);};
  },[]);
  return <EForgeProvider><main style={{padding:20}}><label>其他输入<NativeInput aria-label="其他输入"/></label>
    <EditableDetailTable title="异步明细" rows={rows} getRowKey={row=>row.id}
      onAdd={async()=>{const serial=sequence.current++,id=serial?`新:行/中文-${serial}`:'新:行/中文';await wait();setRows(current=>[{id,value:'新'},...current]);return id;}}
      onRemove={async row=>{await wait();setRows(current=>current.filter(item=>item.id!==row.id));}}
      columns={[{key:'value',label:'内容',render:(row,_index,state)=><NativeInput id={state.field.id} aria-label={`内容 ${row.id}`} value={row.value} onChange={event=>setRows(current=>current.map(item=>item.id===row.id?{...item,value:event.target.value}:item))}/>}]}/>
  </main></EForgeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
