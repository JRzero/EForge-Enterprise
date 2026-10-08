import type {RefObject} from 'react';
export interface TagMenuAction {id: string; label: string; disabled?: boolean; onSelect: () => void}
export function TagMenu({actions, menuRef, point, onDismiss}: {actions: readonly TagMenuAction[]; menuRef: RefObject<HTMLDivElement | null>; point?: {x: number; y: number}; onDismiss: () => void}) {
  return <div ref={menuRef} role="menu" aria-label="标签操作菜单" className="page-tag-menu" style={point ? {position:'fixed',left:point.x,top:point.y,right:'auto'} : undefined}
    onKeyDown={event=>{
      if(event.key==='Escape'){onDismiss();return;}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement), step=event.key==='ArrowDown'?1:-1;
        buttons[(index+step+buttons.length)%buttons.length]?.focus();
      }
    }}>{actions.map(action=><button key={action.id} type="button" role="menuitem" disabled={action.disabled} onClick={action.onSelect}>{action.label}</button>)}</div>;
}
