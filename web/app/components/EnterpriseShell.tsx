import {useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type KeyboardEvent} from 'react';
import {AppShell} from '@eforge/patterns';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {Navigation} from '../Navigation';
import {ResourceDialog} from './ResourceDialog';
const mobileQuery = '(max-width: 991px)';
const sidebarPreference = 'eforge.enterprise.sidebar.v1';
function readCollapsed() {try {return window.localStorage.getItem(sidebarPreference) === 'collapsed';} catch {return false;}}
function subscribeViewport(listener: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function isMobile() {return window.matchMedia(mobileQuery).matches;}
function trapDrawerTab(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab') return;
  const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]'))
    .filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length > 0);
  const first = stops[0], last = stops.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
}
export function EnterpriseShell({brand, header, items, pathname, href, ownerId, router, children, activePaths}: {
  activePaths: readonly string[]; brand: ReactNode; header: (menuButton: ReactNode) => ReactNode; items: NavigationItem[];
  pathname: string; href: string; ownerId: string; router: AppRouterAdapter; children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribeViewport, isMobile, () => false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {try {window.localStorage.setItem(sidebarPreference, collapsed ? 'collapsed' : 'expanded');} catch {/* Preference storage can be unavailable; navigation still works. */}}, [collapsed]);
  const [openedFor, setOpenedFor] = useState<{href: string; owner: string} | null>(null);
  const titleId = useId(), navigationId = useId(), desktopNavigationId = useId();
  const opener = useRef<HTMLButtonElement>(null), previouslyOpened = useRef(false);
  const opened = mobile && openedFor?.href === href && openedFor.owner === ownerId;
  // Route, account and breakpoint changes dismiss the modal before exposing new content.
  if (openedFor && !opened) setOpenedFor(null);
  useEffect(() => {
    if (previouslyOpened.current && !opened) opener.current?.focus();
    previouslyOpened.current = opened;
    if (opened) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {document.body.style.overflow = previousOverflow;};
    }
  }, [opened]);
  const close = () => setOpenedFor(null);
  const menuButton = mobile ? <button ref={opener} type="button" className="sidebar-toggle" aria-label="打开菜单" aria-expanded={opened}
    aria-haspopup="dialog" aria-controls={opened ? navigationId : undefined} onClick={() => setOpenedFor({href, owner: ownerId})}>
    <span aria-hidden="true">☰</span></button> : <button ref={opener} type="button" className="sidebar-toggle" aria-label={collapsed ? '展开菜单' : '收起菜单'}
      aria-expanded={!collapsed} aria-controls={desktopNavigationId} onClick={() => setCollapsed(value => !value)}><span aria-hidden="true">☰</span></button>;
  return <div className="enterprise-layout" data-sidebar-collapsed={!mobile && collapsed}>
    <AppShell sidebarWidth={!mobile && collapsed ? 64 : 240} brand={brand} navigation={<div id={desktopNavigationId}><Navigation items={items} pathname={pathname} router={router} activePaths={activePaths} collapsed={!mobile && collapsed} /></div>}
      header={header(menuButton)}>{children}</AppShell>
    {opened ? <ResourceDialog titleId={titleId} busy={false} onCancel={close} closeOnBackdrop>
      <div className="sidebar-drawer-body" id={navigationId} onKeyDown={trapDrawerTab}>
        <div className="sidebar-drawer-title"><h2 id={titleId}>菜单</h2><button type="button" aria-label="关闭菜单" onClick={close}>×</button></div>
        <div className="sidebar-drawer-brand">{brand}</div>
        <nav aria-label="手机菜单"><Navigation items={items} pathname={pathname} router={router} activePaths={activePaths} /></nav>
      </div>
    </ResourceDialog> : null}
  </div>;
}