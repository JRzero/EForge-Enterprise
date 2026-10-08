import {useEffect,useRef,useState} from 'react';
import {NativeButton, Table} from './native';
import {Button} from './controls';
import * as echarts from 'echarts/core';
import {LineChart,PieChart,RadarChart,BarChart} from 'echarts/charts';
import {TooltipComponent,LegendComponent,GridComponent,RadarComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';

echarts.use([LineChart,PieChart,RadarChart,BarChart,TooltipComponent,LegendComponent,GridComponent,RadarComponent,SVGRenderer]);
export interface ChartCardSpec {title:string;label:string;legend:readonly string[];headers:readonly string[];rows:readonly (readonly (string|number)[])[];option:echarts.EChartsCoreOption}
export function ChartCard({spec}:{spec:ChartCardSpec}){
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
  return <section className="demo-chart-card"><h3>{spec.title}</h3><div className="dashboard-demo-chart chart-surface" ref={element} role="img" aria-label={spec.label}/>
    {failed && <div><p role="alert">图表暂时无法显示，数据仍可查看。</p><Button label={'重试'+spec.title+'图表'} onClick={()=>setRetry(value=>value+1)}/></div>}
    <div className="demo-chart-legends" role="group" aria-label={spec.title+'图例'}>{spec.legend.map(name=><NativeButton key={name} type="button" aria-pressed={selected[name]!==false} onClick={()=>chart.current?.dispatchAction({type:'legendToggleSelect',name})}>{name}</NativeButton>)}</div>
    <details><summary>查看{spec.title}数据</summary><div className="demo-chart-table"><Table aria-label={spec.title+'演示数据'}><thead><tr>{spec.headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{spec.rows.map((row,index)=><tr key={String(row[0])} tabIndex={0} onFocus={()=>chart.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:index})} onBlur={()=>chart.current?.dispatchAction({type:'hideTip'})}>{row.map((value,column)=><td key={column}>{value}</td>)}</tr>)}</tbody></Table></div></details>
  </section>;
}
