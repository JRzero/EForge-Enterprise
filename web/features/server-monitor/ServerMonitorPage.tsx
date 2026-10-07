import {useEffect, useState, type ReactNode} from 'react';
import {DataTable, type ColumnDef} from '@eforge/data';
import {PageHeader} from '@eforge/patterns';
import {Button} from '@eforge/ui';
import type {DiskMetrics, ServerMonitorResponse} from '../../generated/api';
import {useApi} from '../../app/context';
import {errorMessage} from '../../integration/errors';
import {useRetainedRead} from '../../app/useRetainedRead';

const number = (value: number | undefined, unit = '') => value == null ? '—' : `${value}${unit}`;
const diskColumns: ColumnDef<DiskMetrics>[] = [
  {accessorKey: 'mount', header: '盘符路径'}, {accessorKey: 'fileSystem', header: '文件系统'},
  {accessorKey: 'type', header: '盘符类型'}, {accessorKey: 'totalSize', header: '总大小'},
  {accessorKey: 'freeSize', header: '可用大小'}, {accessorKey: 'usedSize', header: '已用大小'},
  {accessorKey: 'usagePercent', header: '已用百分比', cell: ({row}) => <span className={(row.original.usagePercent ?? 0) > 80 ? 'server-high-usage' : undefined} title={(row.original.usagePercent ?? 0) > 80 ? '磁盘使用率超过 80%' : undefined}>{number(row.original.usagePercent, '%')}</span>}
];
function Details({entries}: {entries: [string, ReactNode][]}) {
  return <dl className="server-details">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>;
}
export function ServerMonitorPage() {
  const api = useApi();
  const [data, setData] = useState<ServerMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const read = useRetainedRead();
  useEffect(() => {
    const complete = read([api, version]); if (!complete) return;
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    api.getServerMonitor(controller.signal).then(result => {
      if (!controller.signal.aborted) {setData(result); setLoading(false); complete();}
    }).catch(cause => {if (!controller.signal.aborted) {setError(errorMessage(cause)); setLoading(false); complete();}});
    return () => controller.abort();
  }, [api, version, read]);
  return <section className="server-monitor-page" aria-busy={loading}>
    <PageHeader title="服务器监控" description="查看服务器资源及 Java 运行环境。" />
    <div className="post-toolbar"><Button label="刷新" variant="ghost" isDisabled={loading} onClick={() => setVersion(value => value + 1)} />
      {data && <span>采集时间：<time dateTime={data.sampledAt}>{new Date(data.sampledAt).toLocaleString('zh-CN')}</time></span>}
    </div>
    {loading && <p role="status">正在加载服务监控数据，请稍候！</p>}
    {error && <><p role="alert">{error}</p><Button label="重试" onClick={() => setVersion(value => value + 1)} /></>}
    {data && <>
      <div className="server-monitor-grid">
        <section className="server-card" aria-labelledby="server-cpu-title"><h2 id="server-cpu-title">CPU</h2><Details entries={[
          ['核心数', number(data.cpu.coreCount)], ['用户使用率', number(data.cpu.userPercent, '%')],
          ['系统使用率', number(data.cpu.systemPercent, '%')], ['当前空闲率', number(data.cpu.idlePercent, '%')],
          ['等待率', number(data.cpu.waitPercent, '%')]
        ]} /></section>
        <section className="server-card" aria-labelledby="server-memory-title"><h2 id="server-memory-title">内存</h2>
          <div className="server-table"><table><caption>物理内存与 JVM 内存</caption><thead><tr><th scope="col">属性</th><th scope="col">物理内存 (GiB)</th><th scope="col">JVM (MiB)</th></tr></thead><tbody>
            <tr><th scope="row">总内存</th><td>{number(data.memory.totalGiB)}</td><td>{number(data.jvm.totalMiB)}</td></tr>
            <tr><th scope="row">已用内存</th><td>{number(data.memory.usedGiB)}</td><td>{number(data.jvm.usedMiB)}</td></tr>
            <tr><th scope="row">剩余内存</th><td>{number(data.memory.freeGiB)}</td><td>{number(data.jvm.freeMiB)}</td></tr>
            <tr><th scope="row">使用率</th><td className={(data.memory.usagePercent ?? 0) > 80 ? 'server-high-usage' : undefined}>{number(data.memory.usagePercent, '%')}</td><td className={(data.jvm.usagePercent ?? 0) > 80 ? 'server-high-usage' : undefined}>{number(data.jvm.usagePercent, '%')}</td></tr>
          </tbody></table></div>
          {(data.memory.usagePercent ?? 0) > 80 && <p role="status" className="server-high-usage">物理内存使用率超过 80%，请关注资源占用。</p>}
          {(data.jvm.usagePercent ?? 0) > 80 && <p role="status" className="server-high-usage">JVM 内存使用率超过 80%，请关注资源占用。</p>}
        </section>
      </div>
      <section className="server-card" aria-labelledby="server-host-title"><h2 id="server-host-title">服务器信息</h2><Details entries={[
        ['服务器名称', data.host.name], ['操作系统', data.host.operatingSystem], ['服务器 IP', data.host.ip], ['系统架构', data.host.architecture]
      ]} /></section>
      <section className="server-card" aria-labelledby="server-jvm-title"><h2 id="server-jvm-title">Java 虚拟机信息</h2><Details entries={[
        ['Java 名称', data.jvm.name], ['Java 版本', data.jvm.version], ['启动时间', data.jvm.startedAt], ['运行时长', data.jvm.uptime],
        ['安装路径', data.jvm.home], ['项目路径', data.host.workingDirectory], ['运行参数', data.jvm.arguments], ['最大内存', number(data.jvm.maxMiB, ' MiB')]
      ]} /></section>
      <section className="server-card" aria-labelledby="server-disk-title"><h2 id="server-disk-title">磁盘状态</h2><div className="post-table"><DataTable columns={diskColumns} data={data.disks} pagination={false} showColumnVisibility={false} emptyText="暂无磁盘信息" /></div></section>
    </>}
  </section>;
}
