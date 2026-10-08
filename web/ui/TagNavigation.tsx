import type {KeyboardEvent, MouseEvent, ReactNode, RefObject} from 'react';

export interface PageTag {path: string; href: string; title: string; affix: boolean; icon?: string}
export interface TagNavigationProps {
  items: readonly PageTag[]; activePath?: string; hidden?: boolean; showIcons?: boolean;
  stripRef: RefObject<HTMLDivElement | null>; scroll: {left: boolean; right: boolean};
  expanded: boolean; persist: boolean; canRefresh: boolean;
  renderIcon?: (name?: string) => ReactNode;
  onNavigate: (tag: PageTag) => void; onClose: (tag: PageTag) => void;
  onContextMenu: (tag: PageTag, event: MouseEvent<HTMLAnchorElement>) => void;
  onActions: (event: MouseEvent<HTMLButtonElement>) => void;
  onRefresh: () => void; onPersist: (value: boolean) => void;
}

/** Controlled tag strip: authorization, caching and dirty guards stay with its owner. */
export function TagNavigation({items, activePath, hidden, showIcons, stripRef, scroll, expanded, persist,
  canRefresh, renderIcon, onNavigate, onClose, onContextMenu, onActions, onRefresh, onPersist}: TagNavigationProps) {
  function keyboard(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined;
    if (next !== undefined) {event.preventDefault(); stripRef.current?.querySelectorAll<HTMLAnchorElement>('a')[next]?.focus();}
  }
  return <nav hidden={hidden} aria-label="页面标签" className="page-tags">
    <button type="button" aria-label="滚动到首个标签" disabled={!scroll.left} onClick={() => stripRef.current?.scrollTo({left: 0, behavior: 'smooth'})}>‹</button>
    <div ref={stripRef} className="page-tags-strip">{items.map((item,index) => <span key={item.path} className="page-tag">
      <a href={item.href} aria-label={`页面标签：${item.title}`} aria-current={activePath === item.path ? 'page' : undefined} onKeyDown={event => keyboard(event,index)}
        onClick={event => {if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {event.preventDefault(); onNavigate(item);}}}
        onAuxClick={event => {if (event.button === 1) {event.preventDefault(); if (!item.affix) onClose(item);}}}
        onContextMenu={event => {event.preventDefault(); onContextMenu(item,event);}}>
        {showIcons ? renderIcon?.(item.icon) : null}{item.title}{item.affix ? <span aria-label="固定标签">●</span> : null}
      </a>{!item.affix ? <button type="button" aria-label={`关闭标签 ${item.title}`} onClick={() => onClose(item)}>×</button> : null}
    </span>)}</div>
    <button type="button" aria-label="滚动到末个标签" disabled={!scroll.right} onClick={() => stripRef.current?.scrollTo({left: stripRef.current.scrollWidth, behavior: 'smooth'})}>›</button>
    <button type="button" aria-label="标签操作" aria-expanded={expanded} onClick={onActions}>⌄</button>
    <button type="button" aria-label="刷新当前页面" disabled={!canRefresh} onClick={onRefresh}>刷新</button>
    <label className="page-tags-persist"><input type="checkbox" checked={persist} onChange={event => onPersist(event.target.checked)}/>记住标签</label>
  </nav>;
}
