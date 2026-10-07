import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Button,Input} from '@eforge/ui';
import type {UserSummary} from '../../generated/api';
import {AccountAvatar} from '../../app/components/AccountAvatar';
import {errorMessage} from '../../integration/errors';
function LockBackground(){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const node=canvas.current;const context=node?.getContext('2d');if(!node || !context)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const dots=Array.from({length:80},()=>({x:Math.random(),y:Math.random(),dx:(Math.random()-.5)*.00035,dy:(Math.random()-.5)*.00035}));
    let frame=0;let last=0;let width=0;let height=0;
    function resize(){width=node!.clientWidth;height=node!.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);node!.width=width*ratio;node!.height=height*ratio;context!.setTransform(ratio,0,0,ratio,0,0);}
    function paint(now:number){const elapsed=Math.min(now-last,40);last=now;context!.clearRect(0,0,width,height);context!.fillStyle='rgba(135,174,222,.65)';
      for(const dot of dots){if(!reduced.matches){dot.x+=dot.dx*elapsed;dot.y+=dot.dy*elapsed;if(dot.x<0 || dot.x>1)dot.dx*=-1;if(dot.y<0 || dot.y>1)dot.dy*=-1;}context!.beginPath();context!.arc(dot.x*width,dot.y*height,2,0,Math.PI*2);context!.fill();}
      for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++){const a=dots[i],b=dots[j];if(!a || !b)continue;const distance=Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);if(distance<110){context!.strokeStyle=`rgba(135,174,222,${(1-distance/110)*.2})`;context!.beginPath();context!.moveTo(a.x*width,a.y*height);context!.lineTo(b.x*width,b.y*height);context!.stroke();}}
      if(!reduced.matches && !document.hidden)frame=requestAnimationFrame(paint);
    }
    function resume(){cancelAnimationFrame(frame);resize();last=performance.now();paint(last);}
    const observer=new ResizeObserver(resume);observer.observe(node);reduced.addEventListener('change',resume);document.addEventListener('visibilitychange',resume);resume();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();reduced.removeEventListener('change',resume);document.removeEventListener('visibilitychange',resume);};
  },[]);
  return <canvas ref={canvas} className="screen-lock-background" aria-hidden="true"/>;
}
export function ScreenLockPage({user,unlock,logout,logoutBusy,logoutError}:{user:UserSummary;unlock:(password:string)=>Promise<void>;logout:()=>Promise<void>;logoutBusy:boolean;logoutError:string}){
  const [now,setNow]=useState(()=>new Date());const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [shake,setShake]=useState(false);
  const form=useRef<HTMLFormElement>(null);const operation=useRef(0);const shakeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const submitting=useRef(false);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);const ownership=operation;const shakeOwned=shakeTimer;return()=>{clearInterval(timer);ownership.current++;if(shakeOwned.current)clearTimeout(shakeOwned.current);};},[]);
  useEffect(()=>{if(!busy && error)form.current?.querySelector('input')?.focus();},[busy,error]);
  async function submit(event:FormEvent){event.preventDefault();if(submitting.current || logoutBusy || !password)return;if(password.length>20){setPassword('');setError('密码最多 20 个字符。');return;}submitting.current=true;const owner=++operation.current;setBusy(true);setError('');
    try{await unlock(password);}catch(cause){if(owner===operation.current){setPassword('');setError(errorMessage(cause));setShake(true);if(shakeTimer.current)clearTimeout(shakeTimer.current);shakeTimer.current=setTimeout(()=>setShake(false),600);}}
    finally{if(owner===operation.current){setBusy(false);submitting.current=false;}}
  }
  return <main className="screen-lock-page"><LockBackground/><section className={`screen-lock-card${shake?' screen-lock-shake':''}`} aria-label="锁定屏幕"><time className="screen-lock-time" dateTime={now.toISOString()}>{now.toLocaleTimeString('zh-CN',{hour12:false})}</time><p>{now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p><AccountAvatar key={user.id+user.avatarUrl} user={user}/><h1>{user.displayName}</h1><p>屏幕已锁定，请输入当前账号的密码继续。</p><form ref={form} onSubmit={event=>void submit(event)}><Input label="解锁密码" type="password" autoComplete="current-password" hasAutoFocus value={password} onChange={value=>setPassword(value)} isDisabled={busy || logoutBusy}/>{error || logoutError?<p role="alert">{error || logoutError}</p>:null}<Button label={busy?'正在解锁…':'解锁'} type="submit" isDisabled={busy || logoutBusy || !password}/></form><Button label={logoutBusy?'正在退出…':'退出重新登录'} variant="ghost" isDisabled={busy || logoutBusy} onClick={()=>void logout()}/></section></main>;
}
