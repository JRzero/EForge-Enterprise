import {useId, useState, type MouseEvent} from 'react';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../integration/navigation';
import {MenuIcon} from '../features/menus/IconPicker';
function containsPath(item: NavigationItem, pathname: string, activePaths: readonly string[]): boolean {
  return (!item.external && !!item.path && (pathname === item.path || activePaths.includes(item.path)))
    || item.children.some(child => containsPath(child, pathname, activePaths));
}
export function Navigation({items, pathname, router, activePaths = []}: {items: NavigationItem[]; pathname: string; router: AppRouterAdapter; activePaths?: readonly string[]}) {
  const id = useId();
  const active = items.find(item => item.children.length && containsPath(item, pathname, activePaths))?.key ?? null;
  const [selection, setSelection] = useState({pathname, key: active});
  // Opening a route expands its ancestry without closing unrelated menus on dashboard return.
  const open = selection.pathname === pathname ? selection.key : active ?? selection.key;
  if (selection.pathname !== pathname) setSelection({pathname, key: open});
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault(); router.navigate(href);
  }
  return <ul className="enterprise-navigation">{items.map(item => {
    const expanded = open === item.key;
    const childrenId = `${id}-${item.key}`;
    return <li key={item.key}>
      {item.href ? <a href={item.href} aria-current={!item.external && pathname === (item.path ?? item.href) ? 'page' : undefined}
        {...(item.external ? {target: '_blank', rel: 'noopener noreferrer'} : {onClick: (event: MouseEvent<HTMLAnchorElement>) => navigate(event, item.href!)})}>
        <MenuIcon name={item.icon} /><span>{item.label}</span>{item.external ? <span aria-label="在新窗口打开">↗</span> : null}</a>
        : item.children.length ? <button type="button" className="navigation-disclosure" aria-expanded={expanded} aria-controls={childrenId}
          onClick={() => setSelection({pathname, key: expanded ? null : item.key})}>
          <MenuIcon name={item.icon} /><span>{item.label}</span><span aria-hidden="true">{expanded ? '▾' : '▸'}</span></button>
        : <span className="navigation-group">{item.label}{item.queryError ? <small role="status">菜单参数配置有误，请联系管理员</small> : null}</span>}
      {item.href && item.children.length ? <button type="button" className="navigation-disclosure" aria-label={`${item.label}子菜单`} aria-expanded={expanded} aria-controls={childrenId}
        onClick={() => setSelection({pathname, key: expanded ? null : item.key})}><span>子菜单</span><span aria-hidden="true">{expanded ? '▾' : '▸'}</span></button> : null}
      {item.children.length ? <div id={childrenId} hidden={!expanded}><Navigation items={item.children} pathname={pathname} router={router} activePaths={activePaths} /></div> : null}
    </li>;
  })}</ul>;
}