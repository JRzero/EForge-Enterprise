import {useEffect,useState,type FormEvent} from 'react';
import {Button,Input} from '@eforge/ui';
import type {SessionRuntime} from '../../integration/session';
import type {CaptchaChallenge} from '../../integration/legacy-auth';
import {errorMessage} from '../../integration/errors';
import {AuthenticationLayout} from './AuthenticationLayout';
export function RegistrationPage({runtime,onLogin}:{runtime:SessionRuntime;onLogin:()=>void}) {
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[code,setCode]=useState('');
  const [version,setVersion]=useState(0),[enabled,setEnabled]=useState(false),[challenge,setChallenge]=useState<CaptchaChallenge|null>(null);
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([runtime.api.registrationStatus(controller.signal),runtime.api.captcha(controller.signal)]).then(([status,captcha])=>{
      if(!controller.signal.aborted){setEnabled(status.enabled);setChallenge(captcha);setLoading(false);}
    }).catch(cause=>{if(!controller.signal.aborted){setLoadError(errorMessage(cause));setLoading(false);}});
    return()=>controller.abort();
  },[runtime,version]);
  function reload(){setLoading(true);setLoadError('');setChallenge(null);setCode('');setVersion(value=>value+1);}
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy || loading || !enabled || !challenge || success)return;
    if(username.length<2 || username.length>20 || password.length<5 || password.length>20){setError('账号须为 2–20 个字符，密码须为 5–20 个字符。');return;}
    if(/[<>"'|\\]/.test(password)){setError('密码不能包含 < > " \' | 或反斜杠。');return;}
    if(password!==confirm){setError('两次输入的密码不一致。');return;}
    if(challenge.enabled && !code.trim()){setError('请输入验证码。');return;}
    setBusy(true);setError('');
    try{await runtime.api.register({username,password,confirmPassword:confirm,...(challenge.enabled?{code,uuid:challenge.uuid}:{})});setSuccess(true);setPassword('');setConfirm('');setCode('');}
    catch(cause){setError(errorMessage(cause));setPassword('');setConfirm('');reload();}
    finally{setBusy(false);}
  }
  return <AuthenticationLayout><h2>注册账号</h2>
      {success?<div role="status"><p>恭喜你，您的账号 {username} 注册成功！</p><Button label="前往登录" onClick={onLogin}/></div>:
      loading?<p role="status">正在获取注册设置…</p>:loadError?<div role="alert"><p>{loadError}</p><Button label="重试" onClick={reload}/></div>:
      !enabled?<p role="status">注册暂未开放，请联系企业管理员。</p>:
      <form onSubmit={event=>{void submit(event);}}>
        <Input label="账号" htmlName="username" autoComplete="username" value={username} onChange={setUsername} aria-required="true" isDisabled={busy}/>
        <Input label="密码" htmlName="password" type="password" autoComplete="new-password" value={password} onChange={setPassword} aria-required="true" isDisabled={busy}/>
        <Input label="确认密码" htmlName="confirmPassword" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} aria-required="true" isDisabled={busy}/>
        {challenge?.enabled?<div className="captcha-row"><Input label="验证码" htmlName="code" value={code} onChange={setCode} aria-required="true" isDisabled={busy}/>
          <button type="button" className="captcha-image" onClick={reload} disabled={busy} aria-label="更换验证码"><img src={challenge.image} alt="注册验证码"/><span>换一张</span></button></div>:null}
        {error?<p role="alert">{error}</p>:null}<Button label={busy?'正在注册…':'注册'} type="submit" isDisabled={busy || !challenge}/>
      </form>}
      {!success?<a href="/login" onClick={event=>{if(busy){event.preventDefault();return;}if(!event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onLogin();}}}>使用已有账户登录</a>:null}
  </AuthenticationLayout>;
}
