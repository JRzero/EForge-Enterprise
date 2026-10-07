import {Activity, lazy, Suspense, useRef, useCallback, useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {PermissionProvider} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import {getRouteAncestry, matchAppRoute, canAccessRoute, type AppRouterAdapter} from '@eforge/app';
import {ScreenLockPage} from '../features/auth/ScreenLockPage';
import {readScreenLock,saveScreenLock,lockBelongsTo,safeLockReturn,type ScreenLock} from '../features/auth/screen-lock';
import {LoginPage} from '../features/auth/LoginPage';
import {RegistrationPage} from '../features/auth/RegistrationPage';
import {projectNavigation} from '../integration/navigation';
import {errorMessage} from '../integration/errors';
import type {SessionRuntime} from '../integration/session';
import {BootstrapContext, ApiContext, ApplicationControlsContext, NoticeRefreshContext} from './context';
import {PasswordReminder} from './components/PasswordReminder';
import {AccountAvatar} from './components/AccountAvatar';
import {EnterpriseShell} from './components/EnterpriseShell';
import {NavigationBreadcrumbs, NavigationSearch} from './components/NavigationTools';
import {routes} from './routes';
import {PageWorkspace} from './components/PageWorkspace';
import {toEForgePermissions} from '../integration/permissions';
const HeaderNotices = lazy(() => import('../features/notices/HeaderNotices').then(module => ({default: module.HeaderNotices})));

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
export function Application({runtime, router}: {runtime: SessionRuntime; router: AppRouterAdapter}) {
  const session = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const href = useSyncExternalStore(router.subscribe, router.getCurrentHref);
  const [screenLock,setScreenLock]=useState<ScreenLock|null>(readScreenLock);
  const lockGeneration=useRef(0);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [noticeVersion, setNoticeVersion] = useState(0);
  const invalidateNotices = useCallback(() => setNoticeVersion(value => value + 1), []);
  const pathname = new URL(href, 'http://eforge.local').pathname;
  useEffect(()=>{if(session.phase==='authenticated' && pathname==='/login')router.navigate('/dashboard',{replace:true});},[session.phase,pathname,router]);
  useEffect(()=>{if(session.phase==='signed-out'){saveScreenLock(null);setScreenLock(null);lockGeneration.current++;}},[session.phase]);
  const bootstrap = session.phase === 'authenticated' ? session.bootstrap : null;
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
  if (session.phase === 'signed-out') return pathname==='/register' ? <RegistrationPage runtime={runtime} onLogin={()=>router.navigate('/login')} /> : <LoginPage runtime={runtime} onRegister={()=>router.navigate('/register')} />;
  if (session.phase === 'restoring') return <main className="state-page" role="status"><h1>正在连接工作空间…</h1></main>;
  if (session.phase === 'error') return <main className="state-page"><h1>暂时无法连接工作空间</h1>
    <p role="alert">{session.message}</p><div className="state-actions">
      <Button label="重试" onClick={() => { void runtime.restore(); }} />
      <Button label="返回登录" variant="ghost" onClick={runtime.forget} /></div></main>;
  const snapshot = session.bootstrap;
  const ownedLock=lockBelongsTo(screenLock,snapshot.user)?screenLock:null;
  const locked=!!ownedLock || pathname==='/lock';
  const contentHref=locked?(ownedLock?.returnHref??'/dashboard'):href;
  const contentPathname=new URL(contentHref,'http://eforge.local').pathname;
  function lockScreen(){const value={ownerId:snapshot.user.id,username:snapshot.user.username,returnHref:safeLockReturn(href)};lockGeneration.current++;saveScreenLock(value);setScreenLock(value);router.navigate('/lock',{replace:true});}
  async function unlockScreen(password:string){const generation=lockGeneration.current;const actor=snapshot.user;await runtime.api.unlockScreen({password});const current=runtime.getSnapshot();if(generation!==lockGeneration.current || current.phase!=='authenticated' || current.bootstrap.user.id!==actor.id || current.bootstrap.user.username!==actor.username)return;await runtime.refresh();const refreshed=runtime.getSnapshot();if(generation!==lockGeneration.current || refreshed.phase!=='authenticated' || refreshed.bootstrap.user.id!==actor.id || refreshed.bootstrap.user.username!==actor.username)return;lockGeneration.current++;saveScreenLock(null);setScreenLock(null);router.navigate(ownedLock?.returnHref??'/dashboard',{replace:true});}
  const match = matchAppRoute(routes, contentPathname === '/' ? '/dashboard' : contentPathname);
  const allowed = match && canAccessRoute(match.route, permissions);

  return <ApiContext.Provider value={runtime.api}><BootstrapContext.Provider value={snapshot}><ApplicationControlsContext.Provider value={{navigate: path => router.navigate(path), refresh: runtime.refresh}}><NoticeRefreshContext.Provider value={invalidateNotices}><PermissionProvider permissions={permissions}>
    {locked?<ScreenLockPage key={snapshot.user.id+snapshot.user.username} user={snapshot.user} unlock={unlockScreen} logout={logout} logoutBusy={logoutBusy} logoutError={logoutError}/>:null}<Activity mode={locked?'hidden':'visible'}><PasswordReminder key={snapshot.user.id+snapshot.user.username+JSON.stringify(snapshot.passwordStatus)} status={snapshot.passwordStatus}/><EnterpriseShell activePaths={match ? getRouteAncestry(routes,match.route.id).map(route => route.path) : []} items={navigation} pathname={contentPathname === '/' ? '/dashboard' : contentPathname} href={contentHref} ownerId={snapshot.user.id} router={router} brand={<a aria-label="EForge Enterprise" className="enterprise-brand" href="/dashboard" onClick={event => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault(); router.navigate('/dashboard');
      }
    }}><span className="brand-mark">E</span><span>EForge<span className="brand-subtitle">Enterprise</span></span></a>}
      header={menuButton => <div className="enterprise-header">{menuButton}<span>企业工作空间</span><div><NavigationSearch items={navigation} router={router} /><span className="account-name">{snapshot.user.displayName}</span>
        <Suspense fallback={null}><HeaderNotices version={noticeVersion} /></Suspense>
        <a className="header-account-link" aria-label="个人中心" href="/user/profile" onClick={event => { if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); router.navigate('/user/profile'); } }}><AccountAvatar key={snapshot.user.id+snapshot.user.avatarUrl} user={snapshot.user}/>个人中心</a>
        <Button label="锁定屏幕" variant="ghost" size="sm" isDisabled={logoutBusy} onClick={lockScreen}/>
        <Button label={logoutBusy ? '正在退出…' : '退出登录'} variant="ghost" size="sm" isDisabled={logoutBusy} onClick={() => { void logout(); }} /></div></div>}>
      {match && allowed ? <NavigationBreadcrumbs items={navigation} routes={routes} match={match} router={router} /> : null}
      {logoutError ? <p role="alert">{logoutError}</p> : null}
      <PageWorkspace key={JSON.stringify([snapshot.user.id,snapshot.user.username,snapshot.roles,snapshot.permissions,snapshot.navigation])} ownerId={snapshot.user.id} href={contentHref} items={navigation} permissions={permissions} router={router}
        fallback={<StatePage code={match?'403':'404'} router={router} />} />
    </EnterpriseShell></Activity>
  </PermissionProvider></NoticeRefreshContext.Provider></ApplicationControlsContext.Provider></BootstrapContext.Provider></ApiContext.Provider>;
}
