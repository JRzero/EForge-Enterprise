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
  const selectedCommand = useRef<number | null>(null);
  const [error, setError] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    const first = commands.current, second = memory.current; if (!first || !second) return;
    const instances: echarts.EChartsType[] = [];
    const activeTips = new Map<echarts.EChartsType, {seriesIndex: number; dataIndex: number}>();
    const rememberTip = (instance: echarts.EChartsType) => {
      instance.on('showTip', (event: unknown) => {
        if (event && typeof event === 'object' && 'seriesIndex' in event && 'dataIndex' in event &&
            typeof event.seriesIndex === 'number' && typeof event.dataIndex === 'number') {
          activeTips.set(instance, {seriesIndex: event.seriesIndex, dataIndex: event.dataIndex});
        }
      });
      instance.on('hideTip', () => {activeTips.delete(instance);});
    };
    const observer = new ResizeObserver(() => instances.forEach(instance => {
      if (instance.isDisposed()) return;
      const tip = activeTips.get(instance);
      instance.resize();
      // ECharts queues tooltip refresh; restore the current value in this resize turn.
      if (tip) instance.dispatchAction({type: 'showTip', ...tip});
    }));
    try {
      selectedCommand.current = null;
      setError(false); const options = cacheChartOptions(data, () => selectedCommand.current);
      const pie = echarts.init(first, undefined, {renderer: 'svg'}); instances.push(pie); chart.current = pie; rememberTip(pie); pie.setOption(options.commands);
      const gauge = echarts.init(second, undefined, {renderer: 'svg'}); instances.push(gauge); rememberTip(gauge); gauge.setOption(options.memory);
      observer.observe(first); observer.observe(second);
    } catch {setError(true);}
    return () => {observer.disconnect(); chart.current = null; instances.forEach(instance => instance.dispose());};
  }, [data, version]);
  const total = commandTotal(data);
  const show = (index: number) => {
    const instance = chart.current; if (!instance) return;
    selectedCommand.current = index;
    // Keyboard/list selection owns the tooltip. Automatic coordinate replay can
    // hit an adjacent tiny rose segment after a resize instead of this data index.
    instance.setOption({tooltip: {triggerOn: 'none'}});
    instance.dispatchAction({type: 'showTip', seriesIndex: 0, dataIndex: index});
  };
  const hide = () => {
    selectedCommand.current = null;
    chart.current?.dispatchAction({type: 'hideTip'});
    chart.current?.setOption({tooltip: {triggerOn: 'mousemove|click'}});
  };
  return <div className="server-monitor-grid cache-charts">
    <section className="server-card" aria-labelledby="cache-commands-title"><h2 id="cache-commands-title">命令统计</h2>
      <div ref={commands} className="cache-chart" role="img" aria-label="Redis 命令统计玫瑰图" />
      {data.commands.length === 0 ? <p>暂无命令统计</p> : <ul className="cache-command-list">{data.commands.map((command, index) => <li key={command.name}><button type="button" onFocus={() => show(index)} onMouseEnter={() => show(index)} onClick={() => show(index)} onMouseLeave={event => {if (document.activeElement !== event.currentTarget) hide();}} onBlur={hide}>{command.name}：{command.calls} 次（{commandShare(command.calls, total)}%）</button></li>)}</ul>}
    </section>
    <section className="server-card" aria-labelledby="cache-memory-title"><h2 id="cache-memory-title">内存信息</h2><div ref={memory} className="cache-chart" role="img" aria-label="Redis 内存消耗仪表图" /><p>使用内存：{data.info.usedMemory ?? '—'}；仪表刻度单位：MiB</p></section>
    {error && <div><p role="alert">图表暂时无法显示，请重试。</p><Button label="重试图表" onClick={() => setVersion(value => value + 1)} /></div>}
  </div>;
}
