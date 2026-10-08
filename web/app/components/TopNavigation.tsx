import {NativeButton} from '../../ui/native';
import {useEffect, useId, useRef, useState, type MouseEvent} from 'react';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {MenuIcon} from '../../features/menus/IconPicker';
import {Navigation} from '../Navigation';

export function navigationContains(item: NavigationItem, pathname: string, activePaths: readonly string[]): boolean {
  return (!item.external && !!item.path && (item.path === pathname || activePaths.includes(item.path)))
    || item.children.some(child => navigationContains(child, pathname, activePaths));
}
export function TopNavigation({items, pathname, href, activePaths, router, mixed, selected, onSelect}: {
  items: NavigationItem[]; pathname: string; href: string; activePaths: readonly string[]; router: AppRouterAdapter;
  mixed: boolean; selected: string | null; onSelect: (key: string | null) => void;
}) {
  const root = useRef<HTMLElement>(null), id = useId();
  const [visible, setVisible] = useState(5);
  const [popup, setPopup] = useState<{href: string; key: string} | null>(null);
  const [overflowHref, setOverflowHref] = useState<string | null>(null);
  const opened = popup?.href === href ? popup.key : null;
  const more = overflowHref === href;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setVisible(Math.max(1, Math.floor((element.clientWidth - 110) / 180))));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!opened && !more) return;
    const outside = (event: PointerEvent) => {if (event.target instanceof Node && !root.current?.contains(event.target)) {setPopup(null);setOverflowHref(null);}};
    const resize = () => {setPopup(null);setOverflowHref(null);};
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    return () => {document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize);};
  }, [opened, more]);
  function follow(event: MouseEvent<HTMLAnchorElement>, item: NavigationItem) {
    if (item.external || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault(); onSelect(item.children.length ? item.key : null); setPopup(null);setOverflowHref(null); router.navigate(item.href!);
  }
  function entry(item: NavigationItem) {
    const active = mixed ? selected === item.key : navigationContains(item, pathname, activePaths);
    const open = opened === item.key;
    return <li key={item.key} onMouseEnter={() => {if (!mixed && item.children.length) setPopup({href,key:item.key});}} onKeyDown={event => {
      if (event.key === 'Escape' && open) {event.preventDefault();event.stopPropagation();setPopup(null);event.currentTarget.querySelector<HTMLButtonElement>(':scope > button')?.focus();}
    }}>
      {item.href ? <a href={item.href} aria-current={active ? 'page' : undefined} onClick={event => follow(event,item)}
        {...(item.external ? {target:'_blank',rel:'noopener noreferrer'} : {})}><MenuIcon name={item.icon}/><span>{item.label}</span>{item.external ? <span aria-label="在新窗口打开">↗</span> : null}</a>
        : <NativeButton type="button" data-active={active} aria-pressed={mixed ? active : undefined} aria-expanded={!mixed ? open : undefined}
          aria-controls={!mixed ? id+'-'+item.key : undefined} onClick={event => {
            if (mixed) {onSelect(item.key);setPopup(null);setOverflowHref(null);} else setPopup(open && !event.detail ? null : {href,key:item.key});
          }}><MenuIcon name={item.icon}/><span>{item.label}</span></NativeButton>}
      {!mixed && item.href && item.children.length ? <NativeButton type="button" aria-label={item.label+'子菜单'} aria-expanded={open} aria-controls={id+'-'+item.key}
        onClick={() => setPopup(open ? null : {href,key:item.key})}>▾</NativeButton> : null}
      {!mixed && item.children.length ? <div hidden={!open} id={id+'-'+item.key} className="top-navigation-popup">
        <Navigation items={item.children} pathname={pathname} activePaths={activePaths} router={router}/>
      </div> : null}
    </li>;
  }
  const extra = items.slice(visible);
  return <nav ref={root} className="top-navigation" aria-label="顶部菜单" onClick={event => {
    if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.target instanceof Element && event.target.closest('a')) {setPopup(null);setOverflowHref(null);}
  }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {setPopup(null);setOverflowHref(null);}
  }} onKeyDown={event => {
    if (event.key === 'Escape' && more) {event.preventDefault();setPopup(null);setOverflowHref(null);root.current?.querySelector<HTMLButtonElement>('.top-navigation-more > button')?.focus();}
  }}><ul>{items.slice(0,visible).map(entry)}{extra.length ? <li className="top-navigation-more">
    <NativeButton type="button" data-active={extra.some(item => mixed ? item.key===selected : navigationContains(item,pathname,activePaths))} aria-expanded={more} aria-controls={id+'-more'} onClick={() => {setPopup(null);setOverflowHref(more ? null : href);}}>更多菜单</NativeButton>
    <ul hidden={!more} id={id+'-more'} className="top-navigation-overflow">{extra.map(entry)}</ul>
  </li> : null}</ul></nav>;
}
