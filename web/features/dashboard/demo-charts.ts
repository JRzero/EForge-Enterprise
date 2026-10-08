// Sample data derived from RuoYi-Vue v3.9.2, MIT; immutable reference in parity inventory.
import type {EChartsCoreOption} from 'echarts/core';
export const metrics=[
  {key:'visitors',label:'访客',total:102400,duration:2600,expected:[100,120,161,134,105,160,165],actual:[120,82,91,154,162,140,145]},
  {key:'messages',label:'消息',total:81212,duration:3000,expected:[200,192,120,144,160,130,140],actual:[180,160,151,106,145,150,130]},
  {key:'purchases',label:'金额',total:9280,duration:3200,expected:[80,100,121,104,105,90,100],actual:[120,90,100,138,142,130,130]},
  {key:'orders',label:'订单',total:13600,duration:3600,expected:[130,140,141,142,145,150,160],actual:[120,82,91,154,162,140,130]},
] as const;
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export type ChartSpec={title:string;label:string;legend:readonly string[];headers:readonly string[];rows:readonly (readonly (string|number)[])[];option:EChartsCoreOption};
const tooltip={trigger:'axis',renderMode:'richText',confine:true,transitionDuration:0} as const;
export function lineSpec(metric:typeof metrics[number]):ChartSpec{return {
  title:metric.label+'趋势',label:metric.label+'预期与实际折线图',legend:['expected','actual'],headers:['日期','expected','actual'],rows:days.map((day,index)=>[day,metric.expected[index]!,metric.actual[index]!]),
  option:{tooltip:{...tooltip,axisPointer:{type:'cross'}},legend:{data:['expected','actual'],top:0},grid:{left:10,right:10,bottom:20,top:40,containLabel:true},xAxis:{type:'category',data:days,boundaryGap:false},yAxis:{type:'value'},series:[{name:'expected',type:'line',smooth:true,data:metric.expected,color:'#ff005a',animationDuration:2800},{name:'actual',type:'line',smooth:true,data:metric.actual,color:'#3888fa',areaStyle:{color:'#f3f8ff'},animationDuration:2800}]}
};}
const pieNames=['Industries','Technology','Forex','Gold','Forecasts'];
const pieValues=[320,240,149,100,59];
const radarNames=['Sales','Administration','Information Techology','Customer Support','Development','Marketing'];
const radarSeries=[{name:'Allocated Budget',value:[5000,7000,12000,11000,15000,14000]},{name:'Expected Spending',value:[4000,9000,15000,15000,13000,11000]},{name:'Actual Spending',value:[5500,11000,12000,15000,12000,12000]}];
const bars=[{name:'pageA',data:[79,52,200,334,390,330,220]},{name:'pageB',data:[80,52,200,334,390,330,220]},{name:'pageC',data:[30,52,200,334,390,330,220]}];
export const otherCharts:readonly ChartSpec[]=[
  {title:'预算比较',label:'预算与支出雷达图',legend:radarSeries.map(series=>series.name),headers:['项目',...radarNames],rows:radarSeries.map(series=>[series.name,...series.value]),option:{tooltip:{...tooltip},legend:{bottom:0,data:radarSeries.map(series=>series.name)},radar:{radius:'45%',center:['50%','43%'],axisName:{fontSize:10,width:74,overflow:'break',lineHeight:12,formatter:(name:string)=>name.replace('Information Techology','Information\nTechology').replace('Customer Support','Customer\nSupport')},splitNumber:8,indicator:radarNames.map((name,index)=>({name,max:index===0?10000:20000}))},series:[{type:'radar',symbolSize:0,areaStyle:{opacity:.3},data:radarSeries,animationDuration:3000}]}},
  {title:'文章分布',label:'文章分类玫瑰图',legend:pieNames,headers:['类别','文章数'],rows:pieNames.map((name,index)=>[name,pieValues[index]!]),option:{tooltip:{...tooltip,trigger:'item'},legend:{bottom:0,data:pieNames},series:[{name:'WEEKLY WRITE ARTICLES',type:'pie',roseType:'radius',radius:[15,'50%'],center:['50%','40%'],label:{fontSize:10,width:60,overflow:'break'},labelLine:{length:10,length2:5},data:pieNames.map((name,index)=>({name,value:pieValues[index]})),animationDuration:2600}]}},
  {title:'页面访问',label:'一周页面访问堆叠柱状图',legend:bars.map(series=>series.name),headers:['日期',...bars.map(series=>series.name)],rows:days.map((day,index)=>[day,...bars.map(series=>series.data[index]!)]),option:{tooltip:{...tooltip,axisPointer:{type:'shadow'}},legend:{top:0,data:bars.map(series=>series.name)},grid:{top:40,left:10,right:10,bottom:20,containLabel:true},xAxis:{type:'category',data:days},yAxis:{type:'value'},series:bars.map(series=>({...series,type:'bar',stack:'visitors',barWidth:'60%',animationDuration:3000}))}}
];
