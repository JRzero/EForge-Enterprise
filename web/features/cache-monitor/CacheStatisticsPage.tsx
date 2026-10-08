import {ListToolbar} from '../../app/components/ListPage';
import {lazy, Suspense, useEffect, useState} from 'react';
import {PageHeader} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import type {CacheStatistics} from '../../generated/api';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {useRetainedRead} from '../../app/useRetainedRead';
const CacheCharts = lazy(() => import('./CacheCharts').then(module => ({default: module.CacheCharts})));
export function CacheStatisticsPage() {
  const api = useApi(); const [data, setData] = useState<CacheStatistics | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const read = useRetainedRead();
  useEffect(() => {
    const complete = read([api, version]); if (!complete) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    api.getCacheStatistics(controller.signal).then(result => {if (!controller.signal.aborted) {setData(result); setLoading(false); complete();}})
      .catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false); complete();}});
    return () => controller.abort();
  }, [api, version, read]);
  const cpu = Number(data?.info.userChildrenCpuSeconds);
  const entries = data ? [
    ['Redis 版本', data.info.version], ['运行模式', data.info.mode ? (data.info.mode === 'standalone' ? '单机' : '集群') : '—'], ['端口', data.info.port], ['客户端数', data.info.connectedClients],
    ['运行时间（天）', data.info.uptimeDays], ['使用内存', data.info.usedMemory], ['使用 CPU', Number.isFinite(cpu) ? cpu.toFixed(2) : '—'], ['内存配置', data.info.maxMemory],
    ['AOF 是否开启', data.info.aofEnabled === undefined ? '—' : (data.info.aofEnabled === '0' ? '否' : '是')], ['RDB 是否成功', data.info.rdbLastSaveStatus], ['Key 数量', data.keyCount],
    ['网络入口/出口', `${data.info.inputKbps ?? '—'} kps / ${data.info.outputKbps ?? '—'} kps`]
  ] : [];
  return <section className="cache-statistics-page" aria-busy={loading}><PageHeader title="缓存监控" description="查看 Redis 运行状态、命令统计和内存消耗。" />
    <ListToolbar ><Button label="刷新" variant="ghost" isDisabled={loading} onClick={() => setVersion(value => value + 1)} /></ListToolbar>
    {loading && <p role="status">正在加载缓存监控数据，请稍候！</p>}
    {error && <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></>}
    {data && <><section className="server-card" aria-labelledby="cache-info-title"><h2 id="cache-info-title">基本信息</h2><dl className="server-details cache-info">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl></section>
      <Suspense fallback={<p role="status">正在加载图表…</p>}><CacheCharts data={data} /></Suspense></>}
  </section>;
}
