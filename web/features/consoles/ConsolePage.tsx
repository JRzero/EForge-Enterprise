import {useEffect, useRef, useState, type SyntheticEvent} from 'react';
import {PageHeader} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';

type Target = 'druid' | 'api-docs';
const definitions = {
  druid: {title: '数据监控', entry: '/druid/login.html'},
  'api-docs': {title: '接口文档', entry: '/swagger-ui/index.html'}
} as const;
const failed = '控制台暂时无法加载，请刷新后重试。';
function ConsolePage({target}: {target: Target}) {
  const api = useApi(), definition = definitions[target];
  const [version, setVersion] = useState(0), [entry, setEntry] = useState('');
  const [loading, setLoading] = useState(true), [disabled, setDisabled] = useState(false), [error, setError] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); const timers: ReturnType<typeof setTimeout>[] = [];
    loaded.current = false; setEntry(''); setLoading(true); setDisabled(false); setError('');
    const status = target === 'druid' ? api.getDruidConsoleStatus : api.getApiDocsConsoleStatus;
    const open = target === 'druid' ? api.openDruidConsole : api.openApiDocsConsole;
    const fail = (message: string) => {if (!controller.signal.aborted) {loaded.current = false; setEntry(''); setLoading(false); setError(message);}};
    const check = async () => {
      try {const value = await status(controller.signal); if (!controller.signal.aborted && !value.enabled) {setEntry(''); setDisabled(true); setLoading(false);}}
      catch (cause) {if (!controller.signal.aborted) fail(errorMessage(cause));}
    };
    void (async () => {
      try {
        const value = await status(controller.signal);
        if (controller.signal.aborted) return;
        if (!value.enabled) {setDisabled(true); setLoading(false); return;}
        const session = await open(controller.signal);
        if (controller.signal.aborted) return;
        if (session.entryPath !== definition.entry || !Number.isFinite(session.expiresInSeconds) || session.expiresInSeconds <= 0 || session.expiresInSeconds > 300) throw new Error(failed);
        // Probe with scoped cookies, never a JWT. iframe load alone cannot prove HTTP success.
        const response = await fetch(definition.entry, {credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])});
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error(failed);
        await response.body?.cancel();
        if (controller.signal.aborted) return;
        setEntry(definition.entry);
        timers.push(setTimeout(() => {if (!loaded.current) fail(failed);}, 15000));
        timers.push(setTimeout(() => fail('控制台凭据已到期，请刷新后继续。'), session.expiresInSeconds * 1000));
      } catch (cause) {if (!controller.signal.aborted) fail(cause instanceof Error && cause.message === failed ? failed : errorMessage(cause));}
    })();
    // Recheck current grants while the console is displayed, including after tab activation.
    const interval = setInterval(() => {if (loaded.current && !document.hidden) void check();}, 30000);
    const focus = () => {if (loaded.current) void check();}; window.addEventListener('focus', focus);
    return () => {controller.abort(); timers.forEach(clearTimeout); clearInterval(interval); window.removeEventListener('focus', focus);};
  }, [api, target, definition.entry, version]);
  function onLoad(event: SyntheticEvent<HTMLIFrameElement>) {
    const doc = event.currentTarget.contentDocument;
    // A revoked/expired ticket can return a JSON problem after the preflight probe.
    if (!doc || !doc.querySelector('html') || (doc.querySelector('pre')?.textContent ?? doc.body?.textContent)?.trim().startsWith('{') || doc.contentType.includes('json')) {
      loaded.current = false; setEntry(''); setLoading(false); setError(failed); return;
    }
    loaded.current = true; setLoading(false);
  }
  return <section className="console-page" aria-busy={loading}>
    <PageHeader title={definition.title} description={target === 'druid' ? '查看数据源、SQL 与连接池运行情况。' : '查看并调试系统接口。'} />
    <div className="post-toolbar"><Button label="刷新" variant="ghost" isDisabled={loading} onClick={() => setVersion(value => value + 1)} /></div>
    {loading && <p role="status">正在加载控制台，请稍候！</p>}
    {disabled && <p role="status">该控制台尚未启用，请联系管理员。</p>}
    {error && <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></>}
    {entry && <iframe key={`${target}-${version}`} src={entry} title={definition.title} onLoad={onLoad} onError={() => {setEntry(''); setLoading(false); setError(failed);}}
      referrerPolicy="same-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox" />}
  </section>;
}
export function DruidConsolePage() {return <ConsolePage target="druid" />;}
export function ApiDocsConsolePage() {return <ConsolePage target="api-docs" />;}
