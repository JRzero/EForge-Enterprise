import {useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type KeyboardEvent} from 'react';
import {AppShell} from '@eforge/patterns';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {Navigation} from '../Navigation';
import {ResourceDialog} from './ResourceDialog';
import {TopNavigation, navigationContains} from './TopNavigation';
const mobileQuery = '(max-width: 991px)';
const sidebarPreference = 'eforge.enterprise.sidebar.v1';
const navigationPreference = 'eforge.enterprise.navigation.v1';
type NavigationMode = 'left' | 'mixed' | 'top';
function readNavigationMode(): NavigationMode {
  try {const value = window.localStorage.getItem(navigationPreference);return value === 'mixed' || value === 'top' ? value : 'left';} catch {return 'left';}
}
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
  const [mode, setMode] = useState<NavigationMode>(readNavigationMode);
  const [settings, setSettings] = useState(false), [settingMessage, setSettingMessage] = useState('');
  const settingsButton = useRef<HTMLButtonElement>(null), settingsTitle = useId();
  const settingsWasOpen = useRef(false);
  useEffect(() => {if (settingsWasOpen.current && !settings) settingsButton.current?.focus();settingsWasOpen.current=settings;},[settings]);
  const activeRoot = items.find(item => navigationContains(item,pathname,activePaths));
  const [selectedRoot, setSelectedRoot] = useState({href,owner:ownerId,key:activeRoot?.key ?? null});
  const rootChanged = selectedRoot.href !== href || selectedRoot.owner !== ownerId;
  const selectedKey = rootChanged ? activeRoot?.key ?? null : selectedRoot.key;
  if (rootChanged) setSelectedRoot({href,owner:ownerId,key:selectedKey});
  const selected = items.find(item => item.key === selectedKey);
  const sideItems = !mobile && mode === 'mixed' ? selected?.children ?? [] : items;
  const hideSidebar = !mobile && (mode === 'top' || (mode === 'mixed' && !sideItems.length));
  function closeSettings() {setSettings(false);settingsButton.current?.focus();}
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
  return <div className="enterprise-layout" data-sidebar-collapsed={!mobile && collapsed} data-sidebar-hidden={hideSidebar} data-navigation-mode={mobile ? 'left' : mode}>
    <AppShell sidebarWidth={!mobile && collapsed ? 64 : 240} brand={brand} navigation={<div id={desktopNavigationId}><Navigation items={sideItems} pathname={pathname} router={router} activePaths={activePaths} collapsed={!mobile && collapsed} /></div>}
      header={<>{header(<>{!hideSidebar ? menuButton : null}<button ref={settingsButton} type="button" aria-label="布局设置" onClick={() => {setSettingMessage('');setSettings(true);}}>⚙</button></>)}
        {!mobile && mode !== 'left' ? <TopNavigation items={items} pathname={pathname} href={href} activePaths={activePaths} router={router}
          mixed={mode === 'mixed'} selected={selectedKey} onSelect={key => setSelectedRoot({href,owner:ownerId,key})}/> : null}</>}>{children}</AppShell>
    {settings ? <ResourceDialog titleId={settingsTitle} busy={false} onCancel={closeSettings} closeOnBackdrop>
      <section className="navigation-settings"><h2 id={settingsTitle}>布局设置</h2><fieldset><legend>菜单导航模式</legend>
        {([['left','左侧菜单'],['mixed','混合菜单'],['top','顶部菜单']] as const).map(([value,label]) => <label key={value}>
          <input type="radio" name={settingsTitle} value={value} checked={mode===value} onChange={() => setMode(value)}/>{label}</label>)}
      </fieldset>{settingMessage ? <p role="status">{settingMessage}</p> : null}<div className="state-actions">
        <button type="button" onClick={() => {try {localStorage.setItem(navigationPreference,mode);setSettingMessage('布局已保存');} catch {setSettingMessage('无法保存布局，请检查浏览器存储设置');}}}>保存配置</button>
        <button type="button" onClick={() => {setMode('left');try {localStorage.removeItem(navigationPreference);setSettingMessage('已恢复默认布局');} catch {setSettingMessage('当前布局已恢复，无法清除保存的配置');}}}>恢复默认</button>
        <button type="button" onClick={closeSettings}>关闭设置</button></div></section>
    </ResourceDialog> : null}
    {opened ? <ResourceDialog titleId={titleId} busy={false} onCancel={close} closeOnBackdrop>
      <div className="sidebar-drawer-body" id={navigationId} onKeyDown={trapDrawerTab}>
        <div className="sidebar-drawer-title"><h2 id={titleId}>菜单</h2><button type="button" aria-label="关闭菜单" onClick={close}>×</button></div>
        <div className="sidebar-drawer-brand">{brand}</div>
        <nav aria-label="手机菜单"><Navigation items={items} pathname={pathname} router={router} activePaths={activePaths} /></nav>
      </div>
    </ResourceDialog> : null}
  </div>;
}
