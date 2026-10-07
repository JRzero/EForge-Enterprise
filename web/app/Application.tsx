import {lazy, Suspense, useCallback, useMemo, useState, useSyncExternalStore} from 'react';
import {AppShell, PermissionProvider} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import {matchAppRoute, canAccessRoute, type AppRouterAdapter} from '@eforge/app';
import {LoginPage} from '../features/auth/LoginPage';
import {projectNavigation} from '../integration/navigation';
import {errorMessage} from '../integration/errors';
import type {SessionRuntime} from '../integration/session';
import {BootstrapContext, ApiContext, ApplicationControlsContext, NoticeRefreshContext} from './context';
import {Navigation} from './Navigation';
import {NavigationBreadcrumbs, NavigationSearch} from './components/NavigationTools';
import {routes} from './routes';
import {PageWorkspace} from './components/PageWorkspace';
import {toEForgePermissions} from '../integration/permissions';
const HeaderNotices = lazy(() => import('../features/notices/HeaderNotices').then(module => ({default: module.HeaderNotices})));

function StatePage({code, router}: {code: '403' | '404'; router: AppRouterAdapter}) {
  return <section className="state-page"><span className="eyebrow">{code}</span>
    <h1>{code === '403' ? '暂无访问权限' : '页面不存在'}</h1>
    <p>{code === '403' ? '如需访问，请联系企业管理员。' : '请检查地址，或返回工作台继续。'}</p>
    <Button label="返回工作台" onClick={() => router.navigate('/dashboard')} /></section>;
}
export function Application({runtime, router}: {runtime: SessionRuntime; router: AppRouterAdapter}) {
  const session = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const href = useSyncExternalStore(router.subscribe, router.getCurrentHref);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [noticeVersion, setNoticeVersion] = useState(0);
  const invalidateNotices = useCallback(() => setNoticeVersion(value => value + 1), []);
  const pathname = new URL(href, 'http://eforge.local').pathname;
  const bootstrap = session.phase === 'authenticated' ? session.bootstrap : null;
  const navigation = useMemo(() => bootstrap ? projectNavigation(bootstrap.navigation, routes, bootstrap.permissions) : [], [bootstrap]);
  const permissions = useMemo(() => bootstrap ? toEForgePermissions(bootstrap.permissions) : [], [bootstrap]);
  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true); setLogoutError('');
    try { await runtime.logout(); router.navigate('/dashboard', {replace: true}); }
    catch (error) { setLogoutError(errorMessage(error)); }
    finally { setLogoutBusy(false); }
  }
  if (session.phase === 'signed-out') return <LoginPage runtime={runtime} />;
  if (session.phase === 'restoring') return <main className="state-page" role="status"><h1>正在连接工作空间…</h1></main>;
  if (session.phase === 'error') return <main className="state-page"><h1>暂时无法连接工作空间</h1>
    <p role="alert">{session.message}</p><div className="state-actions">
      <Button label="重试" onClick={() => { void runtime.restore(); }} />
      <Button label="返回登录" variant="ghost" onClick={runtime.forget} /></div></main>;
  const snapshot = session.bootstrap;
  const match = matchAppRoute(routes, pathname === '/' ? '/dashboard' : pathname);
  const allowed = match && canAccessRoute(match.route, permissions);

  return <ApiContext.Provider value={runtime.api}><BootstrapContext.Provider value={snapshot}><ApplicationControlsContext.Provider value={{navigate: path => router.navigate(path), refresh: runtime.refresh}}><NoticeRefreshContext.Provider value={invalidateNotices}><PermissionProvider permissions={permissions}>
    <AppShell brand={<a className="enterprise-brand" href="/dashboard" onClick={event => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault(); router.navigate('/dashboard');
      }
    }}><span className="brand-mark">E</span><span>EForge<span className="brand-subtitle">Enterprise</span></span></a>}
      navigation={<Navigation items={navigation} pathname={pathname === '/' ? '/dashboard' : pathname} router={router} />}
      header={<div className="enterprise-header"><span>企业工作空间</span><div><NavigationSearch items={navigation} router={router} /><span className="account-name">{snapshot.user.displayName}</span>
        <Suspense fallback={null}><HeaderNotices version={noticeVersion} /></Suspense>
        <a href="/user/profile" onClick={event => { if (!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); router.navigate('/user/profile'); } }}>个人中心</a>
        <Button label={logoutBusy ? '正在退出…' : '退出登录'} variant="ghost" size="sm" isDisabled={logoutBusy} onClick={() => { void logout(); }} /></div></div>}>
      {match && allowed ? <NavigationBreadcrumbs items={navigation} routes={routes} match={match} router={router} /> : null}
      {logoutError ? <p role="alert">{logoutError}</p> : null}
      <PageWorkspace key={JSON.stringify([snapshot.user.id,snapshot.user.username,snapshot.roles,snapshot.permissions,snapshot.navigation])} ownerId={snapshot.user.id} href={href} items={navigation} permissions={permissions} router={router}
        fallback={<StatePage code={match?'403':'404'} router={router} />} />
    </AppShell>
  </PermissionProvider></NoticeRefreshContext.Provider></ApplicationControlsContext.Provider></BootstrapContext.Provider></ApiContext.Provider>;
}
