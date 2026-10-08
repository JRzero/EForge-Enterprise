import type {ComposeOption} from 'echarts/core';
import type {PieSeriesOption, GaugeSeriesOption} from 'echarts/charts';
import type {TooltipComponentOption} from 'echarts/components';
import type {CacheStatistics} from '../../generated/api';
export type CacheChartOption = ComposeOption<PieSeriesOption | GaugeSeriesOption | TooltipComponentOption>;
const integer = (value: string | undefined) => value && /^\d+$/.test(value) ? BigInt(value) : 0n;
export function commandShare(calls: string, total: bigint) {return total === 0n ? '0.00' : (Number(integer(calls) * 10000n / total) / 100).toFixed(2);}
export function commandTotal(data: CacheStatistics) {return data.commands.reduce((sum, command) => sum + integer(command.calls), 0n);}
export function commandTooltip(data: CacheStatistics, index: number) {
  const command = data.commands[index], total = commandTotal(data);
  const element = document.createElement('div'); element.className = 'cache-chart-tooltip'; element.setAttribute('role', 'tooltip');
  element.textContent = command ? `命令 ${command.name}：${command.calls} 次（${commandShare(command.calls, total)}%）` : '暂无命令统计'; return element;
}
export function cacheChartOptions(data: CacheStatistics, selectedCommand?: () => number | null): {commands: CacheChartOption; memory: CacheChartOption} {
  const total = commandTotal(data), bytes = integer(data.info.usedMemoryBytes);
  const memoryMiB = Number(bytes / 1048576n) + Number(bytes % 1048576n) / 1048576;
  const memoryMax = Math.max(1000, Math.ceil(memoryMiB / 1000) * 1000);
  return {
    commands: {animationDuration: 1000, tooltip: {trigger: 'item', confine: true, transitionDuration: 0, extraCssText: 'max-width: calc(100% - 24px); white-space: normal; overflow-wrap: anywhere;', formatter: params => {
      const item = Array.isArray(params) ? params[0] : params;
      return commandTooltip(data, selectedCommand?.() ?? item?.dataIndex ?? -1);
    }}, series: [{name: '命令', type: 'pie', roseType: 'radius', stillShowZeroSum: false, radius: [15, 95], center: ['50%', '38%'],
      // Shapes use bounded proportions; the labels/tooltip retain the exact decimal counters.
      data: data.commands.map(command => ({name: command.name, value: total === 0n ? 0 : Number(integer(command.calls) * 1000000000n / total)}))}]},
    memory: {tooltip: {confine: true, transitionDuration: 0, extraCssText: 'max-width: calc(100% - 24px); white-space: normal; overflow-wrap: anywhere;', formatter: () => {const element = document.createElement('div'); element.className = 'cache-chart-tooltip'; element.setAttribute('role', 'tooltip'); element.textContent = `内存消耗：${data.info.usedMemory ?? '—'}`; return element;}},
      series: [{name: '使用内存', type: 'gauge', min: 0, max: memoryMax, detail: {formatter: () => data.info.usedMemory ?? '—', fontSize: 22}, data: [{value: memoryMiB, name: '内存消耗'}]}]}
  };
}
