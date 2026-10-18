import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider} from '../../ui/controls';
import {ChartCard} from '../../ui/ChartCard';
import {AnimatedNumber} from '../../ui/AnimatedNumber';
import {TagNavigation} from '../../ui/TagNavigation';
import {TagMenu} from '../../ui/TagMenu';
import '../../ui/theme.css';
const initial=Array.from({length:30},(_,i)=>({path:String(i),href:'#'+i,title:'页面'+i,affix:i===0}));
function Fixture(){
  const [items,setItems]=useState(initial),[active,setActive]=useState('0'),[expanded,setExpanded]=useState(false),[persist,setPersist]=useState(false);
  const strip=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null);
  return <main style={{padding:16,minWidth:0}}><TagNavigation items={items} activePath={active} stripRef={strip} scroll={{left:true,right:true}} expanded={expanded} persist={persist} canRefresh={true} onNavigate={tag=>setActive(tag.path)} onClose={tag=>setItems(items.filter(item=>item.path!==tag.path))} onContextMenu={()=>setExpanded(true)} onActions={()=>setExpanded(!expanded)} onRefresh={()=>{}} onPersist={setPersist}/>
    {expanded?<TagMenu menuRef={menu} point={{x:16,y:64}} onDismiss={()=>setExpanded(false)} actions={[{id:'close',label:'关闭菜单',onSelect:()=>setExpanded(false)}]}/>:null}
    <AnimatedNumber total={12345} duration={0}/>
    <ChartCard spec={{title:'数量',label:'数量趋势',legend:['数量'],headers:['月份','数量'],rows:[['一月',10],['二月',20]],option:{animation:false,xAxis:{type:'category',data:['一月','二月']},yAxis:{type:'value'},series:[{name:'数量',type:'line',data:[10,20]}]}}}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<EForgeProvider><Fixture/></EForgeProvider>);
