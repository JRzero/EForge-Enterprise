import {Activity, useRef, useCallback, useEffect, useMemo, useState} from 'react';
import {PermissionProvider} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import {getRouteAncestry, matchAppRoute, canAccessRoute, type AppRouterAdapter} from '@eforge/app';
import {ScreenLockPage} from '../features/auth/ScreenLockPage';
import {readScreenLock,saveScreenLock,lockBelongsTo,safeLockReturn,type ScreenLock} from '../features/auth/screen-lock';
import {projectNavigation} from '../integration/navigation';
import {errorMessage} from '../integration/errors';
import type {SessionRuntime} from '../integration/session';
import type {BootstrapResponse} from '../generated/api';
import {BootstrapContext, ApiContext, ApplicationControlsContext, NavigationContext, NoticeRefreshContext} from './context';
import {PasswordReminder} from './components/PasswordReminder';
import {AccountAvatar} from './components/AccountAvatar';
import {EnterpriseShell} from './components/EnterpriseShell';
import {NavigationBreadcrumbs, NavigationSearch} from './components/NavigationTools';
import {routes} from './routes';
import {PageWorkspace, type PageUnloadGuard} from './components/PageWorkspace';
import {toEForgePermissions} from '../integration/permissions';
import {DeferredFeature} from './components/DeferredFeature';
import {UiIcon} from './components/UiIcon';
const loadHeaderNotices = () => import('../features/notices/HeaderNotices').then(module => ({default: module.HeaderNotices}));

function StatePage({code, router}: {code: '403' | '404'; router: AppRouterAdapter}) {
  function back() {
    const flags = new URL(router.getCurrentHref(), 'http://eforge.local').searchParams.getAll('noGoBack');
    if (flags.length > 1 || !!flags[0]) router.navigate('/dashboard');
    else window.history.back();
  }
  return <section className="state-page"><span className="eyebrow">{code}</span>
    <h1>{code === '403' ? '暂无访问权限' : '页面不存在'}</h1>
    <p>{code === '403' ? '如需访问，请联系企业管理员。' : '请检查地址，或返回工作台继续。'}</p>
    <div className="state-actions">{code === '403' ? <Button label="返回上一页" onClick={back} /> : null}
      <Button label="返回工作台" variant="ghost" onClick={() => router.navigate('/dashboard')} /></div></section>;
}
export function AuthenticatedApplication({runtime, router, bootstrap, href}: {runtime: SessionRuntime; router: AppRouterAdapter; bootstrap: BootstrapResponse; href: string}) {
  const [screenLock,setScreenLock]=useState<ScreenLock|null>(readScreenLock);
  const lockGeneration=useRef(0);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [noticeVersion, setNoticeVersion] = useState(0);
  const invalidateNotices = useCallback(() => setNoticeVersion(value => value + 1), []);
  const pathname = new URL(href, 'http://eforge.local').pathname;
  useEffect(()=>{if(pathname==='/login')router.navigate('/dashboard',{replace:true});},[pathname,router]);
  // Invalidate an in-flight unlock when this authenticated owner unmounts.
  useEffect(()=>()=>{lockGeneration.current++;},[]);
  useEffect(()=>{
    if(bootstrap && pathname==='/lock' && !lockBelongsTo(screenLock,bootstrap.user)){
      const value={ownerId:bootstrap.user.id,username:bootstrap.user.username,returnHref:'/dashboard'};saveScreenLock(value);setScreenLock(value);lockGeneration.current++;
    }
  },[bootstrap,pathname,screenLock]);
  const navigation = useMemo(() => bootstrap ? projectNavigation(bootstrap.navigation, routes, bootstrap.permissions) : [], [bootstrap]);
  const permissions = useMemo(() => bootstrap ? toEForgePermissions(bootstrap.permissions) : [], [bootstrap]);
  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true); setLogoutError('');
    try { await runtime.logout(); lockGeneration.current++;setScreenLock(null);saveScreenLock(null);router.navigate('/login', {replace: true}); }
    catch (error) { setLogoutError(errorMessage(error)); }
    finally { setLogoutBusy(false); }
  }
  const snapshot = bootstrap;
  const workspaceOwnerKey = JSON.stringify([snapshot.user.id,snapshot.user.username,snapshot.roles,snapshot.permissions,snapshot.navigation]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- A fresh guard belongs to each workspace owner, including authorization changes.
  const unloadGuard = useMemo<PageUnloadGuard>(() => ({shouldBlock: () => false}), [workspaceOwnerKey]);
  // Locking hides the workspace and cleans its effects. Keep the browser listener
  // here, scoped to the same identity/authorization owner as the workspace itself.
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!unloadGuard.shouldBlock()) return;
      event.preventDefault(); event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [unloadGuard]);
  const ownedLock=lockBelongsTo(screenLock,snapshot.user)?screenLock:null;
  const locked=!!ownedLock || pathname==='/lock';
  const contentHref=locked?(ownedLock?.returnHref??'/dashboard'):href;
  const contentPathname=new URL(contentHref,'http://eforge.local').pathname;
  function lockScreen(){const value={ownerId:snapshot.user.id,username:snapshot.user.username,returnHref:safeLockReturn(href)};lockGeneration.current++;saveScreenLock(value);setScreenLock(value);router.navigate('/lock',{replace:true});}
  async function unlockScreen(password:string){const generation=lockGeneration.current;const actor=snapshot.user;await runtime.api.unlockScreen({password});const current=runtime.getSnapshot();if(generation!==lockGeneration.current || current.phase!=='authenticated' || current.bootstrap.user.id!==actor.id || current.bootstrap.user.username!==actor.username)return;await runtime.refresh();const refreshed=runtime.getSnapshot();if(generation!==lockGeneration.current || refreshed.phase!=='authenticated' || refreshed.bootstrap.user.id!==actor.id || refreshed.bootstrap.user.username!==actor.username)return;lockGeneration.current++;saveScreenLock(null);setScreenLock(null);router.navigate(ownedLock?.returnHref??'/dashboard',{replace:true});}
  const match = matchAppRoute(routes, contentPathname === '/' ? '/dashboard' : contentPathname);
  const allowed = match && canAccessRoute(match.route, permissions);

  return <ApiContext.Provider value={runtime.api}><BootstrapContext.Provider value={snapshot}><NavigationContext.Provider value={navigation}><ApplicationControlsContext.Provider value={{navigate: path => router.navigate(path), refresh: runtime.refresh}}><NoticeRefreshContext.Provider value={invalidateNotices}><PermissionProvider permissions={permissions}>
    {locked?<ScreenLockPage key={snapshot.user.id+snapshot.user.username} user={snapshot.user} unlock={unlockScreen} logout={logout} logoutBusy={logoutBusy} logoutError={logoutError}/>:null}<Activity mode={locked?'hidden':'visible'}><PasswordReminder key={snapshot.user.id+snapshot.user.username+JSON.stringify(snapshot.passwordStatus)} status={snapshot.passwordStatus}/><EnterpriseShell activePaths={match ? getRouteAncestry(routes,match.route.id).map(route => route.path) : []} items={navigation} pathname={contentPathname === '/' ? '/dashboard' : contentPathname} href={contentHref} ownerId={snapshot.user.id} router={router} brand={<a aria-label="EForge Enterprise" className="enterprise-brand" href="/dashboard" onClick={event => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault(); router.navigate('/dashboard');
      }
    }}><span className="brand-mark">E</span><span>EForge<span className="brand-subtitle">Enterprise</span></span></a>}
      header={(menuButton, shellTools) => <div className="enterprise-header"><div className="enterprise-header-left">{menuButton}{match && allowed ? <NavigationBreadcrumbs items={navigation} routes={routes} match={match} router={router} /> : <span>EForge Enterprise</span>}</div><div className="enterprise-header-actions"><NavigationSearch items={navigation} router={router} />{shellTools}
        <DeferredFeature load={loadHeaderNotices} componentProps={{version: noticeVersion}} fallback={null}
          errorFallback={retry => <span role="alert">公告暂时无法加载<Button label="重试通知公告" variant="ghost" size="sm" onClick={retry} /></span>} />
        <a className="header-account-link" aria-label="个人中心" title="个人中心" href="/user/profile" onClick={event => { if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); router.navigate('/user/profile'); } }}><AccountAvatar key={snapshot.user.id+snapshot.user.avatarUrl} user={snapshot.user}/><span className="header-account-name account-name">{snapshot.user.displayName}</span></a>
        <Button label="锁定屏幕" icon={<UiIcon name="lock" />} isIconOnly variant="ghost" size="sm" isDisabled={logoutBusy} onClick={lockScreen}/>
        <Button label={logoutBusy ? '正在退出…' : '退出登录'} icon={<UiIcon name="logout" />} isIconOnly variant="ghost" size="sm" isDisabled={logoutBusy} onClick={() => { void logout(); }} /></div></div>}>
      {logoutError ? <p role="alert">{logoutError}</p> : null}
      <PageWorkspace key={workspaceOwnerKey} unloadGuard={unloadGuard} ownerId={snapshot.user.id} href={contentHref} items={navigation} permissions={permissions} router={router}
        fallback={<StatePage code={match?'403':'404'} router={router} />} />
    </EnterpriseShell></Activity>
  </PermissionProvider></NoticeRefreshContext.Provider></ApplicationControlsContext.Provider></NavigationContext.Provider></BootstrapContext.Provider></ApiContext.Provider>;
}
