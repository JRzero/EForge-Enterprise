import {NativeButton, NativeInput, Select} from '../../ui/native';
import {useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type KeyboardEvent} from 'react';
import {AppShell} from '../../ui/patterns';
import type {AppRouterAdapter} from '@eforge/app';
import type {NavigationItem} from '../../integration/navigation';
import {Navigation} from '../Navigation';
import {ResourceDialog} from './ResourceDialog';
import {HeaderUtilities} from './HeaderUtilities';
import {TopNavigation, navigationContains} from './TopNavigation';
import {LayoutContext,LayoutChangesContext,layoutDefaults,useLayoutPreferences} from './layout-preferences';
import {matchAppRoute} from '@eforge/app';
import {routes} from '../routes';
import {UiIcon} from './UiIcon';
const mobileQuery = '(max-width: 991px)';
const sidebarPreference = 'eforge.enterprise.sidebar.v1';

type NavigationMode = 'left' | 'mixed' | 'top';
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
  activePaths: readonly string[]; brand: ReactNode; header: (menuButton: ReactNode, tools: ReactNode) => ReactNode; items: NavigationItem[];
  pathname: string; href: string; ownerId: string; router: AppRouterAdapter; children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribeViewport, isMobile, () => false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const {preferences,setPreferences,save,reset}=useLayoutPreferences(ownerId);
  const mode=preferences.navMode;
  const setMode=(value:NavigationMode)=>setPreferences(current=>({...current,navMode:value}));
  const pageTitle=matchAppRoute(routes,pathname)?.route.title ?? 'EForge Enterprise';
  useEffect(()=>{const previous=document.title;document.title=preferences.dynamicTitle ? pageTitle+' - EForge Enterprise' : 'EForge Enterprise';return()=>{document.title=previous;};},[pageTitle,preferences.dynamicTitle]);
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
  const menuButton = mobile ? <NativeButton ref={opener} type="button" className="sidebar-toggle" aria-label="打开菜单" aria-expanded={opened}
    aria-haspopup="dialog" aria-controls={opened ? navigationId : undefined} onClick={() => setOpenedFor({href, owner: ownerId})}>
    <UiIcon name="menu" /></NativeButton> : <NativeButton ref={opener} type="button" className="sidebar-toggle" aria-label={collapsed ? '展开菜单' : '收起菜单'}
      aria-expanded={!collapsed} aria-controls={desktopNavigationId} onClick={() => setCollapsed(value => !value)}><UiIcon name="menu" /></NativeButton>;
  return <LayoutChangesContext.Provider value={setPreferences}><LayoutContext.Provider value={preferences}><div className="enterprise-layout" style={{"--ef-color-accent":preferences.theme,"--ui-menu-active":preferences.theme===layoutDefaults.theme?'#2174cc':preferences.theme,"--ui-menu-selected":preferences.theme===layoutDefaults.theme?'#eaf3fc':'color-mix(in srgb, var(--ui-primary) 8%, white)'} as React.CSSProperties} data-side-theme={preferences.sideTheme} data-density={preferences.density} data-fixed-header={preferences.fixedHeader} data-show-logo={preferences.sidebarLogo} data-sidebar-collapsed={!mobile && collapsed} data-sidebar-hidden={hideSidebar} data-navigation-mode={mobile ? 'left' : mode}>
    <AppShell sidebarWidth={!mobile && collapsed ? 54 : 200} brand={brand} navigation={<div id={desktopNavigationId}><Navigation items={sideItems} pathname={pathname} router={router} activePaths={activePaths} collapsed={!mobile && collapsed} /></div>}
      header={<>{header(<>{hideSidebar && preferences.sidebarLogo ? <div className="top-navigation-brand">{brand}</div> : null}{!hideSidebar ? menuButton : null}</>, <><HeaderUtilities/><NativeButton ref={settingsButton} type="button" className="header-icon-button" aria-label="布局设置" title="布局设置" onClick={() => {setSettingMessage('');setSettings(true);}}><UiIcon name="settings" /></NativeButton></>)}
        {!mobile && mode !== 'left' ? <TopNavigation items={items} pathname={pathname} href={href} activePaths={activePaths} router={router}
          mixed={mode === 'mixed'} selected={selectedKey} onSelect={key => setSelectedRoot({href,owner:ownerId,key})}/> : null}</>}>{children}{preferences.footerVisible ? <footer className="enterprise-footer">{preferences.footerContent}</footer> : null}</AppShell>
    {settings ? <ResourceDialog titleId={settingsTitle} busy={false} onCancel={closeSettings} closeOnBackdrop>
      <section className="navigation-settings"><h2 id={settingsTitle}>布局设置</h2><fieldset><legend>菜单导航模式</legend>
        {([['left','左侧菜单'],['mixed','混合菜单'],['top','顶部菜单']] as const).map(([value,label]) => <label key={value}>
          <NativeInput type="radio" name={settingsTitle} value={value} checked={mode===value} onChange={() => setMode(value)}/>{label}</label>)}
      </fieldset><fieldset><legend>主题风格</legend><label>侧栏风格<Select aria-label="侧栏风格" value={preferences.sideTheme} onChange={event=>setPreferences(current=>({...current,sideTheme:event.target.value as 'dark'|'light'}))}><option value="dark">深色</option><option value="light">浅色</option></Select></label>
        <label>主题颜色<NativeInput type="color" aria-label="主题颜色" value={preferences.theme} onChange={event=>setPreferences(current=>({...current,theme:event.target.value}))}/></label>
        <label>界面尺寸<Select aria-label="界面尺寸" value={preferences.density} onChange={event=>setPreferences(current=>({...current,density:event.target.value as typeof current.density}))}><option value="default">默认</option><option value="medium">中等</option><option value="small">小型</option><option value="mini">迷你</option></Select></label>
      </fieldset><fieldset><legend>系统布局配置</legend>
        {([['tagsView','显示页面标签'],['tagsIcon','显示页签图标'],['fixedHeader','固定头部'],['sidebarLogo','显示 Logo'],['dynamicTitle','动态标题'],['footerVisible','显示页脚']] as const).map(([property,label])=><label key={property}><NativeInput type="checkbox" checked={preferences[property]} disabled={property==='tagsIcon' && !preferences.tagsView} onChange={event=>setPreferences(current=>({...current,[property]:event.target.checked}))}/>{label}</label>)}
        <label><NativeInput type="checkbox" checked={preferences.tagsViewPersist ?? false} disabled={!preferences.tagsView} onChange={event=>setPreferences(current=>({...current,tagsViewPersist:event.target.checked}))}/>持久化标签页</label>
        <label>页脚内容<NativeInput aria-label="页脚内容" maxLength={1024} value={preferences.footerContent} onChange={event=>setPreferences(current=>({...current,footerContent:event.target.value}))}/></label>
      </fieldset><div className="layout-reference-links"><a href="https://github.com/JRzero/EForge-Enterprise" target="_blank" rel="noopener noreferrer">源码仓库</a><a href="https://doc.ruoyi.vip/" target="_blank" rel="noopener noreferrer">参考文档</a></div>{settingMessage ? <p role="status">{settingMessage}</p> : null}<div className="state-actions">
        <NativeButton type="button" onClick={() => {try {save();setSettingMessage('布局已保存');} catch {setSettingMessage('无法保存布局，请检查浏览器存储设置');}}}>保存配置</NativeButton>
        <NativeButton type="button" onClick={() => {setPreferences({...layoutDefaults});try {reset();setSettingMessage('已恢复默认布局');} catch {setSettingMessage('当前布局已恢复，无法清除保存的配置');}}}>恢复默认</NativeButton>
        <NativeButton type="button" onClick={closeSettings}>关闭设置</NativeButton></div></section>
    </ResourceDialog> : null}
    {opened ? <ResourceDialog titleId={titleId} busy={false} onCancel={close} closeOnBackdrop adjustable={false}>
      <div className="sidebar-drawer-body" id={navigationId} onKeyDown={trapDrawerTab}>
        <div className="sidebar-drawer-title"><h2 id={titleId}>菜单</h2><NativeButton type="button" aria-label="关闭菜单" onClick={close}>×</NativeButton></div>
        <div className="sidebar-drawer-brand">{brand}</div>
        <nav aria-label="手机菜单"><Navigation items={items} pathname={pathname} router={router} activePaths={activePaths} /></nav>
      </div>
    </ResourceDialog> : null}
  </div></LayoutContext.Provider></LayoutChangesContext.Provider>;
}
