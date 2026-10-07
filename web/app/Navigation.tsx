import {useEffect, useId, useRef, useState, type MouseEvent} from 'react';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../integration/navigation';
import {MenuIcon} from '../features/menus/IconPicker';
function containsPath(item: NavigationItem, pathname: string, activePaths: readonly string[]): boolean {
  return (!item.external && !!item.path && (pathname === item.path || activePaths.includes(item.path)))
    || item.children.some(child => containsPath(child, pathname, activePaths));
}
export function Navigation({items, pathname, router, activePaths = [], collapsed = false}: {
  items: NavigationItem[]; pathname: string; router: AppRouterAdapter; activePaths?: readonly string[]; collapsed?: boolean;
}) {
  const id = useId(), root = useRef<HTMLUListElement>(null);
  const active = items.find(item => item.children.length && containsPath(item, pathname, activePaths))?.key ?? null;
  const [selection, setSelection] = useState({pathname, collapsed, key: collapsed ? null : active, top: 8});
  const changed = selection.pathname !== pathname || selection.collapsed !== collapsed;
  const open = changed ? (collapsed ? null : active ?? selection.key) : selection.key;
  if (changed) setSelection({pathname, collapsed, key: open, top: 8});
  useEffect(() => {
    if (!collapsed || !open) return;
    const close = () => setSelection(value => ({...value, key: null}));
    const outside = (event: PointerEvent) => {if (event.target instanceof Node && !root.current?.contains(event.target)) close();};
    const scroll = (event: Event) => {if (!(event.target instanceof HTMLElement) || !event.target.closest('.navigation-popup')) close();};
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => {document.removeEventListener('pointerdown', outside);document.removeEventListener('scroll', scroll, true);window.removeEventListener('resize', close);};
  }, [collapsed, open]);
  function choose(key: string | null, element: HTMLElement) {
    setSelection({pathname, collapsed, key, top: Math.max(8, Math.min(element.getBoundingClientRect().top, window.innerHeight - 140))});
  }
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault(); router.navigate(href);
  }
  return <ul ref={root} className={'enterprise-navigation' + (collapsed ? ' navigation-collapsed' : '')}>{items.map(item => {
    const expanded = open === item.key;
    const childrenId = `${id}-${item.key}`;
    return <li key={item.key}
      onMouseEnter={event => {if (collapsed && item.children.length) choose(item.key, event.currentTarget);}}
      onMouseLeave={event => {if (collapsed && expanded && !event.currentTarget.contains(document.activeElement)) choose(null, event.currentTarget);}}
      onBlur={event => {if (collapsed && expanded && !event.currentTarget.contains(event.relatedTarget)) choose(null, event.currentTarget);}}
      onKeyDown={event => {if (collapsed && event.key === 'Escape' && expanded) {event.preventDefault();event.stopPropagation();choose(null,event.currentTarget);event.currentTarget.querySelector<HTMLButtonElement>(':scope > button')?.focus();}}}>
      {item.href ? <a href={item.href} aria-label={collapsed ? item.label + (item.external ? ' 在新窗口打开' : '') : undefined} title={collapsed ? item.label : undefined}
        aria-current={!item.external && pathname === (item.path ?? item.href) ? 'page' : undefined}
        {...(item.external ? {target: '_blank', rel: 'noopener noreferrer'} : {onClick: (event: MouseEvent<HTMLAnchorElement>) => navigate(event, item.href!)})}>
        <MenuIcon name={item.icon} /><span>{item.label}</span>{item.external ? <span aria-label="在新窗口打开">↗</span> : null}</a>
        : item.children.length ? <button type="button" className="navigation-disclosure" aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}
          aria-expanded={expanded} aria-controls={childrenId} onClick={event => choose(expanded ? null : item.key, event.currentTarget)}>
          <MenuIcon name={item.icon} /><span>{item.label}</span><span aria-hidden="true">{expanded ? '▾' : '▸'}</span></button>
        : <span className="navigation-group" title={collapsed ? item.label : undefined}>{item.label}{item.queryError ? <small role="status">菜单参数配置有误，请联系管理员</small> : null}</span>}
      {item.href && item.children.length ? <button type="button" className="navigation-disclosure" aria-label={`${item.label}子菜单`} aria-expanded={expanded} aria-controls={childrenId}
        onClick={event => choose(expanded ? null : item.key, event.currentTarget)}><span>子菜单</span><span aria-hidden="true">{expanded ? '▾' : '▸'}</span></button> : null}
      {item.children.length ? <div id={childrenId} hidden={!expanded} className={collapsed ? 'navigation-popup' : undefined} style={collapsed ? {top: selection.top, maxHeight: Math.max(0, window.innerHeight - selection.top - 8)} : undefined}>
        <Navigation items={item.children} pathname={pathname} router={router} activePaths={activePaths} /></div> : null}
    </li>;
  })}</ul>;
}