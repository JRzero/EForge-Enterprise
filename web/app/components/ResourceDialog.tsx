import {useEffect, useId, useLayoutEffect, useRef, type ReactNode} from 'react';
import {useDialogGeometry} from './useDialogGeometry';

/** Native modal focus/escape behavior shared by the verified resource editors. */
export function ResourceDialog({titleId, alert = false, busy, onCancel, children, closeOnBackdrop = false, adjustable = !alert}: {
  titleId: string; closeOnBackdrop?: boolean; alert?: boolean; adjustable?:boolean; busy: boolean; onCancel: () => void; children: ReactNode;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const caption=useRef<HTMLSpanElement>(null),captionId=useId();
  useLayoutEffect(()=>{
    const heading=element.current?.querySelector<HTMLElement>('#'+CSS.escape(titleId)),label=caption.current;
    if(!heading || !label)return;
    const sync=()=>{label.textContent=heading.textContent;};sync();
    const observer=new MutationObserver(sync);observer.observe(heading,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[titleId]);
  useDialogGeometry(element,titleId,adjustable,busy);
  useEffect(() => {
    const dialog = element.current;
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog?.showModal();
    return () => {dialog?.close();if(opener?.isConnected && opener.getClientRects().length && !opener.closest('[inert]') && !document.querySelector('dialog[open]'))opener.focus({preventScroll:true});};
  }, []);
  return <dialog ref={element} className="post-dialog" role={alert ? 'alertdialog' : 'dialog'} aria-labelledby={captionId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} onClick={event => {
      if (!closeOnBackdrop || busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}><span ref={caption} id={captionId} hidden/>{children}{adjustable?<>
      <span id={`${captionId}-geometry-help`} className="dialog-geometry-help">拖动标题或调整手柄。聚焦手柄后使用方向键，Shift 加速，Home 恢复默认位置和大小。</span>
      <button type="button" className="dialog-move-handle" data-dialog-geometry="move" aria-label="移动弹窗" aria-describedby={`${captionId}-geometry-help`} disabled={busy}>↔</button>
      <button type="button" className="dialog-width-handle" data-dialog-geometry="width" aria-label="调整弹窗宽度" aria-describedby={`${captionId}-geometry-help`} disabled={busy}>↔</button>
      <button type="button" className="dialog-size-handle" data-dialog-geometry="size" aria-label="调整弹窗大小" aria-describedby={`${captionId}-geometry-help`} disabled={busy}>↘</button>
    </>:null}</dialog>;
}
