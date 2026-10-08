import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {readLayoutPreferences,saveLayoutDensity,useLayout,useLayoutChanges,type LayoutPreferences} from './layout-preferences';
import {UiIcon} from './UiIcon';
function subscribeFullscreen(listener:()=>void){document.addEventListener('fullscreenchange',listener);return()=>document.removeEventListener('fullscreenchange',listener);}
function fullscreenSnapshot(){return !!document.fullscreenElement;}
export function HeaderUtilities(){
  const layout=useLayout(),change=useLayoutChanges();const fullscreen=useSyncExternalStore(subscribeFullscreen,fullscreenSnapshot,()=>false);
  const [message,setMessage]=useState('');const alive=useRef(true),owned=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(owned.current && document.fullscreenElement===document.documentElement)void document.exitFullscreen().catch(()=>undefined);};},[]);
  async function toggleFullscreen(){try {setMessage('');if(document.fullscreenElement){await document.exitFullscreen();owned.current=false;}else {owned.current=true;await document.documentElement.requestFullscreen();if(!alive.current && document.fullscreenElement===document.documentElement)await document.exitFullscreen();}}catch {owned.current=false;if(alive.current)setMessage('当前浏览器无法切换全屏');}}
  return <div className="header-utilities"><button type="button" className="header-icon-button" title={fullscreen?'退出全屏':'全屏'} aria-label={fullscreen?'退出屏幕全屏':'进入屏幕全屏'} disabled={!document.fullscreenEnabled} onClick={()=>void toggleFullscreen()}><UiIcon name="fullscreen" /></button>
    <select aria-label="界面尺寸" value={layout.density} onChange={event=>{const density=event.target.value as LayoutPreferences['density'];change?.(current=>({...current,density}));try{saveLayoutDensity({...readLayoutPreferences(),density});setMessage('');}catch{setMessage('界面尺寸已应用，无法保存到浏览器');}}}><option value="default">默认尺寸</option><option value="medium">中等</option><option value="small">小型</option><option value="mini">迷你</option></select>
    <a className="header-icon-button" title="源码仓库" href="https://github.com/JRzero/EForge-Enterprise" target="_blank" rel="noopener noreferrer" aria-label="源码仓库 在新窗口打开"><UiIcon name="code" /></a>
    <a className="header-icon-button" title="参考文档" href="https://doc.ruoyi.vip/" target="_blank" rel="noopener noreferrer" aria-label="若依参考文档 在新窗口打开"><UiIcon name="help" /></a>
    {message?<span role="status">{message}</span>:null}</div>;
}
