import {NativeButton} from '../../ui/native';
import {useEffect, useId, useMemo, useRef, useState, type CSSProperties} from 'react';
import {Button} from '../../ui/controls';

function imageScale(current:number,delta:number) {return delta<0 && current<=.2 ? current : Number((current+delta).toFixed(3));}

import {safeResourceUrls} from './resourceUrls';
export {safeResourceUrls as imagePreviewUrls} from './resourceUrls';

export function ImagePreview({src, label, width=80, height=80}: {
  src: string; label: string; width?:CSSProperties['width']; height?:CSSProperties['height'];
}) {
  const urls=useMemo(()=>safeResourceUrls(src,window.location.origin),[src]);
  const [open,setOpen]=useState(false),[failed,setFailed]=useState('');
  const first=urls[0];
  if (!first) return <span className="image-preview-empty">暂无图片</span>;
  return <><NativeButton type="button" className="image-preview-thumbnail" aria-label={`预览图片 ${label}`} style={{width,height}} onClick={()=>setOpen(true)}>
    {failed===first?<span>图片加载失败</span>:<img src={first} alt={label} referrerPolicy="no-referrer" onError={()=>setFailed(first)}/>}
  </NativeButton>{open?<ImageViewer key={src} urls={urls} label={label} onClose={()=>setOpen(false)}/>:null}</>;
}

function ImageViewer({urls,label,onClose}: {urls:string[];label:string;onClose:()=>void}) {
  const title=useId(),dialog=useRef<HTMLDialogElement>(null),stage=useRef<HTMLDivElement>(null);
  const [index,setIndex]=useState(0),[scale,setScale]=useState(1),[rotation,setRotation]=useState(0),[fit,setFit]=useState(true);
  const [pan,setPan]=useState({x:0,y:0}),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const moved=useRef(false),drag=useRef<{id:number;x:number;y:number;originX:number;originY:number}|null>(null);
  useEffect(()=>{
    const element=dialog.current,opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    element?.showModal();
    return()=>{element?.close();if(opener?.isConnected && opener.getClientRects().length && (!document.querySelector('dialog[open]') || opener.closest('dialog[open]')))opener.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    const element=stage.current;
    const wheel=(event:WheelEvent)=>{event.preventDefault();setScale(current=>imageScale(current,event.deltaY<0?.015:-.015));};
    element?.addEventListener('wheel',wheel,{passive:false});
    return()=>element?.removeEventListener('wheel',wheel);
  },[]);
  function reset(){setScale(1);setRotation(0);setPan({x:0,y:0});}
  function move(offset:number){setIndex(current=>(current+offset+urls.length)%urls.length);setFailed(false);setRetry(0);reset();}
  function zoom(delta:number){setScale(current=>imageScale(current,delta));}
  return <dialog ref={dialog} className="image-preview-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}}
    onKeyDown={event=>{
      if(event.target instanceof HTMLInputElement)return;
      if(event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();move(-1);}
      if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();move(1);}
      if(event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();zoom(.2);}
      if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();zoom(-.2);}
      if(event.key===' '){event.preventDefault();event.stopPropagation();setFit(value=>!value);reset();}
    }}>
    <header><h2 id={title}>{label} — 图片预览</h2><Button label="关闭图片预览" variant="secondary" onClick={onClose}/></header>
    <div ref={stage} className="image-preview-stage" aria-label="图片查看区域"
      onClick={event=>{if(event.target===event.currentTarget && !moved.current)onClose();moved.current=false;}}
      onPointerDown={event=>{moved.current=false;if(event.button!==0 || !(event.target instanceof HTMLImageElement))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,originX:pan.x,originY:pan.y};}}
      onPointerMove={event=>{const start=drag.current;if(start?.id===event.pointerId){if(Math.abs(event.clientX-start.x)+Math.abs(event.clientY-start.y)>3)moved.current=true;setPan({x:start.originX+event.clientX-start.x,y:start.originY+event.clientY-start.y});}}}
      onPointerUp={event=>{if(drag.current?.id!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={()=>{drag.current=null;moved.current=false;}}>
      {failed?<div role="alert">图片加载失败<Button label="重试图片" onClick={()=>{setFailed(false);setRetry(value=>value+1);}}/></div>:
        <img key={`${index}-${retry}`} src={urls[index]} alt={`${label} ${index+1}/${urls.length}`} referrerPolicy="no-referrer" draggable={false}
          className={fit?'image-preview-fit':'image-preview-original'} onError={()=>setFailed(true)}
          style={{transform:`translate(${pan.x}px,${pan.y}px) rotate(${rotation}deg) scale(${scale})`}}/>}
    </div>
    <footer><span aria-live="polite">第 {index+1} / {urls.length} 张</span>
      <Button label="上一张图片" variant="secondary" isDisabled={urls.length<2} onClick={()=>move(-1)}/><Button label="下一张图片" variant="secondary" isDisabled={urls.length<2} onClick={()=>move(1)}/>
      <Button label="缩小图片" variant="secondary" onClick={()=>zoom(-.2)}/><Button label="放大图片" variant="secondary" onClick={()=>zoom(.2)}/>
      <Button label="向左旋转图片" variant="secondary" onClick={()=>setRotation(value=>value-90)}/><Button label="向右旋转图片" variant="secondary" onClick={()=>setRotation(value=>value+90)}/>
      <Button label={fit?'图片原始大小':'图片适应窗口'} variant="secondary" onClick={()=>{setFit(value=>!value);reset();}}/><Button label="重置图片视图" variant="secondary" onClick={reset}/>
    </footer>
  </dialog>;
}



