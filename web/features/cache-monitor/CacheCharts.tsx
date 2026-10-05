import {useEffect, useRef, useState} from 'react';
import * as echarts from 'echarts/core';
import {PieChart, GaugeChart} from 'echarts/charts';
import {TooltipComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {Button} from '@eforge/ui';
import type {CacheStatistics} from '../../generated/api';
import {cacheChartOptions, commandShare, commandTotal} from './chart-options';
echarts.use([PieChart, GaugeChart, TooltipComponent, SVGRenderer]);
export function CacheCharts({data}: {data: CacheStatistics}) {
  const commands = useRef<HTMLDivElement>(null), memory = useRef<HTMLDivElement>(null), chart = useRef<echarts.EChartsType | null>(null);
  const [error, setError] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    const first = commands.current, second = memory.current; if (!first || !second) return;
    const instances: echarts.EChartsType[] = []; const observer = new ResizeObserver(() => instances.forEach(instance => instance.resize()));
    try {
      setError(false); const options = cacheChartOptions(data);
      const pie = echarts.init(first, undefined, {renderer: 'svg'}); instances.push(pie); chart.current = pie; pie.setOption(options.commands);
      const gauge = echarts.init(second, undefined, {renderer: 'svg'}); instances.push(gauge); gauge.setOption(options.memory);
      observer.observe(first); observer.observe(second);
    } catch {setError(true);}
    return () => {observer.disconnect(); chart.current = null; instances.forEach(instance => instance.dispose());};
  }, [data, version]);
  const total = commandTotal(data);
  const show = (index: number) => chart.current?.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: index});
  return <div className="server-monitor-grid cache-charts">
    <section className="server-card" aria-labelledby="cache-commands-title"><h2 id="cache-commands-title">命令统计</h2>
      <div ref={commands} className="cache-chart" role="img" aria-label="Redis 命令统计玫瑰图" />
      {data.commands.length === 0 ? <p>暂无命令统计</p> : <ul className="cache-command-list">{data.commands.map((command, index) => <li key={command.name}><button type="button" onFocus={() => show(index)} onMouseEnter={() => show(index)} onClick={() => show(index)} onBlur={() => chart.current?.dispatchAction({type: 'hideTip'})}>{command.name}：{command.calls} 次（{commandShare(command.calls, total)}%）</button></li>)}</ul>}
    </section>
    <section className="server-card" aria-labelledby="cache-memory-title"><h2 id="cache-memory-title">内存信息</h2><div ref={memory} className="cache-chart" role="img" aria-label="Redis 内存消耗仪表图" /><p>使用内存：{data.info.usedMemory ?? '—'}；仪表刻度单位：MiB</p></section>
    {error && <div><p role="alert">图表暂时无法显示，请重试。</p><Button label="重试图表" onClick={() => setVersion(value => value + 1)} /></div>}
  </div>;
}
