// @vitest-environment jsdom
import {expect, it} from 'vitest';
import type {PieSeriesOption, GaugeSeriesOption} from 'echarts/charts';
import type {CacheStatistics} from '../../generated/api';
import {cacheChartOptions, commandTooltip, commandTotal, commandShare} from '../../features/cache-monitor/chart-options';
it('explicit keyboard selection survives a neighboring segment replay and releases back to pointer selection', () => {
  const data: CacheStatistics = {info:{},keyCount:'0',commands:[{name:'selected',calls:'2'},{name:'neighbor',calls:'1'}]};
  let selected: number | null = 0;
  const options = cacheChartOptions(data, () => selected);
  const tooltip = options.commands.tooltip as {formatter: (value:{dataIndex:number}) => HTMLElement};
  expect(tooltip.formatter({dataIndex:1}).textContent).toBe('命令 selected：2 次（66.66%）');
  selected = null;
  expect(tooltip.formatter({dataIndex:1}).textContent).toBe('命令 neighbor：1 次（33.33%）');
});
it('rose shapes preserve proportions without losing displayed counters beyond the JS integer range', () => {
  const data: CacheStatistics = {info: {usedMemory: '2G', usedMemoryBytes: '2147483648'}, keyCount: '9007199254740993', commands: [{name: 'get', calls: '9007199254740993'}, {name: 'set', calls: '9007199254740993'}]};
  const before = structuredClone(data), options = cacheChartOptions(data), pie = (options.commands.series as PieSeriesOption[])[0]!;
  expect(pie.roseType).toBe('radius'); expect(pie.data).toEqual([{name: 'get', value: 500000000}, {name: 'set', value: 500000000}]);
  expect(commandTotal(data)).toBe(18014398509481986n); expect(commandShare(data.commands[0]!.calls, commandTotal(data))).toBe('50.00'); expect(commandTooltip(data, 0).textContent).toContain('9007199254740993 次（50.00%）');
  const gauge = (options.memory.series as GaugeSeriesOption[])[0]!; expect(gauge.max).toBeGreaterThanOrEqual(2048); expect(gauge.data).toEqual([{name: '内存消耗', value: 2048}]); expect(data).toEqual(before);
});
it('chart tooltips are inert DOM text, including command markup', () => {
  const name = '<img src=x onerror="alert(1)">', data: CacheStatistics = {info: {}, keyCount: '0', commands: [{name, calls: '7'}]};
  const tooltip = commandTooltip(data, 0); expect(tooltip.getAttribute('role')).toBe('tooltip'); expect(tooltip.textContent).toContain(name); expect(tooltip.querySelector('img')).toBeNull();
});
it('empty/zero counters and absent byte readings stay finite', () => {
  const data: CacheStatistics = {info: {}, keyCount: '0', commands: [{name: 'get', calls: '0'}]};
  expect(commandShare('0', commandTotal(data))).toBe('0.00'); expect((cacheChartOptions(data).commands.series as PieSeriesOption[])[0]!.data).toEqual([{name: 'get', value: 0}]);
  expect((cacheChartOptions(data).memory.series as GaugeSeriesOption[])[0]!.data).toEqual([{name: '内存消耗', value: 0}]);
});
