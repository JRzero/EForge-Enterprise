import {useLayoutEffect, useRef, useState, type SyntheticEvent} from 'react';
import {PageHeader} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';

type Target = 'druid' | 'api-docs';
type FrameOwner = {id: number; api: ReturnType<typeof useApi>; target: Target; version: number; entry: string; expiresAt: number; loadDeadline: number; loaded: boolean};
type Operation = {controller: AbortController; ready: boolean};
const definitions = {
  druid: {title: '数据监控', entry: '/druid/login.html'},
  'api-docs': {title: '接口文档', entry: '/swagger-ui/index.html'}
} as const;
const failed = '控制台暂时无法加载，请刷新后重试。';
const expired = '控制台凭据已到期，请刷新后继续。';
function ConsolePage({target}: {target: Target}) {
  const api = useApi(), definition = definitions[target];
  const [version, setVersion] = useState(0), [frame, setFrame] = useState<FrameOwner | null>(null);
  const [loading, setLoading] = useState(true), [disabled, setDisabled] = useState(false), [error, setError] = useState('');
  const expiredOwner = useRef<{api: ReturnType<typeof useApi>; target: Target; version: number} | null>(null);
  const owner = useRef<FrameOwner | null>(null), sequence = useRef(0), active = useRef<Operation | null>(null);
  useLayoutEffect(() => {
    const controller = new AbortController(), operation = {controller, ready: false};
    const timers: ReturnType<typeof setTimeout>[] = []; active.current = operation;
    const prior = owner.current;
    const retained = prior && prior.api === api && prior.target === target && prior.version === version ? prior : null;
    const wasExpired = (!!retained && retained.expiresAt <= performance.now()) || (expiredOwner.current?.api === api && expiredOwner.current.target === target && expiredOwner.current.version === version);
    if (wasExpired) expiredOwner.current = {api, target, version};
    if (!retained || wasExpired) {owner.current = null; setFrame(null);}
    // Hide retained privileged HTML before paint until current grants are checked.
    setLoading(true); setDisabled(false); setError('');
    const status = target === 'druid' ? api.getDruidConsoleStatus : api.getApiDocsConsoleStatus;
    const open = target === 'druid' ? api.openDruidConsole : api.openApiDocsConsole;
    const current = () => !controller.signal.aborted && active.current === operation;
    const fail = (message: string) => {if (current()) {if (message === expired) expiredOwner.current = {api, target, version}; owner.current = null; setFrame(null); setLoading(false); setDisabled(false); setError(message);}};
    const check = async () => {
      const value = await status(controller.signal);
      if (!current()) return false;
      if (!value.enabled) {owner.current = null; setFrame(null); setDisabled(true); setLoading(false); return false;}
      return true;
    };
    const probe = async (retainedTicket = false) => {
      // Cookie-only validation also detects a lost/expired scoped ticket while JWT remains valid.
      const response = await fetch(definition.entry, {credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])});
      const rejectedTicket = retainedTicket && (response.status === 401 || response.status === 403);
      const valid = response.ok && response.headers.get('content-type')?.includes('text/html');
      await response.body?.cancel();
      if (rejectedTicket) throw new Error(expired);
      if (!valid) throw new Error(failed);
    };
    const arm = (value: FrameOwner) => {
      timers.push(setTimeout(() => {if (owner.current === value && !value.loaded) fail(failed);}, Math.max(0, value.loadDeadline - performance.now())));
      timers.push(setTimeout(() => {if (owner.current === value) fail(expired);}, Math.max(0, value.expiresAt - performance.now())));
    };
    void (async () => {
      try {
        if (!await check()) return;
        if (wasExpired) {fail(expired); return;}
        if (retained) {
          if (owner.current !== retained) return;
          await probe(true); if (!current() || owner.current !== retained) return;
          if (retained.expiresAt <= performance.now()) {fail(expired); return;}
          if (!retained.loaded && retained.loadDeadline <= performance.now()) {fail(failed); return;}
          operation.ready = true; setLoading(!retained.loaded); arm(retained); return;
        }
        const openedAt = performance.now(), session = await open(controller.signal);
        if (!current()) return;
        if (session.entryPath !== definition.entry || !Number.isFinite(session.expiresInSeconds) || session.expiresInSeconds <= 0 || session.expiresInSeconds > 300) throw new Error(failed);
        // Probe with scoped cookies, never a JWT. iframe load alone cannot prove HTTP success.
        await probe();
        if (!current()) return;
        const expiresAt = openedAt + session.expiresInSeconds * 1000;
        if (expiresAt <= performance.now()) {fail(expired); return;}
        const value: FrameOwner = {id: ++sequence.current, api, target, version, entry: definition.entry, expiresAt, loadDeadline: performance.now() + 15000, loaded: false};
        operation.ready = true; owner.current = value; setFrame(value); arm(value);
      } catch (cause) {if (current()) fail(cause instanceof Error && (cause.message === failed || cause.message === expired) ? cause.message : errorMessage(cause));}
    })();
    const recheck = () => {if (owner.current?.loaded) void check().catch(cause => fail(errorMessage(cause)));};
    const interval = setInterval(() => {if (!document.hidden) recheck();}, 30000);
    window.addEventListener('focus', recheck);
    return () => {if (active.current === operation) active.current = null; controller.abort(); timers.forEach(clearTimeout); clearInterval(interval); window.removeEventListener('focus', recheck);};
  }, [api, target, definition.entry, version]);
  function rejectFrame(value: FrameOwner) {
    if (owner.current !== value) return;
    owner.current = null; setFrame(null); setLoading(false); setError(failed);
  }
  function onLoad(event: SyntheticEvent<HTMLIFrameElement>, value: FrameOwner) {
    if (owner.current !== value) return;
    const doc = event.currentTarget.contentDocument;
    // A revoked/expired ticket can return a JSON problem after the preflight probe.
    if (!doc || !doc.querySelector('html') || (doc.querySelector('pre')?.textContent ?? doc.body?.textContent)?.trim().startsWith('{') || doc.contentType.includes('json')) {rejectFrame(value); return;}
    value.loaded = true;
    // Hidden native loads may finish, but cannot unlock a new grant check.
    if (active.current?.ready && !active.current.controller.signal.aborted) setLoading(false);
  }
  return <section className="console-page" aria-busy={loading}>
    <PageHeader title={definition.title} description={target === 'druid' ? '查看数据源、SQL 与连接池运行情况。' : '查看并调试系统接口。'} />
    <div className="post-toolbar"><Button label="刷新" variant="ghost" isDisabled={loading} onClick={() => setVersion(value => value + 1)} /></div>
    {loading && <p role="status">正在加载控制台，请稍候！</p>}
    {disabled && <p role="status">该控制台尚未启用，请联系管理员。</p>}
    {error && <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></>}
    {frame && <iframe key={`${target}-${frame.id}`} src={frame.entry} title={definition.title} style={{visibility: loading ? 'hidden' : undefined}} onLoad={event => onLoad(event, frame)} onError={() => rejectFrame(frame)}
      referrerPolicy="same-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox" />}
  </section>;
}
export function DruidConsolePage() {return <ConsolePage target="druid" />;}
export function ApiDocsConsolePage() {return <ConsolePage target="api-docs" />;}
