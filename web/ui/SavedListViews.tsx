import {useEffect,useId,useState} from 'react';
import {Button} from './controls';
import {NativeInput,Select} from './native';
import './list-feedback.css';

export type ListViewState={filters:Record<string,string>;columns:Record<string,boolean>};
type SavedView={id:string;name:string;state:ListViewState};
type Props={userId:string;routeId:string;version:number;state:ListViewState;normalize:(value:unknown)=>ListViewState|null;onApply:(value:ListViewState)=>void;disabled?:boolean};

/** Explicit, local preferences only. The page's normalizer is a schema whitelist. */
export function SavedListViews({userId,routeId,version,state,normalize,onApply,disabled=false}:Props){
  const key=`eforge:list-views:${JSON.stringify([userId,routeId,version])}`,id=useId();
  const [stored,setStored]=useState<{key:string;items:SavedView[]}>({key:'',items:[]}),[name,setName]=useState(''),[selected,setSelected]=useState(''),[error,setError]=useState('');
  const items=stored.key===key?stored.items:[];
  useEffect(()=>{
    function read(){
      try{
        const raw=localStorage.getItem(key);if(raw&&raw.length>40000)throw Error('oversized');
        const parsed:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(parsed)||parsed.length>10)throw Error('invalid');
        const items:SavedView[]=[];
        for(const entry of parsed){
          if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||entry.id.length>64||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>40)throw Error('invalid');
          const state=normalize(entry.state);if(!state||items.some(item=>item.id===entry.id))throw Error('invalid');items.push({id:entry.id,name:entry.name,state});
        }
        setStored({key,items});setError('');
      }catch{setStored({key,items:[]});setError('无法读取本页保存视图，当前筛选保持不变。');}
    }
    setSelected('');setName('');read();
    const changed=(event:StorageEvent)=>{if(event.key===key||event.key===null)read();};
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[key,normalize]);
  function persist(next:SavedView[]){
    try{localStorage.setItem(key,JSON.stringify(next));setStored({key,items:next});setError('');return true;}
    catch{setError('无法保存视图，请检查浏览器存储空间或权限。');return false;}
  }
  function save(){
    if(disabled||stored.key!==key)return;const label=name.trim(),snapshot=normalize(state);
    if(!label||label.length>40){setError('请填写不超过40字的视图名称。');return;}
    if(items.some(item=>item.name===label)){setError('该名称已存在，请使用其他名称或删除原视图。');return;}
    if(items.length>=10){setError('每个页面最多保存10个视图。');return;}
    if(!snapshot){setError('当前筛选无法保存。');return;}
    const entry={id:crypto.randomUUID(),name:label,state:snapshot};if(persist([...items,entry])){setSelected(entry.id);setName('');}
  }
  const chosen=items.find(item=>item.id===selected);
  return <details className="ui-saved-views"><summary>保存视图</summary><div className="ui-saved-view-controls">
    <label htmlFor={`${id}-name`}>视图名称</label><NativeInput type="text" id={`${id}-name`} value={stored.key===key?name:''} maxLength={40} disabled={disabled||stored.key!==key} onChange={event=>setName(event.target.value)}/>
    <Button label="保存当前视图" variant="secondary" isDisabled={disabled||stored.key!==key} onClick={save}/>
    <label htmlFor={`${id}-choice`}>已保存视图</label><Select id={`${id}-choice`} value={chosen?.id??''} disabled={disabled} onChange={event=>setSelected(event.target.value)}><option value="">请选择</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <Button label="应用视图" variant="secondary" isDisabled={disabled||!chosen} onClick={()=>{if(chosen){onApply(chosen.state);setError('');}}}/>
    <Button label="删除视图" variant="ghost" isDisabled={disabled||!chosen} onClick={()=>{if(chosen&&persist(items.filter(item=>item.id!==chosen.id)))setSelected('');}}/>
  </div><p className="ui-field-hint">仅保存在此浏览器的当前账号与页面；包含已生效条件和列配置，不含数据行、选择或页码。</p>{stored.key===key&&error&&<p role="alert">{error}</p>}</details>;
}
