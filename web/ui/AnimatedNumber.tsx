import {useEffect,useState} from 'react';
export function AnimatedNumber({total,duration}:{total:number;duration:number}){
  const [display,setDisplay]=useState(0);
  useEffect(()=>{let frame=0;const start=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const update=(time:number)=>{const progress=reduced||duration<=0?1:Math.min(1,(time-start)/duration);setDisplay(Math.round(total*progress));if(progress<1)frame=requestAnimationFrame(update);};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);},[total,duration]);
  return <strong><span aria-hidden="true">{display.toLocaleString('zh-CN')}</span><span className="dashboard-visually-hidden">{total.toLocaleString('zh-CN')}</span></strong>;
}
