import {useEffect,useRef,type RefObject} from 'react';

type Kind='move'|'width'|'size';
type Box={x:number;y:number;width:number;height:number};

/** Owned native pointer listeners; geometry never mutates an editor's data. */
export function useDialogGeometry(element:RefObject<HTMLDialogElement|null>,titleId:string,enabled:boolean,busy:boolean){
  const originalStyle=useRef<string|null|undefined>(undefined);
  useEffect(()=>{
    const dialog=element.current;if(!dialog || !enabled)return;
    if(originalStyle.current===undefined)originalStyle.current=dialog.getAttribute('style');
    const title=document.getElementById(titleId);
    let drag:{kind:Kind;pointer:number;x:number;y:number;box:Box}|null=null;
    function read():Box {const {x,y,width,height}=dialog!.getBoundingClientRect();return{x,y,width,height};}
    function apply(box:Box){
      const width=Math.max(Math.min(320,innerWidth-32),Math.min(box.width,innerWidth-32));
      const height=Math.max(Math.min(200,innerHeight-32),Math.min(box.height,innerHeight-32));
      const x=Math.max(16,Math.min(box.x,innerWidth-width-16)),y=Math.max(16,Math.min(box.y,innerHeight-height-16));
      Object.assign(dialog!.style,{position:'fixed',inset:'auto',margin:'0',left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${height}px`,maxWidth:`${Math.max(0,innerWidth-32)}px`,maxHeight:`${Math.max(0,innerHeight-32)}px`,boxSizing:'border-box'});
      dialog!.dataset.positioned='true';
    }
    function end(){const previous=drag;drag=null;if(previous && dialog!.hasPointerCapture(previous.pointer))dialog!.releasePointerCapture(previous.pointer);}
    function pointerDown(event:PointerEvent){
      if(busy || event.button!==0 || !event.isPrimary)return;
      const target=event.target instanceof Element?event.target:null;
      const control=target?.closest<HTMLButtonElement>('button[data-dialog-geometry]');
      const kind=control?.dataset.dialogGeometry as Kind|undefined;
      if(!kind && (!title?.contains(target) || target?.closest('a,button,input,select,textarea')))return;
      event.preventDefault();control?.focus();end();
      drag={kind:kind??'move',pointer:event.pointerId,x:event.clientX,y:event.clientY,box:read()};
      dialog!.setPointerCapture(event.pointerId);
    }
    function pointerMove(event:PointerEvent){
      if(!drag || drag.pointer!==event.pointerId)return;event.preventDefault();
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y,box=drag.box;
      apply(drag.kind==='move'?{...box,x:box.x+dx,y:box.y+dy}:{...box,width:box.width+dx,height:box.height+(drag.kind==='size'?dy:0)});
    }
    function keyDown(event:KeyboardEvent){
      if(busy || !(event.target instanceof HTMLButtonElement))return;
      const kind=event.target.dataset.dialogGeometry as Kind|undefined;if(!kind)return;
      if(event.key==='Home'){event.preventDefault();end();if(originalStyle.current===null)dialog!.removeAttribute('style');else dialog!.setAttribute('style',originalStyle.current??'');delete dialog!.dataset.positioned;return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();const step=event.shiftKey?50:10,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,box=read();
      apply(kind==='move'?{...box,x:box.x+dx,y:box.y+dy}:{...box,width:box.width+dx,height:box.height+(kind==='size'?dy:0)});
    }
    function fit(){end();if(dialog!.dataset.positioned)apply(read());}
    title?.classList.add('dialog-move-title');
    dialog.addEventListener('pointerdown',pointerDown);dialog.addEventListener('pointermove',pointerMove);dialog.addEventListener('pointerup',end);dialog.addEventListener('pointercancel',end);dialog.addEventListener('lostpointercapture',end);dialog.addEventListener('keydown',keyDown);
    window.addEventListener('resize',fit);window.addEventListener('blur',end);fit();
    return()=>{end();title?.classList.remove('dialog-move-title');dialog.removeEventListener('pointerdown',pointerDown);dialog.removeEventListener('pointermove',pointerMove);dialog.removeEventListener('pointerup',end);dialog.removeEventListener('pointercancel',end);dialog.removeEventListener('lostpointercapture',end);dialog.removeEventListener('keydown',keyDown);window.removeEventListener('resize',fit);window.removeEventListener('blur',end);};
  },[element,titleId,enabled,busy]);
}
