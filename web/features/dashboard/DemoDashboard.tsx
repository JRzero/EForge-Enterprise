import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@eforge/ui';
import * as echarts from 'echarts/core';
import {LineChart,PieChart,RadarChart,BarChart} from 'echarts/charts';
import {TooltipComponent,LegendComponent,GridComponent,RadarComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {metrics,lineSpec,otherCharts,type ChartSpec} from './demo-charts';
echarts.use([LineChart,PieChart,RadarChart,BarChart,TooltipComponent,LegendComponent,GridComponent,RadarComponent,SVGRenderer]);
function CountUp({total,duration}:{total:number;duration:number}){
  const [display,setDisplay]=useState(0);
  useEffect(()=>{let frame=0;const start=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const update=(time:number)=>{const progress=reduced?1:Math.min(1,(time-start)/duration);setDisplay(Math.round(total*progress));if(progress<1)frame=requestAnimationFrame(update);};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);},[total,duration]);
  return <strong><span aria-hidden="true">{display.toLocaleString('zh-CN')}</span><span className="dashboard-visually-hidden">{total.toLocaleString('zh-CN')}</span></strong>;
}
function DemoChart({spec}:{spec:ChartSpec}){
  const element=useRef<HTMLDivElement>(null),chart=useRef<echarts.EChartsType|null>(null);
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[selected,setSelected]=useState<Record<string,boolean>>({});
  useEffect(()=>{
    const target=element.current;if(!target)return;
    let owned:echarts.EChartsType|null=null;
    let observer:ResizeObserver|null=null;
    try{observer=new ResizeObserver(()=>{if(owned && !owned.isDisposed() && target.clientWidth>0)owned.resize();});owned=echarts.init(target,undefined,{renderer:'svg'});chart.current=owned;setFailed(false);owned.on('legendselectchanged',(event:unknown)=>{if(event && typeof event==='object' && 'selected' in event && event.selected && typeof event.selected==='object')setSelected(event.selected as Record<string,boolean>);});observer.observe(target);}catch{setFailed(true);}
    return()=>{observer?.disconnect();chart.current=null;owned?.dispose();};
  },[retry]);
  useEffect(()=>{try{chart.current?.setOption({...spec.option,animation:!matchMedia('(prefers-reduced-motion: reduce)').matches});}catch{setFailed(true);}},[spec,retry]);
  return <section className="demo-chart-card"><h3>{spec.title}</h3><div className="dashboard-demo-chart" ref={element} role="img" aria-label={spec.label}/>
    {failed && <div><p role="alert">图表暂时无法显示，数据仍可查看。</p><Button label={'重试'+spec.title+'图表'} onClick={()=>setRetry(value=>value+1)}/></div>}
    <div className="demo-chart-legends" role="group" aria-label={spec.title+'图例'}>{spec.legend.map(name=><button key={name} type="button" aria-pressed={selected[name]!==false} onClick={()=>chart.current?.dispatchAction({type:'legendToggleSelect',name})}>{name}</button>)}</div>
    <details><summary>查看{spec.title}数据</summary><div className="demo-chart-table"><table aria-label={spec.title+'演示数据'}><thead><tr>{spec.headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{spec.rows.map((row,index)=><tr key={String(row[0])} tabIndex={0} onFocus={()=>chart.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:index})} onBlur={()=>chart.current?.dispatchAction({type:'hideTip'})}>{row.map((value,column)=><td key={column}>{value}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}
export function DemoDashboard(){
  const [active,setActive]=useState<(typeof metrics)[number]>(metrics[0]);
  const line=useMemo(()=>lineSpec(active),[active]);
  return <section className="demo-dashboard" aria-label="图表演示工作台"><p className="muted">演示数据用于展示图表交互，不代表当前企业的实际业务统计。</p>
    <div className="demo-dashboard-metrics">{metrics.map(metric=><button key={metric.key} type="button" aria-pressed={active.key===metric.key} onClick={()=>setActive(metric)} aria-label={metric.label+'：'+metric.total.toLocaleString('zh-CN')+'，查看趋势'}><span>{metric.label}</span><CountUp total={metric.total} duration={metric.duration}/></button>)}</div>
    <DemoChart spec={line}/><div className="demo-dashboard-grid">{otherCharts.map(spec=><DemoChart key={spec.title} spec={spec}/>)}</div>
  </section>;
}
