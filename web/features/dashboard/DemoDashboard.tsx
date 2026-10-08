import {ChartCard} from '../../ui/ChartCard';
import {AnimatedNumber} from '../../ui/AnimatedNumber';
import {NativeButton} from '../../ui/native';
import {useMemo,useState} from 'react';
import {metrics,lineSpec,otherCharts} from './demo-charts';
export function DemoDashboard(){
  const [active,setActive]=useState<(typeof metrics)[number]>(metrics[0]);
  const line=useMemo(()=>lineSpec(active),[active]);
  return <section className="demo-dashboard" aria-label="图表演示工作台"><p className="muted">演示数据用于展示图表交互，不代表当前企业的实际业务统计。</p>
    <div className="demo-dashboard-metrics">{metrics.map(metric=><NativeButton key={metric.key} type="button" aria-pressed={active.key===metric.key} onClick={()=>setActive(metric)} aria-label={metric.label+'：'+metric.total.toLocaleString('zh-CN')+'，查看趋势'}><span>{metric.label}</span><AnimatedNumber total={metric.total} duration={metric.duration}/></NativeButton>)}</div>
    <ChartCard spec={line}/><div className="demo-dashboard-grid">{otherCharts.map(spec=><ChartCard key={spec.title} spec={spec}/>)}</div>
  </section>;
}
