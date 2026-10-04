import type {MouseEvent} from 'react';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../integration/navigation';
export function Navigation({items, pathname, router}: {items: NavigationItem[]; pathname: string; router: AppRouterAdapter}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault(); router.navigate(href);
  }
  return <ul className="enterprise-navigation">{items.map(item => <li key={item.key}>
    {item.href ? <a href={item.href} aria-current={!item.external && pathname === item.href ? 'page' : undefined}
      {...(item.external ? {target: '_blank', rel: 'noopener noreferrer'} : {onClick: (event: MouseEvent<HTMLAnchorElement>) => navigate(event, item.href!)})}>
      <span>{item.label}</span>{item.external ? <span aria-label="在新窗口打开">↗</span> : null}</a>
      : <span className="navigation-group">{item.label}</span>}
    {item.children.length ? <Navigation items={item.children} pathname={pathname} router={router} /> : null}
  </li>)}</ul>;
}
