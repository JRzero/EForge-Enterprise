import {useEffect, useSyncExternalStore} from 'react';
import {Button} from '@eforge/ui';
import type {AppRouterAdapter} from '@eforge/app';
import {saveScreenLock} from '../features/auth/screen-lock';
import type {SessionRuntime} from '../integration/session';
import {DeferredFeature} from './components/DeferredFeature';

const loadWorkspace = () => import('./AuthenticatedApplication').then(module => ({default: module.AuthenticatedApplication}));
const loadLogin = () => import('../features/auth/LoginPage').then(module => ({default: module.LoginPage}));
const loadRegistration = () => import('../features/auth/RegistrationPage').then(module => ({default: module.RegistrationPage}));

function loading(title: string) {
  return <main className="state-page" role="status"><h1>正在加载{title}…</h1></main>;
}
function loadError(title: string, retry: () => void) {
  return <main className="state-page" role="alert"><h1>{title}暂时无法打开</h1>
    <p>页面资源未能加载，请重试。如果仍然失败，请重新加载应用以获取最新页面。</p>
    <div className="state-actions"><Button label="重试加载" onClick={retry} />
      <Button label="重新加载应用" variant="secondary" onClick={() => window.location.reload()} /></div></main>;
}

export function Application({runtime, router}: {runtime: SessionRuntime; router: AppRouterAdapter}) {
  const session = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const href = useSyncExternalStore(router.subscribe, router.getCurrentHref);
  const pathname = new URL(href, 'http://eforge.local').pathname;
  useEffect(() => {if (session.phase === 'signed-out') saveScreenLock(null);}, [session.phase]);
  if (session.phase === 'signed-out') return pathname === '/register'
    ? <DeferredFeature key="registration" load={loadRegistration} componentProps={{runtime, onLogin: () => router.navigate('/login')}} fallback={loading('注册页面')} errorFallback={retry => loadError('注册页面', retry)} />
    : <DeferredFeature key="login" load={loadLogin} componentProps={{runtime, onRegister: () => router.navigate('/register')}} fallback={loading('登录页面')} errorFallback={retry => loadError('登录页面', retry)} />;
  if (session.phase === 'restoring') return <main className="state-page" role="status"><h1>正在连接工作空间…</h1></main>;
  if (session.phase === 'error') return <main className="state-page"><h1>暂时无法连接工作空间</h1>
    <p role="alert">{session.message}</p><div className="state-actions">
      <Button label="重试" onClick={() => { void runtime.restore(); }} />
      <Button label="返回登录" variant="ghost" onClick={runtime.forget} /></div></main>;
  return <DeferredFeature key="workspace" load={loadWorkspace} componentProps={{runtime, router, bootstrap: session.bootstrap, href}} fallback={loading('工作空间')} errorFallback={retry => loadError('工作空间', retry)} />;
}
